export const isTextNode = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE
export const isDocumentNode = (node: Node): node is Document | ShadowRoot =>
  node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE
export const isElementNode = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE

// eslint-disable-next-line @typescript-eslint/naming-convention
export type WithManagedEvents<T extends Element> = T & { _managedEventListeners: Record<string, (e: Event) => void> }

export const hasManagedListeners = (node: Node): node is WithManagedEvents<Element> =>
  isElementNode(node) && '_managedEventListeners' in node
