#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const formalRoot = join(repository, 'formal')
const defaultOutput = join(formalRoot, 'output')
const defaultCache = join(formalRoot, '.cache')

const artifacts = [
  {
    name: 'TLA+ Tools',
    env: 'CORDIS_TLA_TOOLS_JAR',
    file: 'tla2tools-1.8.0.jar',
    url: 'https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar',
    sha256: 'ab323b79802aedc3203b3f9af37c6aca3ed43f4e0225b36f2aa77b26de46c05f',
  },
  {
    name: 'TLA+ CommunityModules',
    env: 'CORDIS_TLA_COMMUNITY_JAR',
    file: 'CommunityModules-202505152026.jar',
    url: 'https://repo1.maven.org/maven2/org/lamport/tla/community-modules/202505152026/community-modules-202505152026.jar',
    sha256: '044e8ecdfbca92d51d7eb4469422c2a7da1fe25dc8ad39c4a90e6622d6da4d99',
  },
]

const modules = [
  'CordisEffects',
  'CordisKernel',
  'CordisRuntime',
  'CordisConfluence',
  'CordisTrace',
]

const prModels = [
  { module: 'CordisEffects', config: 'CordisEffects.cfg', properties: ['WriteLocality', 'LifoRecovery', 'RecoveryExactness', 'IndependentExchangeInvariant'] },
  { module: 'CordisKernel', config: 'CordisKernel.cfg', properties: ['Preservation', 'RecoveryExactness', 'Ordering', 'ResolutionCoherence', 'Progress'] },
  { module: 'CordisKernel', config: 'CordisKernelNoFailure.cfg', properties: ['Preservation', 'RecoveryExactness', 'Ordering', 'ResolutionCoherence', 'Progress'] },
  { module: 'CordisRuntime', config: 'CordisRuntime.cfg', properties: ['RuntimeRefinesPaper'] },
  { module: 'CordisConfluence', config: 'CordisConfluence.cfg', properties: ['CanonicalTerminalEquality', 'EventuallyCanonical'] },
]

const nightlyModels = [
  { module: 'CordisEffects', config: 'nightly/CordisEffects.cfg', properties: ['WriteLocality', 'LifoRecovery', 'RecoveryExactness', 'IndependentExchangeInvariant'] },
  { module: 'CordisKernel', config: 'nightly/CordisKernel.cfg', properties: ['Preservation', 'RecoveryExactness', 'Ordering', 'ResolutionCoherence', 'Progress'] },
  { module: 'CordisKernel', config: 'nightly/CordisKernelNoFailure.cfg', properties: ['Preservation', 'RecoveryExactness', 'Ordering', 'ResolutionCoherence', 'Progress'] },
  { module: 'CordisRuntime', config: 'nightly/CordisRuntime.cfg', properties: ['RuntimeRefinesPaper'] },
  { module: 'CordisConfluence', config: 'nightly/CordisConfluence.cfg', properties: ['CanonicalTerminalEquality', 'EventuallyCanonical'] },
]

class CommandFailure extends Error {
  constructor(message, result) {
    super(message)
    this.result = result
  }
}

