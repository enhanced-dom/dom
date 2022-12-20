import { IRenderingEventContext } from './renderer.types'

export class RenderingEvent<T extends IRenderingEventContext> extends CustomEvent<T> {
  static type = 'RenderingEvent'
  constructor(eventName: string, context: T = { emitter: { type: 'Unknown' } } as T) {
    super(RenderingEvent.type, { detail: { name: eventName, ...context } })
  }
}

export class TemplateRenderErrorEvent<T extends IRenderingEventContext> extends RenderingEvent<T> {
  static type = 'TemplateRenderErrorEvent'
  constructor(context?: T) {
    super(TemplateRenderErrorEvent.type, context)
  }
}

export class TemplateDiffErrorEvent<T extends IRenderingEventContext> extends RenderingEvent<T> {
  static type = 'TemplateDiffErrorEvent'
  constructor(context?: T) {
    super(TemplateDiffErrorEvent.type, context)
  }
}
