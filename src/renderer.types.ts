export interface IRenderingEngine<T extends Record<string, any> = Record<string, any>> {
  render: (node: Element | ShadowRoot | DocumentFragment, args?: T) => void
  cleanup: () => void
}

export interface IHtmlRenderer {
  render: (domNode: Element | ShadowRoot | DocumentFragment, abstractNodes: IAbstractNode | IAbstractNode[] | null) => void
}

export interface IAbstractNodeBase {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _key?: string
}

export interface IAbstractElement extends IAbstractNodeBase {
  tag: string
  attributes?: Record<string, any>
  children?: (IAbstractNode | null)[]
  content?: never
  ignoreChildren?: boolean
  eventListeners?: Record<string, (e: Event) => void>
}

export interface IAbstractNonElement extends IAbstractNodeBase {
  tag?: never
  content: string | number | null
}

export type IAbstractNode = IAbstractElement | IAbstractNonElement

export interface IStylesTracker {
  registerListener: (func: () => void) => string
  unregisterListener: (listenerId: string) => void
  getStyles: (classNames: string | string[], listenerId?: string) => string
}

export interface IRenderingEventContext {
  emitter: { type: string; id?: string }
}
