# Cordis — formal study fork

English | [中文](README.zh-CN.md)

This is Stool233's research fork of [Cordis](https://github.com/cordiverse/cordis), a framework for composing plugins, services, and reversible effects. It supports the independent [Cordis Formal Study](https://github.com/Stool233/cordis-formal-study).

## Start here

| Your goal | Read next |
| --- | --- |
| Understand the findings and the three repositories | [Study overview](https://github.com/Stool233/cordis-formal-study) |
| Choose a branch or inspect the lifecycle fix | [Fork guide](docs/formal-study.md) |
| Reproduce models and implementation traces | [Reproduction guide](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.md) |
| Learn the programming model | [Cordis primer](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer) |

## Branches at a glance

`main` follows official upstream code and adds these fork documents. `codex/upstream-alignment-2026-09-09` carries the migrated lifecycle fixes and ordinary regressions, without runtime trace hooks.

The three historical experiment branches remain pinned by the study portal. A branch name alone is not an evidence version; use the [branch guide](docs/formal-study.md#branches-and-evidence) before comparing results.

## About Cordis

Cordis's design is described in *A Programming Paradigm for Spatiotemporal Composability*: [paper repository](https://github.com/cordiverse/paper), [arXiv](https://arxiv.org/abs/2608.25512).

Cordis is under active development; its API can change. This study concerns finite models and selected lifecycle scenarios. It does not establish correctness for every plugin or arbitrary external effects.
