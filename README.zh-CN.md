# Cordis — 形式化研究 fork

[English](README.md) | 中文

这是 Stool233 为 [Cordis](https://github.com/cordiverse/cordis) 形式化研究维护的 fork。Cordis 用插件、服务与可逆 effect 组织程序；本仓库为独立的 [Cordis Formal Study](https://github.com/Stool233/cordis-formal-study) 提供实现与实验分支。

## 从这里开始

| 你想了解什么 | 接着读 |
| --- | --- |
| 研究发现，以及三个仓库如何分工 | [研究概览](https://github.com/Stool233/cordis-formal-study/blob/main/README.zh-CN.md) |
| 选择分支或查看生命周期修复 | [Fork 使用指南](docs/formal-study.zh-CN.md) |
| 复现模型与实现轨迹检查 | [复现指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md) |
| 学习编程模型 | [Cordis primer](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer) |

## 分支概览

`main` 跟随官方上游代码，另附本 fork 的文档。`codex/upstream-alignment-2026-09-09` 包含迁移后的生命周期修复与普通回归，不含运行时轨迹插桩。

研究门户继续固定三个历史实验分支。仅凭分支名不能确定证据版本；比较结果前，请先看[分支与证据](docs/formal-study.zh-CN.md#分支与证据)。

## 关于 Cordis

Cordis 的设计见论文 *A Programming Paradigm for Spatiotemporal Composability*：[论文仓库](https://github.com/cordiverse/paper)、[arXiv](https://arxiv.org/abs/2608.25512)。

Cordis 正在快速开发，API 可能变化。本研究覆盖有限模型与选定的生命周期场景，不能据此断言所有插件或任意外部 effect 都正确。
