# Cordis：论文与实现 fork

[English](README.md) | 中文

本 fork 为独立的 [Cordis 研究](https://github.com/Stool233/cordis-formal-study)提供框架源码。Cordis 通过插件、服务与可逆 effect 组织程序。

## 从这里开始

| 目的 | 阅读 |
| --- | --- |
| 理解当前论文 | [论文阅读](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.zh-CN.md) |
| 找到被检查的实现 | [Fork 指南](docs/formal-study.zh-CN.md) |
| 理解已确认的行为检查 | [验证说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.zh-CN.md) |
| 自己运行检查 | [复现指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md) |

阅读论文为 [A Programming Paradigm for Spatiotemporal Composability，arXiv v1](https://arxiv.org/abs/2608.25512v1)。研究在固定的 fork 源码上检查依赖清理顺序、退休 consumer 的可发现性和替换 provider 的身份。

默认分支提供官方源码与本阅读指南。门户的[实现说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.zh-CN.md)选定包含修复的 fork 提交。具体回归检查通过，不代表任意插件 effect 或完整论文演算已获证明。

此前研究可从门户的[归档](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.zh-CN.md)追溯。
