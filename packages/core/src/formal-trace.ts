import type { Context } from './context'
import type { Disposable, Fiber, FiberState } from './fiber'
import type { Impl } from './reflect'

const paperTraceSink = Symbol.for('cordis.paper-trace.sink')

/** An internal observation emitted at a mutation relevant to the paper model. */
export type CordisPaperTraceEvent =
  | { kind: 'fiber-created', fiber: Fiber, parent: Fiber }
  | { kind: 'fiber-retired', fiber: Fiber }
  | { kind: 'fiber-removed', fiber: Fiber }
  | { kind: 'target-changed', fiber: Fiber, previous: readonly Impl[], current: readonly Impl[] }
  | { kind: 'state-changed', fiber: Fiber, previous: FiberState, current: FiberState }
  | { kind: 'committed-changed', fiber: Fiber, previous: readonly Impl[], current: readonly Impl[] }
  | { kind: 'iteration-landed', fiber: Fiber, iterator: object, done: boolean, inverse?: Disposable }
  | { kind: 'iteration-raised', fiber: Fiber, iterator: object, reason: unknown }
  | { kind: 'inverse-collected', fiber: Fiber, iterator: object, inverse: Disposable }
  | { kind: 'inverse-started', fiber: Fiber, inverse: Disposable, structural: boolean }
  | { kind: 'inverse-finished', fiber: Fiber, inverse: Disposable, structural: boolean, failed: boolean }
  | { kind: 'service-provided', fiber: Fiber, implementation: Impl, realm: symbol }
  | { kind: 'service-withdrawing', fiber: Fiber, implementation: Impl, realm: symbol }
  | { kind: 'service-withdrawn', fiber: Fiber, implementation: Impl, realm: symbol }

/** A synchronous, root-scoped consumer for source-only paper conformance tests. */
export type CordisPaperTraceSink = (event: CordisPaperTraceEvent) => void

type TraceRoot = Context & {
  [paperTraceSink]?: CordisPaperTraceSink
}

/** Installs one internal trace sink on a root context and returns its disposer. */
export function installCordisPaperTraceSink(ctx: Context, sink: CordisPaperTraceSink) {
  const root = ctx.root as TraceRoot
  if (root[paperTraceSink]) {
    throw new Error('a Cordis paper trace sink is already installed on this root context')
  }
  Object.defineProperty(root, paperTraceSink, {
    configurable: true,
    value: sink,
  })
  return () => {
    if (root[paperTraceSink] === sink) {
      delete root[paperTraceSink]
    }
  }
}

/** Emits an internal observation synchronously when a trace sink is installed. */
export function emitCordisPaperTrace(ctx: Context, event: CordisPaperTraceEvent) {
  const sink = (ctx.root as TraceRoot)[paperTraceSink]
  sink?.(event)
}
