type PaperTraceEvent = {
  kind: string
  fiber: any
  parent?: any
  previous?: any
  current?: any
  iterator?: object
  inverse?: Function
  done?: boolean
  failed?: boolean
  structural?: boolean
  implementation?: any
  realm?: symbol
}

export interface TraceAssumptions {
  AcyclicDependencies: boolean
  FiniteNames: boolean
  BoundedIterator: boolean
  PairwiseIndependent: boolean
  TotalProvision: boolean
  NoFailure: boolean
}

export interface TraceImplementation {
  name: string
  version: string
  revision: string
}

export interface TraceLine {
  schema: 'cordis.paper-trace/v1'
  tag: 'trace'
  sequence: number
  scenario: string
  implementation: TraceImplementation
  assumptions: TraceAssumptions
  observation: Record<string, unknown>
  state: AbstractState
}

interface Binding {
  key: string
  provider: string
}

interface Accumulator {
  iterator: string
  resources: string[]
}

interface AbstractFiber {
  id: string
  parent: string
  retired: boolean
  lifecycle: 'Inactive' | 'Reloading' | 'Active' | 'Unloading'
  outcome: 'bottom' | 'error'
  target: Binding[]
  committed: Binding[]
  accumulator: Accumulator[]
  inFlight: string[]
}

interface AbstractService {
  key: string
  provider: string
}

interface AbstractResource {
  id: string
  owner: string
  iterator: string
  status: 'installed' | 'restoring' | 'failed'
}

export interface AbstractState {
  fibers: AbstractFiber[]
  services: AbstractService[]
  resources: AbstractResource[]
}

interface ResourceRecord extends AbstractResource {
  inverse: Function
}

const compareId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id)

/** Converts internal Cordis observations into deterministic, complete abstract post-states. */
export class CordisPaperTraceRecorder {
  readonly lines: TraceLine[] = []

  private sequence = 0
  private readonly fibers: any[] = []
  private readonly removed = new WeakSet<object>()
  private readonly retired = new WeakSet<object>()
  private readonly fiberIds = new WeakMap<object, string>()
  private readonly fiberNameCounters = new Map<string, number>()
  private readonly realmIds = new Map<symbol, string>()
  private readonly realmNameCounters = new Map<string, number>()
  private readonly iteratorIds = new WeakMap<object, string>()
  private readonly iteratorCounters = new Map<string, number>()
  private readonly iteratorStacks = new Map<string, string[]>()
  private readonly inverseResources = new WeakMap<Function, ResourceRecord>()
  private readonly resourceCounters = new Map<string, number>()
  private readonly resources = new Map<string, ResourceRecord>()
  private readonly services = new Map<string, AbstractService>()

  constructor(
    readonly root: any,
    private readonly contextClass: any,
    readonly fiberState: Record<string, number>,
    private readonly scenario: string,
    private readonly assumptions: TraceAssumptions,
    private readonly implementation: TraceImplementation,
  ) {
    this.append({ point: 'trace-init' })
  }

  readonly sink = (event: PaperTraceEvent) => {
    if (!event.fiber.runtime) return

    const fiber = this.fiberId(event.fiber)
    const observation: Record<string, unknown> = { point: event.kind, fiber }
    if (event.kind === 'fiber-created') {
      this.fibers.push(event.fiber)
      observation.parent = event.parent?.runtime ? this.fiberId(event.parent) : 'root'
    } else if (event.kind === 'fiber-retired') {
      this.retired.add(event.fiber)
    } else if (event.kind === 'fiber-removed') {
      this.removed.add(event.fiber)
    } else if (event.kind === 'target-changed' || event.kind === 'committed-changed') {
      observation.previous = this.bindings(event.fiber, event.previous ?? [])
      observation.current = this.bindings(event.fiber, event.current ?? [])
    } else if (event.kind === 'state-changed') {
      observation.previous = this.lifecycle(event.previous, event.fiber).lifecycle
      observation.current = event.current === this.fiberState.DISPOSED
        ? 'absent'
        : this.lifecycle(event.current, event.fiber).lifecycle
    } else if (event.kind === 'iteration-landed') {
      observation.iterator = this.iteratorId(event.fiber, event.iterator!)
      observation.done = event.done
      if (event.inverse) observation.resource = this.resourceFor(event.fiber, event.iterator!, event.inverse).id
    } else if (event.kind === 'iteration-raised') {
      observation.iterator = this.iteratorId(event.fiber, event.iterator!)
      observation.reason = 'error'
    } else if (event.kind === 'inverse-collected') {
      const resource = this.resourceFor(event.fiber, event.iterator!, event.inverse!)
      this.iteratorStacks.get(resource.iterator)!.push(resource.id)
      this.resources.set(resource.id, resource)
      observation.iterator = resource.iterator
      observation.resource = resource.id
    } else if (event.kind === 'inverse-started') {
      if (event.structural) {
        observation.point = 'inverse-bookkeeping-started'
        this.append(observation)
        return
      }
      const resource = this.resourceForUnknownIterator(event.fiber, event.inverse!)
      resource.status = 'restoring'
      this.resources.set(resource.id, resource)
      observation.iterator = resource.iterator
      observation.resource = resource.id
    } else if (event.kind === 'inverse-finished') {
      if (event.structural) {
        observation.point = 'inverse-bookkeeping-finished'
        observation.failed = event.failed
        this.append(observation)
        return
      }
      const resource = this.resourceForUnknownIterator(event.fiber, event.inverse!)
      const stack = this.iteratorStacks.get(resource.iterator) ?? []
      if (stack.at(-1) === resource.id) stack.pop()
      if (event.failed) {
        resource.status = 'failed'
        this.resources.set(resource.id, resource)
      } else {
        this.resources.delete(resource.id)
      }
      observation.iterator = resource.iterator
      observation.resource = resource.id
      observation.failed = event.failed
    } else if (event.kind.startsWith('service-')) {
      const key = this.serviceKey(event.implementation.name, event.realm!)
      const service = { key, provider: fiber }
      observation.key = key
      observation.provider = fiber
      if (event.kind === 'service-provided') this.services.set(key, service)
      if (event.kind === 'service-withdrawn') this.services.delete(key)
    }
    this.append(observation)
  }

