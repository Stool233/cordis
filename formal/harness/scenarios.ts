import assert from 'node:assert/strict'
import type { AbstractState, CordisPaperTraceRecorder, TraceAssumptions } from './recorder.ts'

export interface CordisImplementation {
  Context: new () => any
  FiberState: Record<string, number>
  installCordisPaperTraceSink(ctx: any, sink: (event: any) => void): () => void
}

export interface ScenarioDefinition {
  name: string
  assumptions: TraceAssumptions
  requiredProperties: string[]
  run(implementation: CordisImplementation, recorder: CordisPaperTraceRecorder): Promise<void>
}

export const allAssumptions: TraceAssumptions = {
  AcyclicDependencies: true,
  FiniteNames: true,
  BoundedIterator: true,
  PairwiseIndependent: true,
  TotalProvision: true,
  NoFailure: true,
}

const requiredSafety = [
  'Preservation',
  'RecoveryExactness',
  'Ordering',
  'ResolutionCoherence',
  'ProgressBound',
]

const named = (name: string, apply: Function, extra: Record<string, unknown> = {}) => ({ name, apply, ...extra })
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export const scenarios: ScenarioDefinition[] = [
  {
    name: 'provider-consumer-reverse-exit',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const order: string[] = []
      const Provider = named('provider', (ctx: any) => {
        ctx.provide('service', { value: 1 })
        return () => order.push('provider')
      })
      const Consumer = named('consumer', (ctx: any) => {
        void ctx.service
        return () => order.push('consumer')
      }, { inject: ['service'] })
      const provider = await root.plugin(Provider)
      await root.plugin(Consumer)
      await provider.dispose()
      assert.deepEqual(order, ['consumer', 'provider'])
    },
  },
  {
    name: 'async-consumer-teardown-guard',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const resource = { available: true }
      const observed: boolean[] = []
      const Provider = named('provider', (ctx: any) => {
        ctx.provide('service', resource)
        ctx.effect(() => () => {
          resource.available = false
        }, 'backing resource')
      })
      const Consumer = named('consumer', (ctx: any) => {
        void ctx.service
        return async () => {
          await Promise.resolve()
          observed.push(resource.available)
        }
      }, { inject: ['service'] })
      const provider = await root.plugin(Provider)
      await root.plugin(Consumer)
      await provider.dispose()
      assert.deepEqual(observed, [true])
      assert.equal(resource.available, false)
    },
  },
  {
    name: 'concurrent-root-teardown-guard',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const resource = { available: true }
      const observed: boolean[] = []
      let cleanupStarted!: () => void
      let releaseCleanup!: () => void
      const started = new Promise<void>(resolve => { cleanupStarted = resolve })
      const barrier = new Promise<void>(resolve => { releaseCleanup = resolve })
      const Provider = named('provider', (ctx: any) => {
        ctx.provide('service', resource)
        ctx.effect(() => () => {
          resource.available = false
        }, 'backing resource')
      })
      const Consumer = named('consumer', (ctx: any) => {
        void ctx.service
        return async () => {
          cleanupStarted()
          await barrier
          observed.push(resource.available)
        }
      }, { inject: ['service'] })
      await root.plugin(Provider)
      await root.plugin(Consumer)
      const disposing = root.fiber.dispose()
      await started
      await Promise.resolve()
      await Promise.resolve()
      assert.equal(resource.available, true)
      releaseCleanup()
      await disposing
      assert.deepEqual(observed, [true])
      assert.equal(resource.available, false)
    },
  },
  {
    name: 'provider-identity-replacement',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const shared = { value: 1 }
      const seen: any[] = []
      const Provider = named('provider', (ctx: any) => ctx.provide('service', shared))
      const Consumer = named('consumer', (ctx: any) => {
        seen.push(ctx.service)
      }, { inject: ['service'] })
      const first = await root.plugin(Provider)
      const consumer = root.plugin(Consumer)
      await consumer
      await first.dispose()
      const second = await root.plugin(Provider)
      await consumer
      assert.equal(seen.length, 2)
      assert.equal(seen[0], seen[1])
      const commits = recorder.lines.filter(line => line.observation.point === 'committed-changed' && line.observation.fiber === 'consumer#1')
      const providers = commits.flatMap(line => ((line.observation.current as { provider: string }[]) ?? []).map(binding => binding.provider))
      assert.deepEqual(providers, ['provider#1', 'provider#2'])
      await second.dispose()
    },
  },
  {
    name: 'dependency-loss-during-iteration',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      let release!: () => void
      const barrier = new Promise<void>(resolve => { release = resolve })
      let restored = 0
      const Provider = named('provider', (ctx: any) => ctx.provide('service', 1))
      const Consumer = named('consumer', async function* (ctx: any) {
        void ctx.service
        await barrier
        yield () => { restored++ }
      }, { inject: ['service'] })
      const provider = await root.plugin(Provider)
      const consumer = root.plugin(Consumer)
      await flush()
      const disposal = provider.dispose()
      release()
      await disposal
      await consumer.await()
      assert.equal(restored, 1)
    },
  },
  {
    name: 'dependency-return-during-unload',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      let release!: () => void
      let cleanupStarted!: () => void
      const cleanupBarrier = new Promise<void>(resolve => { release = resolve })
      const started = new Promise<void>(resolve => { cleanupStarted = resolve })
      const disposeFirst = root.provide('service', 1)
      const Consumer = named('consumer', (ctx: any) => {
        void ctx.service
        return async () => {
          cleanupStarted()
          await cleanupBarrier
        }
      }, { inject: ['service'] })
      const consumer = await root.plugin(Consumer)
      const unloading = disposeFirst()
      await started
      root.provide('service', 2)
      release()
      await unloading
      await consumer
      assert.equal(consumer.state, recorder.fiberState.ACTIVE)
    },
  },
  {
    name: 'generator-lifo-recovery',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const restored: number[] = []
      const Generator = named('generator', function* () {
        yield () => restored.push(1)
        yield () => restored.push(2)
        yield () => restored.push(3)
      })
      const fiber = await root.plugin(Generator)
      await fiber.dispose()
      assert.deepEqual(restored, [3, 2, 1])
    },
  },
  {
    name: 'top-level-concurrent-recovery',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const restored: string[] = []
      let active = 0
      let maximum = 0
      const recover = async (label: string) => {
        restored.push(`${label}:start`)
        maximum = Math.max(maximum, ++active)
        await Promise.resolve()
        restored.push(`${label}:end`)
        active--
      }
      const Plugin = named('top-level-effects', (ctx: any) => {
        ctx.effect(() => () => recover('first'), 'first')
        ctx.effect(() => () => recover('second'), 'second')
      })
      const fiber = await root.plugin(Plugin)
      await fiber.dispose()
      assert.deepEqual(restored, ['second:start', 'first:start', 'second:end', 'first:end'])
      assert.equal(maximum, 2)
    },
  },
  {
    name: 'partial-install-failure-rollback',
    assumptions: { ...allAssumptions, NoFailure: false },
    requiredProperties: ['Preservation', 'RecoveryExactness'],
    async run({ FiberState }, recorder) {
      const root = recorder.root
      const restored: number[] = []
      ;(root.logger as any).error = () => {}
      const Failing = named('failing', function* () {
        yield () => restored.push(1)
        throw new Error('expected scenario failure')
      })
      const Sibling = named('sibling', () => () => {})
      const failing = root.plugin(Failing)
      const sibling = await root.plugin(Sibling)
      await assert.rejects(failing.await())
      assert.deepEqual(restored, [1])
      assert.equal(sibling.state, FiberState.ACTIVE)
    },
  },
  {
    name: 'nested-registration-cascade',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run({ FiberState }, recorder) {
      const root = recorder.root
      let child: any
      const Child = named('child', () => () => {})
      const Parent = named('parent', (ctx: any) => {
        child = ctx.plugin(Child)
      })
      const parent = await root.plugin(Parent)
      await child
      await parent.dispose()
      assert.equal(child.state, FiberState.DISPOSED)
    },
  },
  {
    name: 'isolation-realms',
    assumptions: allAssumptions,
    requiredProperties: requiredSafety,
    async run(_implementation, recorder) {
      const root = recorder.root
      const left = root.isolate('service')
      const right = root.isolate('service')
      const seen: number[] = []
      const Provider = named('provider', (ctx: any, value: number) => ctx.provide('service', value))
      const Consumer = named('consumer', (ctx: any) => { seen.push(ctx.service) }, { inject: ['service'] })
      await left.plugin(Provider, 1)
      await right.plugin(Provider, 2)
      await left.plugin(Consumer)
      await right.plugin(Consumer)
      assert.deepEqual(seen, [1, 2])
    },
  },
]

export const preconditionScenarios = [
  {
    name: 'cyclic-dependencies',
    assumptions: { ...allAssumptions, AcyclicDependencies: false },
    property: 'Progress',
  },
  {
    name: 'non-independent-effects',
    assumptions: { ...allAssumptions, PairwiseIndependent: false },
    property: 'Confluence',
  },
  {
    name: 'non-total-provision',
    assumptions: { ...allAssumptions, TotalProvision: false },
    property: 'Progress',
  },
]

export function canonicalState(state: AbstractState) {
  return JSON.stringify(state)
}
