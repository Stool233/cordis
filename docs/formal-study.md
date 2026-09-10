# Cordis TLC contribution guide

English | [中文](formal-study.zh-CN.md)

This fork contains fixes for two defects found through the [Cordis study's TLC workflow](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.md): provider recovery starts before dependent cleanup finishes, and retirement hides a consumer that still needs cleanup.

## Locate the fixes

The study selects [Cordis core at 18c327f](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src), based on official [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c). The fixed source is on `codex/upstream-alignment-2026-09-09`. The default branch provides official source and this guide.

The disposal code waits for notified dependents before provider recovery and keeps retiring consumers in the runtime list until cleanup finishes. The [contribution guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.md) shows the failing events and their repairs. The [implementation reference](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.md) records source versions.

## Follow the evidence

The [verification guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.md) presents traces before and after the fixes, TLC counterexamples, and negative controls. Behavior regressions check resource availability and registry membership directly.

[Reproduction](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) gives commands for replaying captured traces with TLC and generating traces from the fixed source. The study repository supplies the JARs, and each command verifies their bytes against the version lock.

## Read the paper in context

The [paper guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.md) relates the cleanup findings to guarded L-Unload, ordering, and retirement. The results cover the recorded scenarios under declared dependency bindings. Provider identity has a supporting regression test.

The [archive](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.md) contains earlier claims, reviews, and experiments.
