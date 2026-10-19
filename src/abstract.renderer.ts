import { STYLESHEET_ATTRIBUTE_NAME } from '@enhanced-dom/css'

import type { IAbstractNode, IAbstractElement } from './renderer.types'
import { SECTION_ID } from './constants'

export const isAbstractElement = (ae: IAbstractNode): ae is IAbstractElement => {
  return ae != undefined && ae.content === undefined
}

export enum AbstractDomOperationType {
  ADD = 'add',
  REMOVE = 'remove',
  MODIFY = 'modify',
  REPLACE = 'replace',
  INSERT = 'insert',
  MOVE = 'move',
  REGISTER_LISTERNER = 'register_listener',
  UNREGISTER_LISTENER = 'unregister_listener',
}

interface IOperationBase {
  path: string
}

export interface IAddOperation extends IOperationBase {
  type: AbstractDomOperationType.ADD
  data: IAbstractNode
}

export interface IReplaceOperation extends IOperationBase {
  type: AbstractDomOperationType.REPLACE
  data: IAbstractNode
}

export interface IRemoveOperation extends IOperationBase {
  type: AbstractDomOperationType.REMOVE
}

export interface IMoveOperation extends IOperationBase {
  type: AbstractDomOperationType.MOVE
  data: number
}

export interface IModifyOperation extends IOperationBase {
  type: AbstractDomOperationType.MODIFY
  data: any
}

export interface IInsertOperation extends IOperationBase {
  type: AbstractDomOperationType.INSERT
  data: IAbstractNode
}

export interface IRegisterListenerOperation extends IOperationBase {
  type: AbstractDomOperationType.REGISTER_LISTERNER
  data: {
    eventName: string
    listener: (e: Event) => void
  }
}

export interface IUnregisterListenerOperation extends IOperationBase {
  type: AbstractDomOperationType.UNREGISTER_LISTENER
  data: {
    eventName: string
    listener: (e: Event) => void
  }
}

export type IAbstractDomOperation =
  | IAddOperation
  | IRemoveOperation
  | IReplaceOperation
  | IMoveOperation
  | IModifyOperation
  | IInsertOperation
  | IRegisterListenerOperation
  | IUnregisterListenerOperation

const getKeyAttributeName = (tag: string) => {
  if (tag === 'slot') {
    return 'name'
  }
  if (tag === 'style') {
    return STYLESHEET_ATTRIBUTE_NAME
  }
  return SECTION_ID
}

export class AbstractDomDiff {
  static areMatching(node1: IAbstractNode, node2: IAbstractNode) {
    const getNodeIdentifier = (node: IAbstractNode) => {
      if (isAbstractElement(node)) {
        const tag = node.tag
        const key = node._key ?? node.attributes?.[getKeyAttributeName(tag)]
        return `tag:${tag}-identifier:${key}`
      } else {
        return `content:${node.content}`
      }
    }
    return getNodeIdentifier(node1) === getNodeIdentifier(node2)
  }

  static separators = {
    path: '/',
    attribute: '.',
    childIdx: '#',
  }