function flag(name, fallback) {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function hasFlag(name) {
  return process.argv.includes(name)
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function ensureArtifact(artifact, cacheRoot) {
  const override = process.env[artifact.env]
  const path = resolve(override || join(cacheRoot, artifact.file))
  if (await exists(path)) {
    assert.equal(await sha256(path), artifact.sha256, `${artifact.name} checksum mismatch: ${path}`)
    return path
  }
  if (override) throw new Error(`${artifact.env} does not exist: ${path}`)
  await mkdir(cacheRoot, { recursive: true })
  const temporary = `${path}.download`
  const response = await fetch(artifact.url)
  if (!response.ok) throw new Error(`failed to download ${artifact.name}: HTTP ${response.status}`)
  await writeFile(temporary, Buffer.from(await response.arrayBuffer()))
  assert.equal(await sha256(temporary), artifact.sha256, `${artifact.name} download checksum mismatch`)
  await rename(temporary, path)
  return path
}

async function toolchain() {
  const cacheRoot = resolve(flag('--cache', process.env.CORDIS_TLA_CACHE || defaultCache))
  const [tools, community] = await Promise.all(artifacts.map(artifact => ensureArtifact(artifact, cacheRoot)))
  return { tools, community, classpath: `${tools}:${community}` }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repository,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk
      if (!options.quiet) process.stdout.write(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
      if (!options.quiet) process.stderr.write(chunk)
    })
    let timedOut = false
    const timer = options.timeoutMs && setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref()
    }, options.timeoutMs)
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (timer) clearTimeout(timer)
      const result = { command, args, code: code ?? 1, stdout, stderr, timedOut }
      if ((code ?? 1) !== 0 && !options.allowFailure) {
        rejectPromise(new CommandFailure(`${command} exited with ${code}${timedOut ? ' after timeout' : ''}`, result))
      } else {
        resolvePromise(result)
      }
    })
  })
}

function modelStats(output) {
  const generated = [...output.matchAll(/([\d,]+) states generated, ([\d,]+) distinct states found/g)].at(-1)
  const depth = output.match(/depth of the complete state graph search is (\d+)/i)
  return {
    generatedStates: generated ? Number(generated[1].replaceAll(',', '')) : null,
    distinctStates: generated ? Number(generated[2].replaceAll(',', '')) : null,
    diameter: depth ? Number(depth[1]) : null,
  }
}

function failureDetails(output, extra = {}) {
  const theorem = output.match(/Invariant ([A-Za-z0-9_]+) is violated/)?.[1]
    ?? output.match(/The temporal property ([A-Za-z0-9_]+) is violated/)?.[1]
    ?? output.match(/Temporal property ([A-Za-z0-9_]+) was violated/)?.[1]
    ?? null
  const action = [...output.matchAll(/<([^>]+) line \d+, col \d+ to line \d+, col \d+ of module [^>]+>/g)].at(-1)?.[1] ?? null
  const traceLine = [...output.matchAll(/\/\\ cursor = (\d+)/g)].at(-1)?.[1] ?? null
  return { theorem, action, traceLine: traceLine ? Number(traceLine) : null, ...extra }
}

async function writeFailure(path, result, extra = {}) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify({
    schema: 'cordis.paper-failure/v1',
    ...failureDetails(`${result.stdout}\n${result.stderr}`, extra),
    exitCode: result.code,
    timedOut: result.timedOut,
    command: [result.command, ...result.args],
  }, null, 2) + '\n')
}

async function invokeTlc(tool, model, options = {}) {
  const outputRoot = resolve(options.outputRoot ?? defaultOutput)
  const label = options.label ?? model.module
  const metadir = join(outputRoot, 'tlc', label)
  const counterexample = join(outputRoot, 'counterexamples', `${label}.json`)
  await rm(metadir, { recursive: true, force: true })
  await mkdir(metadir, { recursive: true })
  await mkdir(dirname(counterexample), { recursive: true })
  const args = [
    '-XX:+UseParallelGC',
    '-cp', tool.classpath,
    'tlc2.TLC',
    '-workers', String(options.workers ?? 2),
    '-metadir', metadir,
    '-config', join(formalRoot, 'config', model.config),
    '-dumpTrace', 'json', counterexample,
    '-noGenerateSpecTE',
  ]
  if (options.deadlock === false) args.push('-deadlock')
  if (options.simulate) args.push('-simulate', `num=${options.simulate}`)
  args.push(join(formalRoot, `${model.module}.tla`))
  return run('java', args, {
    env: options.env,
    timeoutMs: options.timeoutMs,
    allowFailure: options.allowFailure,
    quiet: options.quiet,
  })
}

async function syntax() {
  const tool = await toolchain()
  for (const module of modules) {
    await run('java', ['-cp', tool.classpath, 'tla2sany.SANY', join(formalRoot, `${module}.tla`)])
  }
}

