import { Context, FiberState, Service } from '../src'
import { expect, describe, it, vi } from 'vitest'
import { mock } from 'node:test'
import { event, sleep, withTimers } from './utils'

describe('Fiber', () => {
  it('inertia lock 1', withTimers(async (root) => {
    const dispose = root.provide('foo', 1)
    const fiber = root.inject(['foo'], async () => {
      await sleep(1000)
      return () => sleep(1000)
    })
    await vi.advanceTimersByTimeAsync(400) // 400
    expect(fiber.state).to.equal(FiberState.LOADING)
    dispose()
    await vi.advanceTimersByTimeAsync(400) // 800
    expect(fiber.state).to.equal(FiberState.LOADING)
    await vi.advanceTimersByTimeAsync(400) // 1200
    expect(fiber.state).to.equal(FiberState.UNLOADING)
    root.provide('foo', 1)
    await vi.advanceTimersByTimeAsync(1000) // 2200
    expect(fiber.state).to.equal(FiberState.LOADING)
    await vi.advanceTimersByTimeAsync(1000) // 3200
    expect(fiber.state).to.equal(FiberState.ACTIVE)
  }))

  it('inertia lock 2', withTimers(async (root) => {
    const dispose = root.provide('foo', 1)
    const fiber = root.inject(['foo'], async () => {
      await sleep(1000)
      return () => sleep(1000)
    })
    await vi.advanceTimersByTimeAsync(400) // 400
    expect(fiber.state).to.equal(FiberState.LOADING)
    dispose()
    await vi.advanceTimersByTimeAsync(400) // 800
    expect(fiber.state).to.equal(FiberState.LOADING)
    root.provide('foo', 2)
    await vi.advanceTimersByTimeAsync(400) // 1200
    expect(fiber.state).to.equal(FiberState.ACTIVE)
  }))

  it('inertia lock 3', withTimers(async (root) => {
    class Foo extends Service {
      constructor(ctx: Context) {
        super(ctx, 'foo')
      }
    }
    const provider = await root.plugin(Foo)
    const fiber = root.inject(['foo'], async () => {
      await sleep(1000)
      return () => sleep(1000)
    })
    await vi.advanceTimersByTimeAsync(400) // 400
    expect(fiber.state).to.equal(FiberState.LOADING)
    await vi.runAllTimersAsync() // 1000
    expect(fiber.state).to.equal(FiberState.ACTIVE)
    await Promise.all([
      provider.dispose(),
      vi.runAllTimersAsync(), // 2000
    ])
    expect(fiber.state).to.equal(FiberState.PENDING)
  }))

  it('keeps provider resources until asynchronous consumers finish unloading', async () => {
    const root = new Context()
    const resource = { available: true }
    const observations: boolean[] = []

    const provider = await root.plugin((ctx) => {
      ctx.provide('resource', resource)
      ctx.effect(() => () => {
        resource.available = false
      }, 'provider resource')
    })
    const consumer = await root.plugin({
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

    expect(observations).to.deep.equal([true])
    expect(resource.available).to.equal(false)
    expect(consumer.state).to.equal(FiberState.PENDING)
  })

  it('keeps retiring consumers discoverable during concurrent root disposal', async () => {
    const root = new Context()
    const resource = { available: true }
    const observations: boolean[] = []
    let cleanupStarted!: () => void
    let releaseCleanup!: () => void
    const started = new Promise<void>(resolve => { cleanupStarted = resolve })
    const barrier = new Promise<void>(resolve => { releaseCleanup = resolve })

    await root.plugin((ctx) => {
      ctx.provide('resource', resource)
      ctx.effect(() => () => {
        resource.available = false
      }, 'provider resource')
    })
    await root.plugin({
      inject: ['resource'],
      apply(ctx) {
        void (ctx as any).resource
        return async () => {
          cleanupStarted()
          await barrier
          observations.push(resource.available)
        }
      },
    })

    const disposing = root.fiber.dispose()
    try {
      await started
      await Promise.resolve()
      await Promise.resolve()
      expect(resource.available).to.equal(true)
    } finally {
      releaseCleanup()
      await disposing
    }

    expect(observations).to.deep.equal([true])
    expect(resource.available).to.equal(false)
  })

  it('drains effects when disposal wins the deferred reload checkpoint', async () => {
    const root = new Context()
    const cleanup = mock.fn()
    const apply = mock.fn()
    const fiber = root.plugin(apply)
    fiber.ctx.effect(() => cleanup, 'loading cleanup')

    await fiber.dispose()

    expect(apply.mock.calls).to.have.length(0)
    expect(cleanup.mock.calls).to.have.length(1)
    expect(fiber.getEffects()).to.deep.equal([])
    expect(fiber.state).to.equal(FiberState.DISPOSED)
  })

  it('settles transitive service activation before an awaited provider returns', async () => {
    const root = new Context()
    const command = mock.fn()

    root.plugin({
      inject: ['cli'],
      apply(ctx) {
        ctx.provide('yakumo', true)
      },
    })
    const commandFiber = root.plugin({
      inject: ['yakumo', 'cli'],
      apply: command,
    })

    await root.plugin(ctx => ctx.provide('cli', true))

    expect(command.mock.calls).to.have.length(1)
    expect(commandFiber.state).to.equal(FiberState.ACTIVE)
  })

  it('starts independent top-level recovery concurrently in reverse order', async () => {
    const root = new Context()
    const order: string[] = []
    let active = 0
    let maximum = 0
    const recover = async (label: string) => {
      order.push(`${label}:start`)
      maximum = Math.max(maximum, ++active)
      await Promise.resolve()
      order.push(`${label}:end`)
      active--
    }
    const fiber = await root.plugin((ctx) => {
      ctx.effect(() => () => recover('first'), 'first')
      ctx.effect(() => () => recover('second'), 'second')
    })

    await fiber.dispose()

    expect(order).to.deep.equal([
      'second:start',
      'first:start',
      'second:end',
      'first:end',
    ])
    expect(maximum).to.equal(2)
  })

  it('plugin error', async () => {
    const root = new Context()
    const callback = mock.fn()
    const error = mock.fn()
    ;(root.logger as any).error = error
    const apply = mock.fn((ctx: Context, config: { foo?: boolean } | undefined) => {
      ctx.on(event, callback)
      if (!config?.foo) throw new Error('plugin error')
    })

    const fiber1 = root.plugin(apply)
    const fiber2 = root.plugin(apply, { foo: true })
    await sleep()
    expect(fiber1.state).to.equal(FiberState.FAILED)
    expect(fiber2.state).to.equal(FiberState.ACTIVE)
    // expect(apply.mock.calls).to.have.length(2)
    expect(error.mock.calls).to.have.length(1)

    root.emit(event)
    expect(callback.mock.calls).to.have.length(1)
  })

  it('failed fiber does not re-enter on dependency refresh', async () => {
    const root = new Context()
    ;(root.logger as any).error = mock.fn()
    const apply = mock.fn(() => { throw new Error('boom') })
    const dispose = root.provide('foo', 1)
    const fiber = root.inject(['foo'], apply)
    await sleep()
    expect(fiber.state).to.equal(FiberState.FAILED)
    await dispose()
    root.provide('foo', 2)
    await sleep()
    expect(apply.mock.calls).to.have.length(1)
    expect(fiber.state).to.equal(FiberState.FAILED)
  })

  it('update recovers a failed fiber', async () => {
    const root = new Context()
    ;(root.logger as any).error = mock.fn()
    const apply = mock.fn(() => { throw new Error('boom') })
    root.provide('foo', 1)
    const fiber = root.inject(['foo'], apply)
    await sleep()
    expect(fiber.state).to.equal(FiberState.FAILED)
    apply.mock.mockImplementationOnce(() => {})
    fiber.update()
    await fiber
    expect(apply.mock.calls).to.have.length(2)
    expect(fiber.state).to.equal(FiberState.ACTIVE)
  })

  it('update surfaces a failed reload to its caller', async () => {
    const root = new Context()
    ;(root.logger as any).error = mock.fn()
    const apply = mock.fn(() => {})
    const fiber = root.plugin(apply)
    await fiber
    apply.mock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await expect(fiber.update({})).rejects.toThrow('boom')
    expect(fiber.state).to.equal(FiberState.FAILED)
  })

  // the fiber reports the failure itself, so a caller that never asks for the
  // result must not be punished with an unhandled rejection
  it('update does not leak a dropped failure', async () => {
    const root = new Context()
    ;(root.logger as any).error = mock.fn()
    const apply = mock.fn(() => {})
    const fiber = root.plugin(apply)
    await fiber
    apply.mock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    fiber.update({})
    await sleep()
    expect(fiber.state).to.equal(FiberState.FAILED)
  })

  it('dispose error', async () => {
    const root = new Context()
    const error = mock.fn()
    ;(root.logger as any).error = error
    const dispose = mock.fn(() => {
      throw new Error('test')
    })
    const plugin = (ctx: Context) => {
      return dispose
    }

    const fiber = await root.plugin(plugin)
    expect(dispose.mock.calls).to.have.length(0)
    await expect(fiber.dispose()).resolves.toBeUndefined()
    await sleep()
    expect(dispose.mock.calls).to.have.length(1)
    expect(error.mock.calls).to.have.length(1)
  })

  it('update config on wrapped fiber', async () => {
    const root = new Context()
    const callback = mock.fn()

    const fiber = root.plugin(callback, { msg: 'hello' })
    await fiber
    expect(callback.mock.calls).to.have.length(1)
    expect(callback.mock.calls[0].arguments[1]).to.deep.equal({ msg: 'hello' })

    fiber.update({ msg: 'world' })
    await fiber
    expect(callback.mock.calls).to.have.length(2)
    expect(callback.mock.calls[1].arguments[1]).to.deep.equal({ msg: 'world' })

    fiber.update({ msg: '!!!' })
    await fiber
    expect(callback.mock.calls).to.have.length(3)
    expect(callback.mock.calls[2].arguments[1]).to.deep.equal({ msg: '!!!' })
  })

  it('restart wrapped fiber', async () => {
    const root = new Context()
    const callback = mock.fn()
    const fiber = root.plugin(callback)

    await fiber
    await fiber.restart()

    expect(callback.mock.calls).to.have.length(2)
    expect(fiber.state).to.equal(FiberState.ACTIVE)
    expect(Object.hasOwn(fiber, 'state')).to.equal(false)
    expect(Object.hasOwn(fiber, 'inertia')).to.equal(false)
  })

  it('update config while injected service reloads', async () => {
    const applied: [number, string][] = []

    class Provider extends Service {
      value: number

      constructor(ctx: Context, config: { value: number }) {
        super(ctx, 'provider')
        this.value = config.value
      }
    }

    const Consumer = {
      inject: ['provider'],
      apply(ctx: Context, config: { mode: string }) {
        applied.push([(ctx as any).provider.value, config.mode])
      },
    }

    const root = new Context()
    const provider = root.plugin(Provider, { value: 1 })
    const consumer = root.plugin(Consumer, { mode: 'old' })

    await provider
    await consumer

    provider.update({ value: 2 })
    consumer.update({ mode: 'new' })

    await Promise.all([provider.await(), consumer.await()])

    const base = Object.getPrototypeOf(consumer)
    expect(applied).to.deep.equal([
      [1, 'old'],
      [2, 'new'],
    ])
    expect(consumer.config).to.equal(base.config)
    expect(consumer.state).to.equal(base.state)
    expect(consumer.state).to.equal(FiberState.ACTIVE)
    expect(Object.hasOwn(consumer, 'config')).to.equal(false)
    expect(Object.hasOwn(consumer, 'state')).to.equal(false)
    expect(Object.hasOwn(consumer, 'inertia')).to.equal(false)
  })
})
