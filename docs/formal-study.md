# Using the Cordis study fork

English | [中文](formal-study.zh-CN.md)

This reference helps you choose a source revision and interpret its checks. The [study portal](https://github.com/Stool233/cordis-formal-study) owns cross-repository results and reproduction; the pinned conformance branch owns the executable specification.

## Branches and evidence

| Branch | Contents | Meaning |
| --- | --- | --- |
| `main` | Official upstream code plus fork documents | Current upstream reference. |
| `codex/upstream-alignment-2026-09-09` | Fixes adapted to upstream `f8ea3cd` | Current migration candidate. |
| `research/paper-trace-baseline` | Original logic plus observations | Success reproduces the exact known failures. |
| `research/paper-conformance` | Fixes, observations, and TLA+ kit | Evidence belongs to the portal's pinned commit. |
| `fix/paper-conformance` | Historical fixes without observations | Ordinary checks; `formalStatus: not-run`. |

The historical stages remain evidence snapshots. The [alignment report](https://github.com/Stool233/cordis-formal-study/blob/main/docs/upstream-alignment.md) records the migration's revisions, tool hashes, and verification limits separately.

## What the migration changes

Consumers may still need a provider's resources during asynchronous cleanup. The migrated runtime keeps retiring consumers discoverable and waits for notified consumers before recovering the provider's effects.

It publishes the unloading state before changing the dependency epoch. One deferred checkpoint cancels stale activation and lets an awaited provider settle transitive consumers.

The port retains upstream's failed-fiber re-entry guard. Loader checks its owning tree's lifecycle state before persisting self-disposal. Upstream HMR already snapshots old fibers before teardown and needs no additional logic patch.

Read [fiber.ts](../packages/core/src/fiber.ts), [loader](../packages/loader/src/index.ts), and [fiber.spec.ts](../packages/core/tests/fiber.spec.ts) on the migration branch. Links opened on `main` show upstream code.

## Verify a checkout

Use Node.js 24 and the Yarn version in [package.json](../package.json). After installing dependencies with the study's lock, run:

```sh
corepack yarn test core hmr loader include timer
corepack yarn build core
corepack yarn build
corepack yarn lint
```

The [reproduction guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) supplies the lock and formal procedure. Formal checks use separate instrumented copies; this migration checkout contains no trace sink or `formal/` runner.

## Understand the limits

Baseline success means expected failures were reproduced. Conformance success means the selected models, traces, premises, and mutation checks passed. Ordinary tests alone say nothing about TLC.

The migration reuses the [historical paper-derived kit](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal) with an explicitly recorded newer TLC artifact. It does not validate every theorem in the newer arXiv paper. See [Method](https://github.com/Stool233/cordis-formal-study/blob/main/docs/method.md).