async function model(profile = 'pr') {
  const tool = await toolchain()
  const outputRoot = resolve(flag('--output', defaultOutput))
  const selected = profile === 'nightly' ? nightlyModels : prModels
  const timeoutMs = profile === 'nightly' ? 30 * 60 * 1_000 : 5 * 60 * 1_000
  const results = []
  for (const entry of selected) {
    const label = `${profile}-${entry.module}-${entry.config.replaceAll('/', '-').replace('.cfg', '')}`
    try {
      const result = await invokeTlc(tool, entry, { label, outputRoot, timeoutMs, quiet: hasFlag('--quiet') })
      const stats = modelStats(result.stdout)
      results.push({ name: label, status: 'pass', properties: Object.fromEntries(entry.properties.map(property => [property, 'pass'])), ...stats })
      if (profile === 'nightly' && stats.diameter !== null && stats.diameter < 10) {
        await invokeTlc(tool, entry, { label: `${label}-simulation`, outputRoot, timeoutMs, simulate: 100_000, quiet: hasFlag('--quiet') })
        results.at(-1).simulation = 'pass'
      }
    } catch (error) {
      if (!(error instanceof CommandFailure)) throw error
      await writeFailure(join(outputRoot, 'failures', `${label}.json`), error.result, { model: entry.module, config: entry.config })
      results.push({ name: label, status: 'fail', properties: Object.fromEntries(entry.properties.map(property => [property, 'fail'])), ...modelStats(error.result.stdout) })
      await writeFile(join(outputRoot, 'model-report.json'), JSON.stringify({ schema: 'cordis.paper-model-report/v1', profile, results }, null, 2) + '\n')
      throw error
    }
  }
  await mkdir(outputRoot, { recursive: true })
  await writeFile(join(outputRoot, 'model-report.json'), JSON.stringify({ schema: 'cordis.paper-model-report/v1', profile, results }, null, 2) + '\n')
}

async function revision() {
  const result = await run('git', ['rev-parse', 'HEAD'], { quiet: true })
  return result.stdout.trim()
}

async function generateTraces(outputRoot) {
  const traceRoot = join(outputRoot, 'traces')
  await rm(traceRoot, { recursive: true, force: true })
  const implementationRoot = resolve(flag('--implementation-root', join(repository, 'packages/core')))
  const implementationName = flag('--implementation-name', 'cordis')
  const implementationRevision = flag('--revision', await revision())
  const generatorArgs = [
    'yarn', 'tsx', join(formalRoot, 'harness/generate.ts'),
    '--repository', repository,
    '--implementation-root', implementationRoot,
    '--output', traceRoot,
    '--implementation-name', implementationName,
    '--revision', implementationRevision,
  ]
  const scenarioModule = flag('--scenario-module')
  if (scenarioModule) generatorArgs.push('--scenario-module', resolve(scenarioModule))
  const traceRuntimeRoot = resolve(flag('--trace-runtime-root', repository))
  if (traceRuntimeRoot === repository) {
    await run('corepack', generatorArgs, { timeoutMs: 5 * 60 * 1_000 })
  } else {
    const executor = join(traceRuntimeRoot, 'node_modules/.bin/tsx')
    await access(executor).catch(() => {
      throw new Error(`trace runtime has no tsx executable: ${executor}`)
    })
    await run(executor, [
      '--tsconfig', join(traceRuntimeRoot, 'tsconfig.json'),
      ...generatorArgs.slice(2),
    ], {
      cwd: traceRuntimeRoot,
      timeoutMs: 5 * 60 * 1_000,
    })
  }
  return { traceRoot, implementationRoot, implementationName, implementationRevision }
}

async function validateTrace(tool, path, outputRoot, options = {}) {
  const label = options.label ?? `trace-${path.split('/').at(-1).replace('.ndjson', '')}`
  return invokeTlc(tool, { module: 'CordisTrace', config: 'CordisTrace.cfg' }, {
    label,
    outputRoot,
    timeoutMs: 2 * 60 * 1_000,
    deadlock: false,
    env: { JSON: path },
    allowFailure: options.allowFailure,
    quiet: options.quiet,
  })
}

