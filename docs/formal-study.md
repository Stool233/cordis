# Cordis TLC contribution guide

English | [中文](formal-study.zh-CN.md)

This fork carries fixes for two lifecycle defects established through the [Cordis study's TLC workflow](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.md): provider recovery starts before dependent cleanup finishes, and retirement hides a consumer that still needs cleanup.

## Locate the fixes

The study selects [Cordis core at 18c327f](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src), based on official [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c). The fixed source is on `codex/upstream-alignment-2026-09-09`; the default branch provides official source and this reading guide.

The disposal path waits for notified dependents before provider recovery and retains retiring consumers in the runtime list until cleanup settles. The [contribution guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.md) connects the faulty recovery events with these repairs. The [implementation reference](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.md) owns exact version selection.

## Follow the evidence

The [verification guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.md) connects unmodified-source traces, TLC counterexamples, fixed-source traces, and negative controls. Ordinary resource and registry regressions supplement that chain; passing behavior checks alone are not the contribution.

[Reproduction](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) provides both TLC replay of captured observations and fresh fixed-source trace generation. It explains which operation executes implementation code. The portal bundles the exact formal tools so changing official release assets does not change the selected bytes.

## Read the paper in context

The [current paper guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.md) relates the cleanup findings to guarded L-Unload, ordering, and retirement. The evidence concerns specific implementation defects under declared dependencies; it does not prove the full current calculus. Provider identity is supporting coverage, not a separately claimed discovery.

The [archive](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.md) preserves broader historical claims and experiment history. Confirmed TLC contributions and their executable evidence remain in the portal's main reading path.
