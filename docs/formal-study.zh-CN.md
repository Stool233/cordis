# Cordis 实现指南

[English](formal-study.md) | 中文

本页帮助读者定位[当前研究](https://github.com/Stool233/cordis-formal-study)选定的 Cordis 源码。论文阅读、共用检查和结果报告由门户维护。

## 阅读选定源码

研究使用 [18c327f 中的 Cordis core](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src)，基于官方 [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c)。该 fork 提交包含生命周期修复和普通回归。分支为 `codex/upstream-alignment-2026-09-09`；证据由门户版本锁中的完整提交标识。

Fiber 管理插件激活与清理。Dispose 路径将 consumer 的 registry 条目保留到清理结束，并在 provider 恢复前等待 dependent 清理。服务解析携带 provider 身份。[论文指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.zh-CN.md)解释对应要求。

## 检查行为

门户对这份源码和 Harness fork 执行三项共用行为检查：依赖清理顺序、退休组件的可发现性、替换 provider 的身份。检查导出已提交的源码，通过真实 Context 操作执行，不加入轨迹插桩。

按[复现指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md)运行检查。[验证说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.zh-CN.md)定义输入及通过的范围。

## 继续阅读

[实现参考](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.zh-CN.md)负责版本选择和依赖细节。[归档](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.zh-CN.md)保留此前分支与模型证据。