async function trace() {
  const tool = await toolchain()
  const outputRoot = resolve(flag('--output', defaultOutput))
  await mkdir(outputRoot, { recursive: true })
  const generated = await generateTraces(outputRoot)
  const generationReportPath = join(outputRoot, 'generation-report.json')
  const report = JSON.parse(await readFile(generationReportPath, 'utf8'))
  assert.ok(report.scenarios.length > 0, 'no core trace scenarios were generated')
  for (const scenario of report.scenarios) {
    const content = await readFile(scenario.trace, 'utf8')
    assert.ok(content.trim(), `${scenario.name} generated an empty trace`)
    try {
      const result = await validateTrace(tool, scenario.trace, outputRoot, { quiet: hasFlag('--quiet') })
      scenario.traceMatched = 'pass'
      scenario.tlc = modelStats(result.stdout)
      for (const property of Object.keys(scenario.properties)) scenario.properties[property] = 'pass'
    } catch (error) {
      if (!(error instanceof CommandFailure)) throw error
      scenario.traceMatched = 'fail'
      for (const property of Object.keys(scenario.properties)) scenario.properties[property] = 'fail'
      await writeFailure(join(outputRoot, 'failures', `trace-${scenario.name}.json`), error.result, {
        trace: relative(repository, scenario.trace),
        implementation: report.implementation,
      })
      await writeFile(join(outputRoot, 'conformance-report.json'), JSON.stringify(report, null, 2) + '\n')
      throw error
    }
  }
  for (const scenario of report.scenarios) {
    assert.equal(scenario.traceMatched, 'pass')
    assert.ok(Object.values(scenario.properties).every(status => status === 'pass'), `${scenario.name} has a required property without evidence`)
  }
  report.traceMatched = 'pass'
  report.generatedFrom = generated
  await writeFile(join(outputRoot, 'conformance-report.json'), JSON.stringify(report, null, 2) + '\n')
}

function cloneLines(lines) {
  return structuredClone(lines)
}

function fiberIn(line, id) {
  return line.state.fibers.find(fiber => fiber.id === id)
}

function mutateUnloadGuard(lines) {
  const changed = cloneLines(lines)
  const inverse = changed.findIndex(line => line.observation.point === 'inverse-started' && line.observation.fiber === 'provider#1')
  assert.ok(inverse > 0, 'provider inverse observation was not found')
  const inactive = changed.findLastIndex((line, index) => index < inverse
    && line.observation.point === 'state-changed'
    && line.observation.fiber === 'consumer#1'
    && line.observation.current === 'Inactive')
  assert.ok(inactive >= 0, 'consumer inactive observation was not found')
  changed[inactive].observation.current = 'Unloading'
  fiberIn(changed[inactive], 'consumer#1').lifecycle = 'Unloading'
  fiberIn(changed[inverse], 'consumer#1').lifecycle = 'Unloading'
  return changed
}

function mutateProviderIdentity(lines) {
  const changed = cloneLines(lines)
  const index = changed.findIndex(line => line.observation.point === 'committed-changed'
    && line.observation.fiber === 'consumer#1'
    && line.observation.current?.some(binding => binding.provider === 'provider#2'))
  assert.ok(index >= 0, 'replacement commit observation was not found')
  const replace = bindings => bindings.map(binding => binding.provider === 'provider#2' ? { ...binding, provider: 'provider#1' } : binding)
  changed[index].observation.current = replace(changed[index].observation.current)
  fiberIn(changed[index], 'consumer#1').committed = replace(fiberIn(changed[index], 'consumer#1').committed)
  return changed
}

function mutateFifo(lines) {
  const changed = cloneLines(lines)
  const index = changed.findIndex(line => line.observation.point === 'inverse-started' && line.observation.fiber === 'generator#1')
  assert.ok(index > 0, 'generator inverse observation was not found')
  const stack = fiberIn(changed[index - 1], 'generator#1').accumulator.find(entry => entry.iterator === changed[index].observation.iterator).resources
  assert.ok(stack.length > 1, 'generator trace has no distinct FIFO candidate')
  const first = stack[0]
  const original = changed[index].observation.resource
  changed[index].observation.resource = first
  for (const resource of changed[index].state.resources) {
    if (resource.id === original) resource.status = 'installed'
    if (resource.id === first) resource.status = 'restoring'
  }
  return changed
}

