import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { CordisPaperTraceRecorder, type TraceImplementation } from './recorder.ts'
import { allAssumptions, canonicalState, preconditionScenarios, scenarios as coreScenarios, type CordisImplementation, type ScenarioDefinition } from './scenarios.ts'
import { evidenceReference } from '../tools/report-paths.mjs'

interface Options {
  implementationRoot: string
  output: string
  implementationName: string
  implementationRole: string
  revision: string
  scenarioModule?: string
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index < 0 ? undefined : argv[index + 1]
  }
  const repository = resolve(value('--repository') ?? process.cwd())
  return {
    implementationRoot: resolve(value('--implementation-root') ?? join(repository, 'packages/core')),
    output: resolve(value('--output') ?? join(repository, 'formal/output/traces')),
    implementationName: value('--implementation-name') ?? 'cordis',
    implementationRole: value('--implementation-role') ?? 'upstream',
    revision: value('--revision') ?? 'working-tree',
    scenarioModule: value('--scenario-module') ? resolve(value('--scenario-module')!) : undefined,
  }
}

async function loadImplementation(root: string): Promise<{ api: CordisImplementation, version: string }> {
  const source = join(root, 'src')
  const [core, trace, packageJson] = await Promise.all([
    import(pathToFileURL(join(source, 'index.ts')).href),
    import(pathToFileURL(join(source, 'formal-trace.ts')).href),
    readFile(join(root, 'package.json'), 'utf8').then(JSON.parse),
  ])
  const FiberState = core.FiberState ?? {
    PENDING: 0,
    LOADING: 1,
    ACTIVE: 2,
    FAILED: 3,
    DISPOSED: 4,
    UNLOADING: 5,
  }
  return {
    api: {
      Context: core.Context,
      FiberState,
      installCordisPaperTraceSink: trace.installCordisPaperTraceSink,
    },
    version: packageJson.version,
  }
}

async function capture(
  definition: ScenarioDefinition,
  api: CordisImplementation,
  implementation: TraceImplementation,
) {
  const root = new api.Context()
  const recorder = new CordisPaperTraceRecorder(
    root,
    api.Context,
    api.FiberState,
    definition.name,
    definition.assumptions,
    implementation,
  )
  const uninstall = api.installCordisPaperTraceSink(root, recorder.sink)
  try {
    await definition.run(api, recorder)
  } finally {
    uninstall()
  }
  assert.ok(recorder.lines.length > 1, `${definition.name} produced an empty trace`)
  return recorder
}

async function captureConfluence(api: CordisImplementation, implementation: TraceImplementation, schedule: 'left' | 'right') {
  const definition: ScenarioDefinition = {
    name: `confluence-${schedule}`,
    assumptions: allAssumptions,
    requiredProperties: ['Confluence'],
    async run(_api, recorder) {
      const root = recorder.root
      const ProviderA = { name: 'provider-a', apply: (ctx: any) => ctx.provide('a', 1) }
      const ProviderB = { name: 'provider-b', apply: (ctx: any) => ctx.provide('b', 2) }
      const ConsumerA = { name: 'consumer-a', inject: ['a'], apply: (ctx: any) => { void ctx.a } }
      const ConsumerB = { name: 'consumer-b', inject: ['b'], apply: (ctx: any) => { void ctx.b } }
      if (schedule === 'left') {
        await root.plugin(ProviderA)
        await root.plugin(ConsumerA)
        await root.plugin(ProviderB)
        await root.plugin(ConsumerB)
      } else {
        await root.plugin(ProviderB)
        await root.plugin(ProviderA)
        await root.plugin(ConsumerB)
        await root.plugin(ConsumerA)
      }
    },
  }
  return { definition, recorder: await capture(definition, api, implementation) }
}

function propertyStatuses(definition: ScenarioDefinition) {
  return Object.fromEntries(definition.requiredProperties.map(property => [property, 'pending-trace-validation']))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { api, version } = await loadImplementation(options.implementationRoot)
  const extraScenarios: ScenarioDefinition[] = options.scenarioModule
    ? (await import(pathToFileURL(options.scenarioModule).href)).scenarios
    : []
  assert.ok(Array.isArray(extraScenarios), 'extra scenario module must export a scenarios array')
  const scenarios = [...coreScenarios, ...extraScenarios]
  assert.equal(new Set(scenarios.map(scenario => scenario.name)).size, scenarios.length, 'scenario names must be unique')
  const implementation = {
    name: options.implementationName,
    version,
    revision: options.revision,
  }
  await mkdir(options.output, { recursive: true })

  const report: any = {
    schema: 'cordis.paper-conformance-report/v1',
    generatedFrom: { ...implementation, role: options.implementationRole },
    generatedBy: basename(import.meta.url),
    scenarios: [],
    prerequisites: preconditionScenarios.map(item => ({
      name: item.name,
      assumptions: item.assumptions,
      properties: { [item.property]: 'not-applicable' },
    })),
  }

  for (const definition of scenarios) {
    const first = await capture(definition, api, implementation)
    const second = await capture(definition, api, implementation)
    assert.equal(second.encode(), first.encode(), `${definition.name} trace is not byte-stable`)
    const file = join(options.output, `${definition.name}.ndjson`)
    await writeFile(file, first.encode())
    report.scenarios.push({
      name: definition.name,
      trace: evidenceReference(dirname(options.output), file),
      events: first.lines.length,
      assumptions: definition.assumptions,
      properties: propertyStatuses(definition),
    })
  }

  const left = await captureConfluence(api, implementation, 'left')
  const right = await captureConfluence(api, implementation, 'right')
  assert.equal(canonicalState(left.recorder.finalState()), canonicalState(right.recorder.finalState()), 'confluence schedules have different canonical terminal states')
  for (const result of [left, right]) {
    const file = join(options.output, `${result.definition.name}.ndjson`)
    await writeFile(file, result.recorder.encode())
    report.scenarios.push({
      name: result.definition.name,
      trace: evidenceReference(dirname(options.output), file),
      events: result.recorder.lines.length,
      assumptions: result.definition.assumptions,
      properties: { Confluence: 'pending-trace-validation' },
    })
  }

  await writeFile(join(dirname(options.output), 'generation-report.json'), JSON.stringify(report, null, 2) + '\n')
}

await main()
