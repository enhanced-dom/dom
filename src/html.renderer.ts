import castArray from 'lodash.castarray'

import type { IAbstractNode, IHtmlRenderer } from './renderer.types'
import { TemplateDiffErrorEvent, TemplateRenderErrorEvent } from './renderer.events'
import {
  AbstractDomDiff,
  AbstractDomOperationType,
  IAbstractDomOperation,
  IAddOperation,
  IInsertOperation,
  IModifyOperation,
  IMoveOperation,
  IRemoveOperation,
  IReplaceOperation,
  isAbstractElement,
} from './abstract.renderer'
import { parseNode } from './html.parser'

export class HtmlRenderer implements IHtmlRenderer {
  private _name?: string
  static eventEmitterType = '@enhanced-dom/htmlRenderer'
  private _abstractDomDiff = new AbstractDomDiff()

  constructor(name = 'Unknown') {
    this._name = name
  }

  private _serializeAttributeValue(attributeValue: any) {
    if (typeof attributeValue === 'boolean') {
      if (attributeValue) {
        return ''
      }
    } else if (typeof attributeValue === 'string') {
      return attributeValue
    } else if (typeof attributeValue === 'number') {
      return attributeValue.toString()
    } else if (attributeValue != null) {
      return JSON.stringify(attributeValue)
    }
    return null
  }

  private _createHtmlNode = (ae?: IAbstractNode) => {
    if (ae == null) {
      return null
    }
    if (!isAbstractElement(ae)) {
      if (ae.content == null) {
        return null
      }
      return document.createTextNode(ae.content?.toString())
    }

    const { tag, attributes = {}, children = [] } = ae
    let node: Element | DocumentFragment = null
    if (tag === 'fragment') {
      node = document.createDocumentFragment()
    } else if (tag === 'svg') {
      return this._createSvgNode(ae)
    } else {
      const element = document.createElement(tag)
      Object.keys(attributes).forEach((attrName) => {
        const serializedAttributeValue = this._serializeAttributeValue(attributes[attrName])
        if (serializedAttributeValue != null) {
          element.setAttribute(attrName, serializedAttributeValue)
        }
      })

      node = element
    }

    const childNodes = this._createHtmlNodes(children.filter((c) => c !== null))

    childNodes.forEach((n) => node.appendChild(n))

    return node
  }

  private _createHtmlNodes = (aes?: IAbstractNode[]) => {
    return aes?.map(this._createHtmlNode) ?? []
  }

  private _createSvgNode = (ae?: IAbstractNode) => {
    if (ae == null) {
      return null
    }
    if (!isAbstractElement(ae)) {
      if (ae.content == null) {
        return null
      }
      return document.createTextNode(ae.content?.toString())
    }
    const { tag, attributes = {}, children = [] } = ae
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag)
    Object.keys(attributes).forEach((attrName) => {
      const serializedAttributeValue = this._serializeAttributeValue(attributes[attrName])
      if (serializedAttributeValue != null) {
        element.setAttribute(attrName, serializedAttributeValue)
      }
    })
    const childNodes = this._createSvgNodes(children.filter((c) => c !== null))

    childNodes.forEach((n) => element.appendChild(n))

