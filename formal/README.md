# Cordis paper conformance

This directory is the authoritative executable specification for the Cordis paper. It provides three bounded forms of evidence: TLC exploration of the abstract machines, refinement checks over deterministic implementation traces, and explicit audits of theorem prerequisites that traces cannot establish.

The result is evidence for the revisions and finite configurations in [`provenance.json`](provenance.json). It is not an unconditional proof about arbitrary JavaScript plugins or their external side effects.

For a Chinese overview of the implementation, evidence, fixes, and interpretation boundaries, see [`IMPLEMENTATION-SUMMARY.zh.md`](IMPLEMENTATION-SUMMARY.zh.md).

## Commands

```sh
yarn formal:syntax
yarn formal:model
yarn formal:trace
yarn formal:mutation
yarn formal:portable
yarn formal:evidence
yarn formal:check
```

`formal:check` is the pull-request gate. `formal:nightly` selects the larger five-fiber, three-binding, three-iteration, depth-two configurations and imposes a 30-minute timeout on each TLC run. If a completed nightly BFS has diameter below 10, the runner supplements it with 100,000 simulation traces.

The runner downloads TLA+ Tools 1.8.0 and CommunityModules `202505152026` into `formal/.cache/`, verifies both SHA-256 values before execution, and never commits the JARs. Set `CORDIS_TLA_TOOLS_JAR` and `CORDIS_TLA_COMMUNITY_JAR` to verified local copies, or set `CORDIS_TLA_CACHE` to another cache directory.

To validate another source-compatible Cordis checkout against this kit:

```sh
yarn formal:trace \
  --implementation-root /path/to/cordis/package \
  --implementation-name implementation-name \
  --implementation-role upstream \
  --revision implementation-revision
```

The implementation package must expose its normal `src/index.ts` and the source-only `src/formal-trace.ts`. The trace hook is deliberately absent from the public `cordis` barrel.

When the implementation uses a different workspace's source aliases, pass `--trace-runtime-root /path/to/workspace`. The runner then uses that workspace's installed `tsx` and root `tsconfig.json` to load both the implementation and any `--scenario-module`; the default remains Cordis's own Yarn runtime.

## Evidence layers

- [`CordisEffects.tla`](CordisEffects.tla) checks accumulation, reverse recovery, failure rollback, and independent exchange.
- [`CordisKernel.tla`](CordisKernel.tla) models the registry, fibers, targets, committed views, retirement, failures, effect iterators, and the three O-rules plus seven L-rules.
- [`CordisRuntime.tla`](CordisRuntime.tla) defines the lifecycle and key/realm refinement mapping, including early `uid` retirement and launch stuttering.
- [`CordisConfluence.tla`](CordisConfluence.tla) is a two-instance product model with identical orchestration and independent lifecycle schedules.
- [`CordisTrace.tla`](CordisTrace.tla) consumes every NDJSON line with a cursor and compares the complete abstract post-state. Its only silent action is a bounded launch immediately associated with the next iteration landing or raise.
- [`observation-points.json`](observation-points.json) and `tools/verify-observation.mjs` reject new lifecycle, epoch, target, committed-store, uid, registry, or service-store writes until an observation mapping is declared.

The runner invokes the generator under two distinct temporary roots and requires the complete generated file trees to be byte-identical before copying one tree to the requested output root. Every core scenario must be non-empty, fully consumed by `TraceMatched`, and have only `pass` property results. Deliberate prerequisite failures remain `not-applicable`; they are never promoted to passes.

Failures are retained under `formal/output/`: the source NDJSON, TLC JSON counterexample, theorem/action/trace-line metadata, model report, conformance report, and mutation report. The output directory is ignored by Git.

## Portable report v1 paths

Every file reference in a `cordis.paper-*-report/v1` or `cordis.paper-failure/v1` document is a non-empty POSIX path relative to the evidence output root. The output root is the directory containing `generation-report.json`, `conformance-report.json`, `model-report.json`, and `mutation-report.json`; nested failure documents use that same root. Consumers must reject absolute paths, backslashes, and references that escape through `..` before resolving a file.

`generatedFrom` contains only the implementation name, package version, full revision, and logical role. Failure commands replace machine-local roots with `${OUTPUT}`, `${FORMAL_ROOT}`, `${IMPLEMENTATION_ROOT}`, and `${TOOL_CACHE}`. `formal:portable` tests the serializer and resolver, while `formal:evidence` rejects Unix, macOS, or Windows absolute paths anywhere in generated JSON or NDJSON evidence.

See [`THEOREMS.md`](THEOREMS.md) for the paper-to-code index, [`PREMISES.md`](PREMISES.md) for applicability audits, and [`specula-guidance.md`](specula-guidance.md) for optional interactive debugging.
