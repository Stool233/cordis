# Cordis 研究 fork 使用指南

[English](formal-study.md) | 中文

本文帮助你选择源码版本，并判断检查结果的含义。[研究门户](https://github.com/Stool233/cordis-formal-study)负责跨仓结果和复现流程；固定的 conformance 分支负责可执行规格。

## 分支与证据

| 分支 | 内容 | 含义 |
| --- | --- | --- |
| `main` | 官方上游代码与 fork 文档 | 当前上游参考。 |
| `codex/upstream-alignment-2026-09-09` | 适配上游 `f8ea3cd` 的修复 | 本次迁移候选。 |
| `research/paper-trace-baseline` | 原逻辑与观测 | 成功表示精确复现已知失败。 |
| `research/paper-conformance` | 修复、观测与 TLA+ kit | 证据对应门户固定的提交。 |
| `fix/paper-conformance` | 历史修复，不含观测 | 普通检查；`formalStatus: not-run`。 |

历史阶段继续作为证据快照保留。[对齐报告](https://github.com/Stool233/cordis-formal-study/blob/main/docs/upstream-alignment.zh-CN.md)单独记录本次迁移的版本、工具哈希与验证范围。

## 本次迁移改了什么

Consumer 的异步清理可能仍需使用 provider 的资源。迁移后的运行时保留正在退休的 consumer，并等待已通知的 consumer 清理完成，再恢复 provider 的 effect。

运行时先发布 unloading 状态，再改变依赖 epoch。一个延迟检查点负责取消过期激活，同时让等待 provider 的调用方看到传递 consumer 已完成激活。

迁移保留上游的失败 fiber 重入保护。Loader 在持久化 self-disposal 前检查所属树的生命周期。上游 HMR 已在 teardown 前保存旧 fiber，不需要额外逻辑补丁。

请在迁移分支阅读 [fiber.ts](../packages/core/src/fiber.ts)、[loader](../packages/loader/src/index.ts) 与 [fiber.spec.ts](../packages/core/tests/fiber.spec.ts)。在 `main` 打开链接时，看到的是上游代码。

## 验证 checkout

使用 Node.js 24，以及 [package.json](../package.json) 指定的 Yarn 版本。通过研究的依赖锁安装后，运行：

```sh
corepack yarn test core hmr loader include timer
corepack yarn build core
corepack yarn build
corepack yarn lint
```

[复现指南](https://github.com/Stool233/cordis-formal-study/blob/main/docs/reproduce.zh-CN.md)提供依赖锁与形式化流程。形式化检查使用独立插桩副本；迁移 checkout 没有 trace sink 或 `formal/` runner。

## 理解验证范围

Baseline 成功表示预期失败已复现。Conformance 成功表示选定模型、轨迹、前提和 mutation 检查通过。仅普通测试通过，不能推出 TLC 通过。

迁移沿用[历史论文导出的 kit](https://github.com/Stool233/cordis/tree/d06ee04a4c1c0cdd9605cd3d77521f90220d098b/formal)，并显式记录较新的 TLC 资产。它没有验证新版 arXiv 论文的全部定理。详见[方法](https://github.com/Stool233/cordis-formal-study/blob/main/docs/method.zh-CN.md)。
