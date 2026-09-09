# Cordis：论文与实现 fork

[English](README.md) | 中文

本 fork 为独立的 [Cordis 研究](https://github.com/Stool233/cordis-formal-study)提供框架源码。Cordis 通过插件、服务与可逆 effect 组织程序。

## 从这里开始

| 目的 | 阅读 |
| --- | --- |
| 理解通过 TLC 发现的问题与修复 | [贡献说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.zh-CN.md) |
| 理解当前论文 | [论文阅读](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.zh-CN.md) |
| 找到被检查的实现 | [Fork 指南](docs/formal-study.zh-CN.md) |
| 自己运行检查 | [复现指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md) |

论文为 [A Programming Paradigm for Spatiotemporal Composability, arXiv v1](https://arxiv.org/abs/2608.25512v1)。研究通过 TLC 反例确认两个清理缺陷，完成修复并检查选定 fork 源码；provider 身份保留为补充回归。

默认分支提供官方源码与本阅读指南。门户的[实现说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.zh-CN.md)选定包含修复的 fork 提交。具体回归检查通过，不代表任意插件 effect 或完整论文演算已获证明。

此前研究可从门户的[归档](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.zh-CN.md)追溯。
