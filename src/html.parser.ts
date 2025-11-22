import { hasManagedListeners, isDocumentNode, isElementNode, isTextNode } from './html.utils'
import { IAbstractElement, IAbstractNode } from './renderer.types'

export const parseNode = (node: Node): IAbstractNode => {
  if (isTextNode(node)) {
    return {
      content: node.wholeText,
    }
  }
  if (!isDocumentNode(node) && !isElementNode(node)) {
    return {
      tag: 'comment',
    }
  }
  const astNode: IAbstractElement = {
    tag: isDocumentNode(node) ? 'fragment' : node.tagName.toLowerCase(),
    children: [],
    eventListeners: {},
  }

  if (isElementNode(node)) {
    astNode.attributes = {}
    for (const attribute of node.attributes) {
      astNode.attributes[attribute.name] = attribute.value
    }

    if (hasManagedListeners(node)) {
      astNode.eventListeners = { ...node._managedEventListeners }
    }

    if (astNode.tag !== 'style') {
      astNode.children = Array.from(node.childNodes).map((childNode) => parseNode(childNode))
    } else {
      astNode.children = [{ content: node.innerHTML }]
    }
  } else {
    astNode.children = Array.from(node.childNodes).map((childNode) => parseNode(childNode))
  }
  return astNode
}