  diff(
    newElementVersion: IAbstractNode | null,
    oldElementVersion?: IAbstractNode | null,
    attributeSerializer: (value?: any) => string | null | undefined = (value) => (value != null ? String(value) : value),
  ) {
    const operations: IAbstractDomOperation[] = []

    const withKeyAttribute = (node: IAbstractNode): IAbstractNode => {
      if (!isAbstractElement(node)) {
        return node
      }
      const withAttr =
        node._key != null ? { ...node, attributes: { ...node.attributes, [getKeyAttributeName(node.tag)]: node._key } } : node
      return withAttr.children ? { ...withAttr, children: withAttr.children.map((c) => (c == null ? c : withKeyAttribute(c))) } : withAttr
    }

    const actualDiff = (prevNode: IAbstractNode | undefined | null, currNode: IAbstractNode | null, parentPath = '') => {
      if (prevNode == null) {
        if (currNode !== null) {
          operations.push({ path: parentPath, type: AbstractDomOperationType.ADD, data: withKeyAttribute(currNode) })
        }
      } else if (currNode == null) {
        operations.push({ path: parentPath, type: AbstractDomOperationType.REMOVE })
      } else {
        if (!AbstractDomDiff.areMatching(prevNode, currNode)) {
          operations.push({ path: parentPath, type: AbstractDomOperationType.REPLACE, data: withKeyAttribute(currNode) })
        } else if (isAbstractElement(prevNode) && isAbstractElement(currNode)) {
          // #region attribiutes
          const prevAttributes =
            prevNode._key != null ? { ...prevNode.attributes, [getKeyAttributeName(prevNode.tag)]: prevNode._key } : prevNode.attributes
          const currAttributes =
            currNode._key != null ? { ...currNode.attributes, [getKeyAttributeName(currNode.tag)]: currNode._key } : currNode.attributes
          const prevNodeAttributeKeys = Object.keys(prevAttributes ?? {}).filter((k) => k.toLowerCase() !== 'exportparts')
          const lowerCasePrevNodeAttributeKeys = prevNodeAttributeKeys.map((k) => k.toLowerCase())
          const currNodeAttributeKeys = Object.keys(currAttributes ?? {}).filter((k) => k.toLowerCase() !== 'exportparts')
          const lowerCaseCurrNodeAttributeKeys = currNodeAttributeKeys.map((k) => k.toLowerCase())
          const commonCurrentKeys = currNodeAttributeKeys.filter((k) => lowerCasePrevNodeAttributeKeys.includes(k.toLowerCase()))
          const commonPrevKeys = prevNodeAttributeKeys.filter((k) => lowerCaseCurrNodeAttributeKeys.includes(k.toLowerCase()))
          const keysToRemove = prevNodeAttributeKeys.filter((k) => !lowerCaseCurrNodeAttributeKeys.includes(k.toLowerCase()))
          const keysToAdd = currNodeAttributeKeys.filter((k) => !lowerCasePrevNodeAttributeKeys.includes(k.toLowerCase()))
          const keysToModify = commonPrevKeys.filter((k) => {
            const currentKey = commonCurrentKeys.find((ck) => ck.toLowerCase() === k.toLowerCase())
            if (currentKey == null) {
              return false
            }
            return attributeSerializer(currAttributes?.[currentKey]) !== attributeSerializer(prevAttributes?.[k])
          })
          keysToAdd.forEach((k) =>
            operations.push({
              path: `${parentPath}${AbstractDomDiff.separators.attribute}${k}`,
              type: AbstractDomOperationType.MODIFY,
              data: currAttributes?.[k],
            }),
          )
          keysToModify.forEach((k) => {
            const currentKey = commonCurrentKeys.find((ck) => ck.toLowerCase() === k.toLowerCase())
            if (currentKey != null) {
              operations.push({
                path: `${parentPath}${AbstractDomDiff.separators.attribute}${k}`,
                type: AbstractDomOperationType.MODIFY,
                data: currAttributes?.[currentKey],
              })
            }
          })
          keysToRemove.forEach((k) =>
            operations.push({
              path: `${parentPath}${AbstractDomDiff.separators.attribute}${k}`,
              type: AbstractDomOperationType.MODIFY,
              data: null,
            }),
          )
          // #endregion
          // #region event listeners
          const currNodeListenerKeys = Object.keys(currNode.eventListeners ?? {})
          const listenersToAdd = currNodeListenerKeys.reduce<string[]>((acc, eventName) => {
            if (prevNode.eventListeners?.[eventName] !== currNode.eventListeners?.[eventName]) {
              acc.push(eventName)
            }
            return acc
          }, [])
          const prevNodeListenerKeys = Object.keys(prevNode.eventListeners ?? {})
          listenersToAdd.forEach((eventName) => {
            if (prevNodeListenerKeys.includes(eventName)) {
              operations.push({
                path: parentPath,
                type: AbstractDomOperationType.UNREGISTER_LISTENER,
                data: {
                  eventName,
                  listener: prevNode.eventListeners![eventName]!,
                },
              })
            }
            operations.push({
              path: parentPath,
              type: AbstractDomOperationType.REGISTER_LISTERNER,
              data: {
                eventName,
                listener: currNode.eventListeners![eventName]!,
              },
            })
          })
          if (prevNode.eventListeners) {
            const listenersToRemove = prevNodeListenerKeys.filter((eventName) => !currNodeListenerKeys.includes(eventName))
            listenersToRemove.forEach((eventName) => {
              operations.push({
                path: parentPath,
                type: AbstractDomOperationType.UNREGISTER_LISTENER,
                data: {
                  eventName,
                  listener: prevNode.eventListeners![eventName]!,
                },
              })
            })
          }
          // #endregion

          if (!currNode.ignoreChildren) {
            // #region children
            const prevNodeChildren = prevNode.children?.filter?.((c) => c != null) ?? []
            const currNodeChildren = currNode.children?.filter?.((c) => c != null) ?? []
            if (!prevNodeChildren.length) {
              currNodeChildren
                ?.filter((n) => n != null)
                .forEach((n) =>
                  operations.push({
                    path: `${parentPath}${AbstractDomDiff.separators.path}children`,
                    type: AbstractDomOperationType.ADD,
                    data: withKeyAttribute(n),
                  }),
                )
            } else if (!currNodeChildren.length) {
              operations.push({
                path: `${parentPath}${AbstractDomDiff.separators.path}children`,
                type: AbstractDomOperationType.REMOVE,
              })
            } else {
              const matchedChildren: Record<number, number> = {}
              const childrenToInsert: number[] = []
              currNodeChildren.forEach((c, idx) => {
                const matchedPrevChild = prevNodeChildren.find((pc, pidx) => AbstractDomDiff.areMatching(c, pc) && !matchedChildren[pidx])
                if (matchedPrevChild) {
                  matchedChildren[prevNodeChildren.indexOf(matchedPrevChild)] = idx
                } else {
                  childrenToInsert.push(idx)
                }
              })
              const indexesToRemove = prevNodeChildren.map((_, idx) => idx).filter((idx) => matchedChildren[idx] === undefined)
              Object.entries(matchedChildren).forEach((value) => {
                const prevChildNode = prevNodeChildren[parseInt(value[0])]
                const currentChildNode = currNodeChildren[value[1]]
                actualDiff(prevChildNode, currentChildNode ?? null, `${parentPath}${AbstractDomDiff.separators.path}children#${value[0]}`)
              })
              indexesToRemove.reverse().forEach((idx) =>
                operations.push({
                  type: AbstractDomOperationType.REMOVE,
                  path: `${parentPath}${AbstractDomDiff.separators.path}children${AbstractDomDiff.separators.childIdx}${idx}`,
                }),
              )
              childrenToInsert.reverse().forEach((idx) =>
                operations.push({
                  type: AbstractDomOperationType.INSERT,
                  path: `${parentPath}${AbstractDomDiff.separators.path}children${AbstractDomDiff.separators.childIdx}0`,
                  data: withKeyAttribute(currNodeChildren[idx]!),
                }),
              )
              Object.entries(matchedChildren).forEach((value) => {
                const itemsRemovedBeforeCurrent = indexesToRemove.filter((i) => i < parseInt(value[0])).length
                const itemsAddedBeforeCurrent = childrenToInsert.length
                const correctedActualPosition = parseInt(value[0]) - itemsRemovedBeforeCurrent + itemsAddedBeforeCurrent
                if (correctedActualPosition !== value[1]) {
                  operations.push({
                    type: AbstractDomOperationType.MOVE,
                    path: `${parentPath}${AbstractDomDiff.separators.path}children#${correctedActualPosition}`,
                    data: value[1],
                  })
                }
              })
            }
            // #endregion
          }
        }
      }
    }

    actualDiff(oldElementVersion, newElementVersion)
    return operations
  }
}
