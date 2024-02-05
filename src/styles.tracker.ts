import uniqueId from 'lodash.uniqueid'
import castArray from 'lodash.castarray'

import { IStylesTracker } from './renderer.types'

const getClassNameRegex = (className: string) => new RegExp(`\\.${className}(\\[|\\s>|:|\\s\\.|\\s{|\\s#)`)

const getStyleSheetRulesMatches = (styles: string, classNames: string[]) => {
  return classNames.filter((className) => {
    const classRegex = getClassNameRegex(className)
    return classRegex.test(styles)
  })
}

const getDocumentStyles = (className: string) => {
  const classRegex = getClassNameRegex(className)
  return Array.from(document.styleSheets).filter((styleSheet) => {
    return Array.from(styleSheet.cssRules).some((rule) => {
      return classRegex.test(rule.cssText)
    })
  })
}

/**
 * We need a way to extract css rules for a certain class. This is useful when trying to 'apply' custom styles through
 * a webcomponent boundary. We should cache the rules for a certain class (so that on subsequent renders we don't re-scan all
 * the stylesheets). However, stylesheets can change (or their context can change), and we need to keep the appropriate parts in
 * sync. So we'll use a mutation observer to track added and removed <style> tags to the <head>, and invalidate our caches when styles
 * are added/removed.
 *
 * TODO: We should also handle the case when the contents of an existing <style> tag are changed (via e.g. styledcomponents).
 * Ideally, we'll use a different mutation observer on the contents of each of the stylesheets.
 */
export class StylesTracker implements IStylesTracker {
  private _observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const trackedClassNames = Object.keys(this._classNamesCache)
        let listenersToRefresh = []
        if (trackedClassNames.length) {
          const styleNodesAdded = Array.from(mutation.addedNodes).filter((n) => n instanceof HTMLStyleElement) as HTMLStyleElement[]
          const trackedClassNamesToRefreshAdd = styleNodesAdded.flatMap((styleNode) => {
            return getStyleSheetRulesMatches(styleNode.innerHTML, trackedClassNames)
          })
          const styleNodesRemoved = Array.from(mutation.removedNodes).filter((n) => n instanceof HTMLStyleElement) as HTMLStyleElement[]
          const trackedClassNamesToRefreshRemoved = styleNodesRemoved.flatMap((styleNode) => {
            return getStyleSheetRulesMatches(styleNode.innerHTML, trackedClassNames)
          })
          const trackedClassNamesToRefresh = Array.from(new Set([...trackedClassNamesToRefreshAdd, ...trackedClassNamesToRefreshRemoved]))
          listenersToRefresh = Array.from(new Set(trackedClassNamesToRefresh.flatMap((cn) => this._classNameListeners[cn] ?? [])))
          trackedClassNamesToRefresh.forEach((className) => {
            delete this._classNamesCache[className]
          })
        }
        listenersToRefresh.forEach((listenerId) => this._listeners[listenerId]())
      }
    })
  })

  private _listeners: Record<string, () => void> = {} // key: listener id, value: listener function
  private _classNamesCache: Record<string, CSSStyleSheet[]> = {} // key: className, value: style sheets containing the className
  private _listenersInterests: Record<string, string[]> = {} // key: listener id, value: list of classNames
  private _classNameListeners: Record<string, string[]> = {} // key: className, value: list of listener ids

  constructor() {
    const config = { attributes: false, childList: true, subtree: true, characterData: true }
    this._observer.observe(document.head, config)
  }

  public registerListener = (func: () => void) => {
    const listenerId = uniqueId('styles-listener-')
    this._listeners[listenerId] = func
    return listenerId
  }

  public unregisterListener = (listenerId: string) => {
    delete this._listeners[listenerId]
  }

  public getStyles = (classNames: string | string[], listenerId?: string) => {
    const classNamesArray = castArray(classNames).flatMap((className) => className.split(' ').filter((cn) => !!cn))
    if (listenerId) {
      let addedClassNameInterests = classNamesArray
      if (this._listenersInterests[listenerId]) {
        addedClassNameInterests = classNamesArray.filter((className) => !this._listenersInterests[listenerId].includes(className))
        const removedClassNameInterests = this._listenersInterests[listenerId].filter((className) => !classNamesArray.includes(className))
        removedClassNameInterests.forEach((className) => {
          this._classNameListeners[className] = this._classNameListeners[className]?.filter(
            (interestedListenerId) => interestedListenerId !== listenerId,
          )
        })
      }
      addedClassNameInterests.forEach((className) => {
        this._classNameListeners[className] = this._classNameListeners[className] ?? []
        this._classNameListeners[className].push(listenerId)
      })
      this._listenersInterests[listenerId] = addedClassNameInterests
    }

    const stylesheetsSet = classNamesArray.reduce((acc, className) => {
      if (!this._classNamesCache[className]) {
        this._classNamesCache[className] = getDocumentStyles(className)
      }
      if (this._classNamesCache[className]) {
        this._classNamesCache[className].forEach(acc.add, acc)
      }
      return acc
    }, new Set<CSSStyleSheet>())

    return Array.from(stylesheetsSet)
      .map((styleSheet) => {
        const cssRules = Array.from(styleSheet.cssRules)
        return cssRules.map((cssRule) => cssRule.cssText).join(' ')
      })
      .join(' ')
  }
}
