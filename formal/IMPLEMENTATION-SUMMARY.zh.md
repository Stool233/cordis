# Cordis 论文形式化研究：发现阶段

> 本分支是研究阶段一 `research/paper-trace-baseline`。它保留 Cordis `8cc9e33` 的运行时逻辑，只增加测试专用观测、确定性轨迹、论文驱动的 TLA+ 规格和预期失败检查。

本文解释如何在不修复实现的前提下复现研究发现。完整研究过程、修复结果和上游补丁说明见 [Cordis Formal Study 研究结果](https://github.com/Stool233/cordis-formal-study/blob/main/docs/results.zh-CN.md)。

## 一句话结论

论文抽象模型可以由 TLC 做有界检查，但未修改的 Cordis 实现轨迹不能全部 refine 到该模型。本阶段固定这些不匹配及普通行为反例，使后续修复可以与原始行为分开审阅。

`yarn formal:baseline` 返回成功表示“精确复现了锁定的反例集合”，不表示原实现符合论文。意外通过、出现新的不匹配或缺少既有反例都会使命令失败。

## 研究问题

本阶段回答三个问题：

1. 论文定义、引理和定理能否形成可执行的有界抽象状态机？
2. 在只加入同步 trace sink、不改变生命周期逻辑时，上游 Cordis 的实际轨迹能否被该状态机接受？
3. 普通公开 API 回归是否能独立复现轨迹揭示的生命周期问题？

论文是性质来源，代码是验证对象。实现不匹配不会通过放宽规格消除。

## 证据结构

```text
Cordis 论文 ──> TLA+ 抽象模型 ──> TLC 有界模型检查
                    ▲
                    │ 完整抽象后状态 refinement
                    │
未修改运行时 ──> 确定性 NDJSON 轨迹 ──> expected-fail

定理前提 ──> 显式审计 ──> pass 或 not-applicable
```

五个 TLA+ 模块分别检查 effect 恢复、Section 4 状态机、运行时 refinement、合流和真实轨迹。`CordisTrace.tla` 用游标消费每一行 `cordis.paper-trace/v1`，并比较完整抽象后状态；`TraceMatched` 必须消费整条非空轨迹。

trace sink 只在源码级测试中安装，不进入公开 barrel。recorder 使用稳定的 fiber、realm、effect 和资源 ID，不记录时间戳；同一场景在不同临时根中必须生成字节一致的轨迹。

## 阶段一结果

### TLC 轨迹 refinement

上游 Cordis 有 9 个受影响场景被论文状态机拒绝：

- `provider-consumer-reverse-exit`
- `async-consumer-teardown-guard`
- `concurrent-root-teardown-guard`
- `provider-identity-replacement`
- `dependency-loss-during-iteration`
- `dependency-return-during-unload`
- `isolation-realms`
- `confluence-left`
- `confluence-right`

这些名称表示同一底层顺序偏差在不同 identity、realm、依赖和调度路径中的表现，不表示发现了 9 个独立缺陷。未列入集合的正向场景仍必须通过，三个负前提场景仍必须精确报告 `not-applicable`。

### 普通行为反例

四项公开 API 断言在未修改运行时上得到 `expected-fail`：

| 行为 | 观察到的基线结果 |
| --- | --- |
| provider 资源覆盖异步 consumer teardown | consumer cleanup 可能看到资源已经撤回。 |
| 并发 root disposal 中保留 retiring consumer | consumer 会过早离开 runtime list。 |
| disposal 使延迟 reload 失效 | pending effect 可能没有被 drain。 |
| awaited provider 结算传递激活 | provider 返回时传递 consumer 仍可能处于 `LOADING`。 |

DeepSeek Harness vendored 基线运行同一组断言，其中 disposal 抢先延迟 reload 已被既有本地加固覆盖，因此记录 3 项普通行为失败；它的附加 AgentLoop 场景使轨迹 mismatch 总数为 10。

## 从反例得到的发现

1. **Provider recovery 与 retirement ordering。** Provider inverse 可能在异步 dependent teardown 完成前开始，且过早从 runtime list 移除会使并发退休的 consumer 不再可发现。这与论文 Theorem 61/63 的恢复与顺序要求不一致。
2. **Lifecycle 与可见依赖视图的发布顺序。** 新 target 或 committed view 可能在兼容的 lifecycle transition 之前变得可观察，违反 Theorem 64 所需的 resolution coherence。
3. **传递激活调度。** 连续的激活检查点会让已等待的 provider 返回早于传递 consumer 结算。这是普通回归发现的相邻调度缺陷，不单独扩大论文定理声明。

独立顶层 effect 的逆序启动与并发 join 不归类为缺陷。每个 iterator 内仍串行 LIFO 恢复；跨 wrapper 并发只在显式 `PairwiseIndependent` 前提下解释。静态 `Plugin.provide` 也不会被直接当作论文 provision；受控证据来自运行时 `ctx.provide()` episode。

## 三个研究阶段

| 阶段 | Cordis 分支 | 运行时逻辑 | 预期证据 |
| --- | --- | --- | --- |
| 发现 | `research/paper-trace-baseline` | 原始逻辑加观测 | 固定 mismatch 被精确复现。 |
| 修复验证 | `research/paper-conformance` | 观测加论文驱动修复 | 模型、轨迹、普通回归和 mutations 全部通过。 |
| 上游提案 | `fix/paper-conformance` | 只保留逻辑修复 | 普通回归通过；不直接生成形式化轨迹证据。 |

三个阶段是研究过程中的不同证据角色，不要求形成线性的 Git 提交祖先关系。第三阶段的形式化依据来自第二阶段中接受相同修复行为的带插桩实现。

## 如何复现本阶段

在本分支安装依赖后运行：

```sh
yarn formal:syntax
yarn formal:model
yarn formal:baseline
```

`formal:model` 检查论文抽象模型，`formal:baseline` 生成普通行为报告、确定性轨迹和 TLC 反例，并验证 mismatch 集合精确不变。完整跨仓一键复现使用门户命令：

```sh
npm run bootstrap:study
npm run reproduce:baseline
```

## 结论边界

本阶段证明固定基线可以稳定重现不一致，不证明所有不一致都已发现。模型和轨迹仍受有限状态空间、声明前提、观测点和场景集合约束；完整 TLA+ 规格、论文定理映射和 refinement 规则仍需人工审阅与独立复核。
