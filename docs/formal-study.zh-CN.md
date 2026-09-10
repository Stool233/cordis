# Cordis TLC 贡献指南

[English](formal-study.md) | 中文

本 fork 包含[通过 Cordis 研究的 TLC 流程发现](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.zh-CN.md)的两个缺陷修复：依赖方尚未完成清理，provider 就开始恢复；retirement 隐藏了仍需清理的 consumer。

## 定位修复

研究选择 [18c327f 的 Cordis core](https://github.com/Stool233/cordis/tree/18c327f4566e8f640737c43a480e6d74a0673579/packages/core/src)，基于官方 [f8ea3cd](https://github.com/cordiverse/cordis/tree/f8ea3cd50f1a5724e8e715995bcde131c9c12b2c)。修复源码位于 `codex/upstream-alignment-2026-09-09`，默认分支提供上游源码和本指南。

销毁代码在 provider 恢复前等待已通知的 dependent，并让正在退出的 consumer 保留在运行时列表中，直到清理完成。[贡献说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/contributions.zh-CN.md)展示违规事件及其修复。[实现参考](https://github.com/Stool233/cordis-formal-study/blob/main/docs/implementation.zh-CN.md)记录源码版本。

## 阅读证据

[验证指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/verification.zh-CN.md)展示修复前后轨迹、TLC 反例和负向对照。行为回归直接检查资源可用性和 registry 成员身份。

[复现说明](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md)给出用 TLC 重放已采集轨迹，以及从修复源码生成轨迹的命令。研究仓库提供 JAR，各命令按版本锁校验文件字节。

## 结合论文阅读

[论文指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/paper.zh-CN.md)将清理发现对应到 guarded L-Unload、ordering 和 retirement。结果覆盖记录的场景及其声明的依赖绑定。Provider 身份有一项补充回归测试。

[归档](https://github.com/Stool233/cordis-formal-study/blob/main/archive/README.zh-CN.md)保存此前的主张、审阅和实验。