  encode() {
    return this.lines.map(line => JSON.stringify(line)).join('\n') + '\n'
  }

  finalState() {
    return this.snapshot()
  }

  /** Starts a diagnostic trace window from the current complete abstract state. */
  resetTraceWindow() {
    this.lines.length = 0
    this.sequence = 0
    this.append({ point: 'trace-init' })
  }

  private append(observation: Record<string, unknown>) {
    this.lines.push({
      schema: 'cordis.paper-trace/v1',
      tag: 'trace',
      sequence: ++this.sequence,
      scenario: this.scenario,
      implementation: this.implementation,
      assumptions: this.assumptions,
      observation,
      state: this.snapshot(),
    })
  }

  private snapshot(): AbstractState {
    const fibers = this.fibers
      .filter(fiber => !this.removed.has(fiber) && fiber.state !== this.fiberState.DISPOSED)
      .map<AbstractFiber>(fiber => {
        const id = this.fiberId(fiber)
        const lifecycle = this.lifecycle(fiber.state, fiber)
        const accumulator = [...this.iteratorStacks]
          .filter(([iterator]) => iterator.startsWith(`${id}:`))
          .map(([iterator, resources]) => ({ iterator, resources: [...resources] }))
          .filter(item => item.resources.length)
          .sort((left, right) => left.iterator.localeCompare(right.iterator))
        return {
          id,
          parent: fiber.parent?.fiber?.runtime ? this.fiberId(fiber.parent.fiber) : 'root',
          retired: this.retired.has(fiber),
          ...lifecycle,
          target: this.bindings(fiber, Object.values((fiber as any)._target ?? {})),
          committed: this.bindings(fiber, Object.values(fiber.store ?? {})),
          accumulator,
          inFlight: [],
        }
      })
      .sort(compareId)
    return {
      fibers,
      services: [...this.services.values()].sort((left, right) => left.key.localeCompare(right.key)),
      resources: [...this.resources.values()]
        .map(({ inverse: _inverse, ...resource }) => ({ ...resource }))
        .sort(compareId),
    }
  }

  private lifecycle(state: number, fiber: any) {
    const outcome = (fiber as any)._error ? 'error' as const : 'bottom' as const
    if (state === this.fiberState.LOADING) return { lifecycle: 'Reloading' as const, outcome }
    if (state === this.fiberState.ACTIVE) return { lifecycle: 'Active' as const, outcome }
    if (state === this.fiberState.UNLOADING) return { lifecycle: 'Unloading' as const, outcome }
    return { lifecycle: 'Inactive' as const, outcome: state === this.fiberState.FAILED ? 'error' as const : outcome }
  }

  private fiberId(fiber: any) {
    if (!fiber.runtime) return 'root'
    let id = this.fiberIds.get(fiber)
    if (id) return id
    const stem = String(fiber.runtime.name ?? 'fiber').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'fiber'
    const ordinal = (this.fiberNameCounters.get(stem) ?? 0) + 1
    this.fiberNameCounters.set(stem, ordinal)
    id = `${stem}#${ordinal}`
    this.fiberIds.set(fiber, id)
    return id
  }

  private realmId(name: string, realm: symbol) {
    let id = this.realmIds.get(realm)
    if (id) return id
    const ordinal = (this.realmNameCounters.get(name) ?? 0) + 1
    this.realmNameCounters.set(name, ordinal)
    id = `${name}-realm${ordinal}`
    this.realmIds.set(realm, id)
    return id
  }

  private serviceKey(name: string, realm: symbol) {
    return `${name}@${this.realmId(name, realm)}`
  }

  private bindings(fiber: any, implementations: any[]): Binding[] {
    return implementations.filter(implementation => implementation.name in fiber.inject).map(implementation => {
      const realm = fiber.ctx[this.contextClass.isolate][implementation.name] as symbol
      return {
        key: this.serviceKey(implementation.name, realm),
        provider: this.fiberId(implementation.fiber),
      }
    }).sort((left, right) => left.key.localeCompare(right.key))
  }

  private iteratorId(fiber: any, iterator: object) {
    let id = this.iteratorIds.get(iterator)
    if (id) return id
    const owner = this.fiberId(fiber)
    const ordinal = (this.iteratorCounters.get(owner) ?? 0) + 1
    this.iteratorCounters.set(owner, ordinal)
    id = `${owner}:iterator${ordinal}`
    this.iteratorIds.set(iterator, id)
    this.iteratorStacks.set(id, [])
    return id
  }

  private resourceFor(fiber: any, iterator: object, inverse: Function) {
    const known = this.inverseResources.get(inverse)
    if (known) return known
    const owner = this.fiberId(fiber)
    const ordinal = (this.resourceCounters.get(owner) ?? 0) + 1
    this.resourceCounters.set(owner, ordinal)
    const resource: ResourceRecord = {
      id: `${owner}:resource${ordinal}`,
      owner,
      iterator: this.iteratorId(fiber, iterator),
      status: 'installed',
      inverse,
    }
    this.inverseResources.set(inverse, resource)
    return resource
  }

  private resourceForUnknownIterator(fiber: any, inverse: Function) {
    const resource = this.inverseResources.get(inverse)
    if (!resource) throw new Error(`effect inverse was executed before collection for ${this.fiberId(fiber)}`)
    return resource
  }
}
