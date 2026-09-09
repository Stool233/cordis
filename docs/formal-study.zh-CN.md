# Cordis TLC 贡献指南

[English](formal-study.md) | 中文

本 fork 承载[通过 Cordis 研究的 TLC 流程确认](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.zh-CN.md)的两个生命周期缺陷修复：依赖方尚未完成清理，provider 就开始恢复；retirement 隐藏了仍需清理的 consumer。

## 定位修复

研究选择 [18c327f 的 Cordis core](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src)，基于官方 [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c)。修复源码位于 `codex/upstream-alignment-2026-09-09`；默认分支提供上游源码和阅读指南。

销毁流程在 provider 恢复前等待已通知的 dependent，并让正在退出的 consumer 保留在运行时列表中，直到清理结束。[贡献说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.zh-CN.md)将违规恢复事件与这些修复对应起来。[实现参考](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.zh-CN.md)维护精确版本选择。

## 阅读证据

[验证指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.zh-CN.md)串起未修改源码轨迹、TLC 反例、修复源码轨迹和负向对照。普通资源与 registry 回归补充这条证据链；单纯通过行为检查并不是这里的贡献。

[复现说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md)提供观测轨迹的 TLC 重放，以及从修复源码重新生成轨迹的方法，并区分哪些操作会执行实现代码。入口仓库保存精确版本的形式化工具，官方发布资产变化不会改变所选字节。

## 结合论文阅读

[当前论文指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.zh-CN.md)将清理发现对应到 guarded L-Unload、ordering 和 retirement。证据针对声明依赖下的具体实现缺陷，不证明完整当前演算。Provider 身份是补充覆盖，不额外主张独立发现。

[归档](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.zh-CN.md)保留范围更广的历史主张和实验过程。确认的 TLC 贡献及其可执行证据继续保留在入口仓库的主阅读路径。
