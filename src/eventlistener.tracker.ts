interface IEventListenerRegistration {
  nodeLocator: () => Element
  hook: (e: Element) => (e: Element) => void
}

interface IEventListenerSubscription extends IEventListenerRegistration {
  oldNode?: Element
  unhook?: (e: Element) => void
}

export class EventListenerTracker {
  private _subscriptions: IEventListenerSubscription[] = []

  register(registration: IEventListenerRegistration) {
    this._subscriptions.push({ ...registration })
  }

  unregister(registration: Partial<IEventListenerRegistration>) {
    const subscriptionsToRemove = this._subscriptions.filter(
      (s) =>
        (registration.nodeLocator == null || s.nodeLocator === registration.nodeLocator) &&
        (registration.hook == null || s.hook === registration.hook),
    )
    subscriptionsToRemove.forEach((s) => {
      if (!s?.oldNode) {
        return
      }
      s.unhook(s.oldNode)
    })

    this._subscriptions = this._subscriptions.filter((s) => !subscriptionsToRemove.includes(s))
  }

  refreshSubscriptions() {
    this._subscriptions.forEach((s) => {
      const node = s.nodeLocator()
      if (node !== s.oldNode && node != null) {
        s.unhook?.(s.oldNode)
        s.unhook = s.hook(node)
        s.oldNode = node
      }
    })
  }
}