    return element
  }

  private _createSvgNodes = (aes?: IAbstractNode[]) => {
    return aes?.map(this._createSvgNode) ?? []
  }

  private _getDomNodeByPath(node: Element | ShadowRoot | DocumentFragment, path: string) {
    const splitPath = path.split(AbstractDomDiff.separators.path)
    let finalNode: Node = node
    splitPath.some((pathPart) => {
      if (pathPart.startsWith(AbstractDomDiff.separators.attribute)) {
        return true
      } else {
        // children pathPart
        const subpathParts = pathPart.split(AbstractDomDiff.separators.childIdx)
        if (subpathParts.length > 1) {
          // we should definitely access a child
          const childIndex = parseInt(subpathParts[1].split('.')[0], 10)
          finalNode = finalNode?.childNodes?.[childIndex]
        }
      }
    })
    return finalNode
  }

  private _processAddOperation(node: Element | ShadowRoot | DocumentFragment, operation: IAddOperation) {
    const childToAdd = this._createHtmlNode(operation.data)
    const parentNode = this._getDomNodeByPath(node, operation.path)
    parentNode.appendChild(childToAdd)
  }

  private _processMoveOperation(node: Element | ShadowRoot | DocumentFragment, operation: IMoveOperation) {
    const childToMove = this._getDomNodeByPath(node, operation.path) as ChildNode
    const parentNode = childToMove.parentNode
    const allParentChildren = Array.from(parentNode.childNodes).filter((n) => n !== childToMove) as Node[]
    allParentChildren.splice(operation.data, 0, childToMove)
    allParentChildren.forEach((c) => parentNode.appendChild(c))
  }

  private _processRemoveOperation(node: Element | ShadowRoot | DocumentFragment, operation: IRemoveOperation) {
    const nodeToRemove = this._getDomNodeByPath(node, operation.path)
    const isRemoveAllChildren = operation.path.endsWith('children')
    if (!isRemoveAllChildren) {
      const parentNode = nodeToRemove === node ? nodeToRemove : nodeToRemove.parentNode
      parentNode.removeChild(nodeToRemove)
    } else {
      Array.from(nodeToRemove.childNodes).forEach((cn) => nodeToRemove.removeChild(cn))
    }
  }

  private _processReplaceOperation(node: Element | ShadowRoot | DocumentFragment, operation: IReplaceOperation) {
    const nodeToReplace = this._getDomNodeByPath(node, operation.path) as ChildNode
    const newNode = this._createHtmlNode(operation.data)
    const parentNode = nodeToReplace.parentNode
    const allParentChildren = Array.from(parentNode.childNodes) as Node[]
    allParentChildren.splice(allParentChildren.indexOf(nodeToReplace), 0, newNode)
    allParentChildren.forEach((c) => parentNode.appendChild(c))
  }

  private _processModifyOperation(node: Element | ShadowRoot | DocumentFragment, operation: IModifyOperation) {
    const nodeToModify = this._getDomNodeByPath(node, operation.path) as Element
    const attrName = operation.path.split(AbstractDomDiff.separators.attribute)[1]
    const serializedAttributeValue = this._serializeAttributeValue(operation.data)
    if (serializedAttributeValue != null) {
      nodeToModify.setAttribute(attrName, serializedAttributeValue)
    } else {
      nodeToModify.removeAttribute(attrName)
    }
  }

  private _processInsertOperation(node: Element | ShadowRoot | DocumentFragment, operation: IInsertOperation) {
    const existentChild = this._getDomNodeByPath(node, operation.path)
    const newNode = this._createHtmlNode(operation.data)
    if (existentChild) {
      existentChild.parentNode.insertBefore(newNode, existentChild)
    } else {
      const parentNode = this._getDomNodeByPath(
        node,
        operation.path.slice(0, operation.path.lastIndexOf(AbstractDomDiff.separators.childIdx)),
      )
      parentNode.appendChild(newNode)
    }
  }

  render(domNode: Element | ShadowRoot | DocumentFragment, abstractNodes: IAbstractNode | IAbstractNode[]) {
    let operations: IAbstractDomOperation[] = []
    const existingAst = parseNode(domNode)
    try {
      operations = this._abstractDomDiff.diff(
        { ...existingAst, children: castArray(abstractNodes) },
        existingAst,
        this._serializeAttributeValue,
      )
    } catch (ex) {
      domNode.dispatchEvent(new TemplateDiffErrorEvent({ emitter: { type: HtmlRenderer.eventEmitterType, id: this._name } }))
      console.log(ex)
      return
    }
    try {
      operations.forEach((operation) => {
        switch (operation.type) {
          case AbstractDomOperationType.ADD:
            this._processAddOperation(domNode, operation)
            break
          case AbstractDomOperationType.MOVE:
            this._processMoveOperation(domNode, operation)
            break
          case AbstractDomOperationType.REMOVE:
            this._processRemoveOperation(domNode, operation)
            break
          case AbstractDomOperationType.REPLACE:
            this._processReplaceOperation(domNode, operation)
            break
          case AbstractDomOperationType.MODIFY:
            this._processModifyOperation(domNode, operation)
            break
          case AbstractDomOperationType.INSERT:
            this._processInsertOperation(domNode, operation)
            break
        }
      })
    } catch (ex) {
      domNode.dispatchEvent(new TemplateRenderErrorEvent({ emitter: { type: HtmlRenderer.eventEmitterType, id: this._name } }))
      console.log(ex)
    }
  }
}