function mutateStaleCommitted(lines) {
  const changed = cloneLines(lines)
  const index = changed.findIndex(line => line.observation.point === 'state-changed'
    && line.observation.fiber === 'consumer#1'
    && line.observation.current === 'Inactive')
  assert.ok(index >= 0, 'consumer inactive observation was not found')
  fiberIn(changed[index], 'consumer#1').committed = [{ key: 'service@service-realm1', provider: 'provider#1' }]
  return changed
}

async function readTrace(path) {
  return (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
}

async function writeTrace(path, lines) {
  await writeFile(path, lines.map(line => JSON.stringify(line)).join('\n') + '\n')
}

async function mutation() {
  const tool = await toolchain()
  const outputRoot = resolve(flag('--output', defaultOutput))
  const traceRoot = join(outputRoot, 'traces')
  if (!(await exists(join(traceRoot, 'provider-consumer-reverse-exit.ndjson')))) await generateTraces(outputRoot)
  const definitions = [
    { name: 'remove-unload-guard', source: 'async-consumer-teardown-guard.ndjson', mutate: mutateUnloadGuard },
    { name: 'compare-target-by-value', source: 'provider-identity-replacement.ndjson', mutate: mutateProviderIdentity },
    { name: 'fifo-recovery', source: 'generator-lifo-recovery.ndjson', mutate: mutateFifo },
    { name: 'stale-committed-provider', source: 'provider-consumer-reverse-exit.ndjson', mutate: mutateStaleCommitted },
  ]
  const mutationRoot = join(outputRoot, 'mutations')
  await mkdir(mutationRoot, { recursive: true })
  const results = []
  for (const definition of definitions) {
    const source = join(traceRoot, definition.source)
    const path = join(mutationRoot, `${definition.name}.ndjson`)
    await writeTrace(path, definition.mutate(await readTrace(source)))
    const result = await validateTrace(tool, path, outputRoot, {
      label: `mutation-${definition.name}`,
      allowFailure: true,
      quiet: true,
    })
    const output = `${result.stdout}\n${result.stderr}`
    const rejected = result.code !== 0 && /Invariant .*violated|Temporal propert(?:y .* was|ies were) violated|is violated by the initial state|Deadlock reached/i.test(output)
    if (!rejected) throw new Error(`${definition.name} mutant was not rejected by semantic model checking`)
    await writeFailure(join(outputRoot, 'failures', `mutation-${definition.name}.json`), result, { mutation: definition.name, trace: relative(repository, path) })
    results.push({ name: definition.name, status: 'rejected', trace: path, ...failureDetails(output) })
    process.stdout.write(`mutation ${definition.name}: rejected\n`)
  }
  await writeFile(join(outputRoot, 'mutation-report.json'), JSON.stringify({ schema: 'cordis.paper-mutation-report/v1', results }, null, 2) + '\n')
}

async function observation() {
  await run('node', [join(formalRoot, 'tools/verify-observation.mjs')])
}

async function check() {
  await syntax()
  await model('pr')
  await observation()
  await trace()
  await mutation()
}

async function main() {
  const command = process.argv[2] ?? 'check'
  if (hasFlag('--help') || command === 'help') {
    process.stdout.write('usage: node formal/tools/run.mjs <syntax|model|trace|mutation|check|nightly> [--implementation-root path] [--scenario-module path] [--trace-runtime-root path] [options]\n')
    return
  }
  if (command === 'syntax') return syntax()
  if (command === 'model') return model(flag('--profile', 'pr'))
  if (command === 'trace') return trace()
  if (command === 'mutation') return mutation()
  if (command === 'check') return check()
  if (command === 'nightly') {
    await syntax()
    await model('nightly')
    await observation()
    await trace()
    await mutation()
    return
  }
  throw new Error(`unknown formal command: ${command}`)
}

await main()
