import assert, { AssertionError } from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Context, FiberState } from '../../packages/core/src/index.ts'

const value = (flag: string) => {
  const index = process.argv.indexOf(flag)
  return index < 0 ? undefined : process.argv[index + 1]
}

const tests = [
  {
    name: 'provider-resources-outlive-asynchronous-consumers',
    async run() {
      const root = new Context()
      const resource = { available: true }
      const observations: boolean[] = []
      const provider = await root.plugin((ctx) => {
        ctx.provide('resource', resource)
        ctx.effect(() => () => { resource.available = false }, 'provider resource')
      })
      await root.plugin({
        inject: ['resource'],
        apply(ctx) {
          void (ctx as any).resource
          return async () => {
            await Promise.resolve()
            observations.push(resource.available)
          }
        },
      })
      await provider.dispose()
      assert.deepEqual(observations, [true])
    },
  },
  {
    name: 'retiring-consumers-remain-discoverable',
    async run() {
      const root = new Context()
      const resource = { available: true }
      const started = Promise.withResolvers<void>()
      const barrier = Promise.withResolvers<void>()
      await root.plugin((ctx) => {
        ctx.provide('resource', resource)
        ctx.effect(() => () => { resource.available = false }, 'provider resource')
      })
      await root.plugin({
        inject: ['resource'],
        apply(ctx) {
          void (ctx as any).resource
          return async () => {
            started.resolve()
            await barrier.promise
          }
        },
      })
      const disposing = root.fiber.dispose()
      await started.promise
      await Promise.resolve()
      await Promise.resolve()
      const available = resource.available
      barrier.resolve()
      await disposing
      assert.equal(available, true)
    },
  },
  {
    name: 'disposal-invalidates-deferred-reload',
    async run() {
      const root = new Context()
      let applications = 0
      let cleanups = 0
      const fiber = root.plugin(() => { applications++ })
      fiber.ctx.effect(() => () => { cleanups++ }, 'loading cleanup')
      await fiber.dispose()
      assert.equal(applications, 0)
      assert.equal(cleanups, 1)
      assert.deepEqual(fiber.getEffects(), [])
    },
  },
  {
    name: 'awaited-provider-settles-transitive-activation',
    async run() {
      const root = new Context()
      let applications = 0
      root.plugin({
        inject: ['cli'],
        apply(ctx) { ctx.provide('yakumo', true) },
      })
      const consumer = root.plugin({
        inject: ['yakumo', 'cli'],
        apply() { applications++ },
      })
      await root.plugin(ctx => ctx.provide('cli', true))
      assert.equal(applications, 1)
      assert.equal(consumer.state, FiberState.ACTIVE)
    },
  },
]

const expectedFailures = tests.map(test => test.name)
const results: { name: string, status: 'pass' | 'expected-fail', message?: string }[] = []
for (const test of tests) {
  try {
    await test.run()
    results.push({ name: test.name, status: 'pass' })
  } catch (error) {
    if (!(error instanceof AssertionError)) throw error
    results.push({ name: test.name, status: 'expected-fail', message: error.message })
  }
}

const failures = results.filter(result => result.status === 'expected-fail').map(result => result.name)
assert.deepEqual(failures, expectedFailures, 'the unmodified behavior mismatch set changed')
const output = resolve(value('--output') ?? 'formal/output/baseline-behavior-report.json')
await writeFile(output, JSON.stringify({
  schema: 'cordis.paper-baseline-behavior/v1',
  implementation: {
    name: 'cordis',
    revision: value('--revision') ?? 'working-tree',
    role: 'upstream-unmodified',
  },
  expectedFailures,
  results,
}, null, 2) + '\n')
