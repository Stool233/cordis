# Cordis 论文形式化研究：修复验证阶段

> 本分支是研究阶段二 `research/paper-conformance`。它包含论文驱动的 TLA+ 规格、测试专用轨迹插桩、已确认的运行时修复和回归测试，是门户锁定的权威 conformance kit。

本文说明修复后的实现如何接受与发现阶段相同的论文性质检查。完整三阶段过程和一键复现入口见 [Cordis Formal Study 研究结果](https://github.com/Stool233/cordis-formal-study/blob/main/docs/results.zh-CN.md)。

## 一句话结论

研究先在未修改实现上固定反例，再修复 provider recovery、retirement 和 lifecycle publication 顺序。修复后的上游 Cordis 与 DeepSeek Harness vendored Cordis 均通过同一套有界模型、逐状态轨迹 refinement、前提审计和 semantic mutation 检查；论文规格没有为了接受旧实现顺序而放宽。

这是针对固定 revision、有限模型和已采集轨迹的证据，不是对任意 JavaScript 插件外部副作用的无条件数学证明。

## 三个研究阶段

| 阶段 | Cordis 分支 | 运行时逻辑 | 证据语义 |
| --- | --- | --- | --- |
| 发现 | `research/paper-trace-baseline` | 原始逻辑加观测 | 9 条上游、10 条 vendored 轨迹 mismatch 被精确复现。 |
| 修复验证 | `research/paper-conformance` | 观测加论文驱动修复 | TLC、轨迹、普通回归、前提审计和 mutations 通过。 |
| 上游提案 | `fix/paper-conformance` | 只保留逻辑修复 | 普通回归通过；不直接生成轨迹证据。 |

三个分支表示研究阶段和证据角色，不要求形成线性的 Git 提交祖先关系。第三阶段的形式化依据来自本阶段中接受相同修复行为的带插桩实现。

## 规格与实现如何连接

```text
Cordis 论文 ──> TLA+ 抽象模型 ──> TLC 有界模型检查
                    ▲
                    │ 完整抽象后状态 refinement
                    │
Cordis / vendored Cordis ──> 确定性 NDJSON 轨迹

定理前提 ──> 显式审计 ──> pass 或 not-applicable
```

论文定义、引理和定理决定待检查性质。五个主要模块分别覆盖 effect 恢复、Section 4 状态机、运行时 refinement、合流和真实实现轨迹：

| 模块 | 作用 |
| --- | --- |
| `CordisEffects.tla` | 累积、失败回滚、LIFO 恢复和独立 effect 交换。 |
| `CordisKernel.tla` | registry、fiber、依赖与供给、target、committed view、retirement、failure 和 O-/L-规则。 |
| `CordisRuntime.tla` | 实现状态到论文状态的 refinement，包含受约束 stuttering 和步骤合并。 |
| `CordisConfluence.tla` | 相同 orchestration、不同生命周期调度的 canonical terminal state 比较。 |
| `CordisTrace.tla` | 游标完整消费 NDJSON，并逐行比较完整抽象后状态。 |

`AcyclicDependencies`、`FiniteNames`、`BoundedIterator`、`PairwiseIndependent`、`TotalProvision` 和 `NoFailure` 都是显式前提。前提为假时，依赖它的结论报告 `not-applicable`，不会被计为 pass。

## 发现和修复

### Provider recovery 与 retirement ordering

发现阶段中，provider inverse 可能在异步 dependent teardown 完成前开始；consumer 还可能在完全停稳前离开 runtime list，使并发退休的 provider 无法继续发现它。这与 RecoveryExactness 和 Ordering 的 episode 嵌套要求不一致。

修复后的 provider 会保留并等待已通知 dependent 的当前生命周期工作，再启动自身 inverse。Retiring consumer 会保留在 runtime list 中直至 teardown 完成，而公开的 disposed 状态仍可立即生效。

### Lifecycle、target 与 committed view 的发布顺序

发现阶段中，依赖 epoch、target 或 committed view 可能先于兼容的 lifecycle transition 变得可观察。修复后先发布 `Reloading` 或 `Unloading`，再暴露相容的 target/committed 变化，使轨迹符合 ResolutionCoherence。

### 传递激活调度

普通回归发现连续两个激活检查点会让 awaited provider 返回时，传递 consumer 仍处于 `LOADING`。实现只保留一个用于取消 stale activation 的延迟检查点，使 disposal 仍可使旧激活失效，同时让传递激活在 awaited mount 返回前结算。

DeepSeek Harness 的 session persistence 还把需要完成顺序的 admission、retirement drain 和 backend close 放入同一个 effect accumulator，从而不依赖独立顶层 wrapper 的全局串行化。

## 调查后没有归类为缺陷的行为

每个 effect iterator 内的 inverse 仍串行并按 LIFO 恢复；相互独立的顶层 wrapper 按注册逆序启动并并发 join。该行为在显式 `PairwiseIndependent` 前提下符合论文允许的交换，不作为实现偏差。

论文的静态 provision 也不会直接等同于尚未参与核心解析的 `Plugin.provide` 元数据。当前实现证据来自受控 `ctx.provide()` episode，并携带稳定 logical key、realm 和 provider identity；`TotalProvision` 只适用于 harness 已闭合 provider 集合的场景。

## 当前结果

### 有界模型

| 模型 | 结果 | Distinct states | BFS 直径 |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel，failure enabled | pass | 82,710 | 32 |
| Kernel，`NoFailure` | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product | pass | 364,816 | 41 |

模型覆盖 `WriteLocality`、`LifoRecovery`、`RecoveryExactness`、`IndependentExchangeInvariant`、`Preservation`、`Ordering`、`ResolutionCoherence`、`Progress`、`RuntimeRefinesPaper`、`CanonicalTerminalEquality` 和 `EventuallyCanonical`。实现轨迹另外检查 `ProgressBound`。

### 实现轨迹与 mutations

上游 Cordis 运行 13 条核心轨迹。DeepSeek Harness 在同一组核心轨迹之外增加重入 dispose、pending effect、异步 cleanup join 和无网络 AgentLoop 装配，共运行 17 条轨迹。

每条 required 正向轨迹都必须非空、在不同临时根中生成相同字节、被 `TraceMatched` 完整消费，且所有 required property 都为 `pass`。源码声明的 29 个写入观测点全部受覆盖检查。

四个 semantic mutant 均被拒绝：

| Mutation | 验证器拒绝的行为 |
| --- | --- |
| 移除 unload guard | provider inverse 早于 dependent teardown。 |
| 按值比较 target | 同值掩盖 provider identity 改变。 |
| 使用 FIFO 恢复 | accumulator 不再按 LIFO 恢复。 |
| 保留 stale committed provider | 失效 provider 仍在 committed view 中可见。 |

## 如何复现本阶段

在 Cordis checkout 中运行：

```sh
yarn formal:syntax
yarn formal:model
yarn formal:trace
yarn formal:mutation
yarn formal:check
```

跨仓完整复现使用研究门户：

```sh
npm run bootstrap:study
npm run reproduce:conformance
```

门户还提供 `npm run reproduce:baseline`、`npm run reproduce:upstream-fix` 和顺序执行三个阶段的 `npm run reproduce:study`。

## 结论边界

通过表示锁定的实现 revision 在所检查的有限 TLA+ 配置、显式前提和已采集轨迹中没有发现反例。它不覆盖任意 opaque 文件、网络或进程 effect，不从有限轨迹推出无界活性，也不代表未进入场景或观测投影的插件行为已经证明正确。完整 TLA+ 规格、论文定理映射和 refinement 规则仍需人工审阅与独立复核。
