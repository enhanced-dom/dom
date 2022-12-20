import { IAbstractElement, IAbstractNode } from './renderer.types'

const isTextNode = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE
const isDocumentNode = (node: Node): node is Document | ShadowRoot =>
  node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
const isElementNode = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE

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
  }

  if (isElementNode(node)) {
    astNode.attributes = {}
    for (const attribute of node.attributes) {
      astNode.attributes[attribute.name] = attribute.value
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
