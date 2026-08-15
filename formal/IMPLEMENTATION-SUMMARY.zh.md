# Cordis 论文 TLA+ 形式化与实现轨迹验证：实施总结

本文面向希望快速理解本次工作的读者，说明我们为什么要做形式化验证、三个仓库分别发生了什么变化、验证结果意味着什么，以及它不意味着什么。完整的可执行规格仍以本目录中的 TLA+ 模块为准。

## 一句话结论

我们已经为 Cordis 论文建立了一条可重复运行的三层证据链：TLC 对论文抽象状态机做有界穷举；确定性轨迹把上游 Cordis 和 DeepSeek Harness 中的 vendored Cordis 映射到同一抽象状态机并逐状态比较；无法从有限运行轨迹推出的前提则单独审计。验证过程中发现了三个真实的实现顺序偏差，并修改实现而没有放宽论文规格。

这是一份针对固定版本、有限模型和已采集轨迹的 refinement 证据，不是对任意 JavaScript 插件及其外部副作用的无条件数学证明。

## 我们想回答的三个问题

1. 论文描述的效应恢复、依赖解析、生命周期和合流性质，在有限边界内是否彼此一致？
2. 上游 Cordis 的实际异步生命周期轨迹，能否通过明确的 refinement mapping 对应到论文规则？
3. DeepSeek Harness 携带的 vendored Cordis 还有本地加固，它是否也遵循同一套性质？

## 固定的研究基线

| 对象 | 固定版本 |
| --- | --- |
| Cordis 论文 | commit `948a07b369c62adb3b12e102458be5c18dfb69b9`；`paper.pdf` SHA-256 为 `4d48478dc0b6222d9f74d7db10ee776449b1209eb112632336544d32a49db97f` |
| 上游 Cordis | baseline `8cc9e33fab69e2d0476d126baaf2acb24e6a6ab4` |
| DeepSeek Harness | baseline `47f943859bef60e4160492346772ded9b24f765a`；vendored Cordis baseline `56b3d4f725681cf4556c1a8695a709cc3b6eed74` 加本地修改 |
| Specula | commit `c6aa3dfa41cd4bc7411fae40bd040924c70d9725`，版本 1.1.0 |

对应的证据结构如下：

```text
论文定义与定理 ──> TLA+ 抽象模型 ──> TLC 有界穷举
                       ▲
                       │ 完整抽象后状态逐行比较
                       │
Cordis / vendored Cordis ──> 确定性 NDJSON 轨迹

定理适用前提 ──> 显式审计 ──> pass 或 not-applicable
```

这里最重要的约束是：论文规格优先。实现轨迹不匹配时，要保存最小反例、定位对应定理并修正实现，不能把规格放宽到“刚好接受现有代码”。

## 三层证据分别做什么

### 第一层：TLC 有界模型检查

本目录增加了五个主要模块：

| 模块 | 作用 |
| --- | --- |
| [`CordisEffects.tla`](CordisEffects.tla) | 检查效应累积、失败回滚、LIFO 恢复以及独立效应交换，对应 Theorem 7、16、20/21。 |
| [`CordisKernel.tla`](CordisKernel.tla) | 建模注册表、fiber、依赖与供给、target、committed view、retirement、failure、effect iterator，以及论文 Section 4 的 O-/L-规则。 |
| [`CordisRuntime.tla`](CordisRuntime.tla) | 描述真实运行时到论文状态机的 refinement mapping，允许受约束的 stuttering 和实现步骤合并。 |
| [`CordisConfluence.tla`](CordisConfluence.tla) | 同时运行两个共享 orchestration、但生命周期调度不同的实例，比较规范化终态。 |
| [`CordisTrace.tla`](CordisTrace.tla) | 用游标完整消费 NDJSON 轨迹，并比较每一行携带的完整抽象后状态。 |

PR 配置使用 3 个 fibers、2 个 bindings、最多 2 次 iteration、1 层注册以及 failure on/off。nightly 配置扩大到 5 个 fibers、3 个 bindings、最多 3 次 iteration 和 2 层注册，并为每个模型设置 30 分钟上限；BFS 直径不足时会补充 simulation。

### 第二层：实现轨迹 refinement

Cordis core 增加了仅供源码级测试使用的内部 trace sink：

- sink 以 root context 为作用域，同步执行，不进入公开 `cordis` barrel；未安装时不产生记录。
- 观察 fiber 创建、退休和移除，target 与 lifecycle 改变，effect iteration landing/raise，inverse 收集和执行，以及 service provision/withdrawal。
- recorder 给 fiber、realm、effect 和抽象资源分配稳定逻辑 ID，不记录时间戳；同一场景连续运行两次必须生成字节完全相同的轨迹。
- 每行使用 `cordis.paper-trace/v1` NDJSON，包含逻辑序号、实现版本、观测点和完整抽象后状态。
- [`observation-points.json`](observation-points.json) 与源码扫描门禁固定生命周期、epoch/target、committed store、uid、registry 和 service store 的写入点，新增写入不能静默绕过观察。

`TraceMatched` 不是只检查最终结果。它要求游标消费整条非空轨迹，而且每一步投影出的 registry、fiber、target、committed、资源、accumulator 和 outcome 都与该行的完整后状态一致。

### 第三层：定理前提审计

`AcyclicDependencies`、`FiniteNames`、`BoundedIterator`、`PairwiseIndependent`、`TotalProvision` 和 `NoFailure` 都是显式数据，不是默认假设。某项前提为假时，依赖它的结论必须报告 `not-applicable`。

例如，有限成功轨迹不能证明任意长期运行的 async generator 一定有界，也不能证明任意外部 I/O 效应彼此独立。详细适用范围见 [`PREMISES.md`](PREMISES.md)。论文结果、TLA+ operator 和实现观测点的双向索引见 [`THEOREMS.md`](THEOREMS.md)。

Specula 在这里是方法和调试体验的参考：验证器采用确定性事件流、游标消费和完整后状态比较，并为失败保留可定位到定理、动作和轨迹行的反例。Specula 本身不是构建或 CI 依赖，其仓库没有被修改。

## 状态如何从 JavaScript 映射到论文

生命周期映射固定如下：

| Cordis 实现状态 | 论文抽象状态 |
| --- | --- |
| `PENDING` | `Inactive(⊥)` |
| `LOADING` | `Reloading` |
| `ACTIVE` | `Active` |
| `FAILED` | `Inactive(error)` |
| `UNLOADING` | `Unloading` |
| `DISPOSED` | `absent` |

其他几个容易混淆的概念：

- **target**：fiber 根据当前依赖解析希望绑定的 provider 集合。
- **committed view**：当前这次已加载 episode 实际承诺并可见的 provider 快照。
- **accumulator**：安装过程中收集的 inverse；卸载时必须逆序执行。
- **retirement**：fiber 不再接受新的行为，但它可能还在完成已有 teardown；最终 removal 才从抽象注册表消失。
- **refinement stuttering**：真实实现做了一步内部工作，但论文抽象状态没有变化。例如 async iterator 的 launch 不单独对应论文动作；landing 才对应 L-Iter、L-Finish、L-Divert 或 L-Raise。

实现里的 `uid = null` 和 runtime list 提前删除不需要与 O-Retire/O-Remove 一一对应。映射要求的是：这些内部步骤不能让已退休 provider 继续出现在可观察 target/committed view 中，且 removal 只能在 teardown 完全结束后落地。

同一 service 名称在不同 isolation realm 中会投影为不同的 `(logical key, realm)`；同值但不同 provider identity 也不能被误判为同一个绑定。

## 验证发现并修复的实现偏差

轨迹比较确认了三个实现顺序问题。修复同时进入上游 Cordis 和 DeepSeek Harness 的 vendored Cordis：

1. **Provider 恢复过早。** 原 `_unload()` 会并发启动所有顶层 disposer，导致 provider 自身 inverse 可能在异步 consumer 完成退出前开始。现在 provider 从 `ACTIVE` 离开时先记录并等待所有 dependent fibers 完成，再启动任何 provider inverse。
2. **顶层恢复不满足完整 LIFO。** 原实现并发启动顶层 disposer；现在顶层 accumulator 严格串行、逆序恢复，generator 内部收集的 inverse 同样保持 LIFO。
3. **生命周期与可见视图落地顺序不一致。** 原实现可能在 fiber 仍投影为 Inactive 时提交 store，或在 L-Leave 前暴露新 target。现在 `Reloading`/`Unloading` 生命周期先落地，再暴露相容的 target 或 committed view。

另一个重要审计结论是：论文中的静态 provision `p` 不能直接等同于当前 `Plugin.provide` 元数据。该元数据尚未参与核心生命周期解析；真正的实现供给来自 `ctx.provide()` 产生的稳定 `(logical key, realm)` episode。因此，`TotalProvision` 只在 harness 完全控制 provider 的闭合场景中成立，不能推广到任意插件树。

## 覆盖的核心场景

上游和 vendored 实现共享以下对抗场景：

- provider/consumer 激活与逆序退出；
- consumer 异步 teardown 期间 provider 资源仍然可用；
- 相同值但不同 provider identity 的替换；
- 依赖在异步 effect iteration 中丢失；
- unloading 期间依赖恢复并在完成后重新加载；
- generator 多段 inverse 和顶层 effect 的 LIFO 恢复；
- 部分安装抛错后的完整 rollback，且兄弟 fiber 不受影响；
- 父级动态注册子级及级联退休；
- 同一逻辑 key 在不同 isolation realm 中独立解析；
- 相同 orchestration 的不同调度到达等价终态。

DeepSeek Harness 另外覆盖 vendored 版的重入 dispose、pending effect、异步 cleanup join，以及通过 `mountAgentLoopTestDependencies()` 和 `AgentLoop` 构造的无网络最小装配。该装配验证依赖解析、加载、quiescence 和完整 teardown。

三类负场景——循环依赖、非独立 effect、非 total provision——用于确认前提失败会得到 `not-applicable`，而不是伪造的 pass。

## 当前验证结果

### TLA+ PR 模型

| 模型 | 结果 | Distinct states | BFS 直径 |
| --- | --- | ---: | ---: |
| Effects | pass | 289 | 15 |
| Kernel，failure enabled | pass | 82,710 | 32 |
| Kernel，NoFailure | pass | 21,858 | 32 |
| Runtime refinement | pass | 66 | 11 |
| Confluence product model | pass | 364,816 | 41 |

Preservation、RecoveryExactness、Ordering、ResolutionCoherence、Progress、RuntimeRefinesPaper、CanonicalTerminalEquality 和 EventuallyCanonical 等 required properties 全部通过。

### 实现轨迹

| 实现 | 场景数 | 结果 |
| --- | ---: | --- |
| 上游 Cordis | 12 | 所有轨迹非空、字节稳定并被 `TraceMatched` 完整消费 |
| DeepSeek Harness vendored Cordis | 16 | 共 690 个事件，所有 required property 为 pass |
| 其中 AgentLoop 最小装配 | 1 | 243 个事件，无网络并最终 quiescent |

源码门禁确认 29 个论文相关写入点全部有 observation mapping。Cordis core fiber 测试为 10/10；DeepSeek Harness lifecycle 测试为 11/11，其 build、typecheck、lint 以及干净 worktree 中的 28 项 `doc-sync` 门禁均通过。

### Mutation checks

四个故意破坏语义的 mutant 都被轨迹验证拒绝：

| Mutant | 被拒绝的原因 |
| --- | --- |
| 移除 unload guard | provider inverse 会在 dependent 尚未退出时开始 |
| 按值比较 target | 无法识别同值但不同 identity 的 provider 替换 |
| 改为 FIFO 恢复 | 违反 accumulator 的逆序恢复性质 |
| 保留 stale committed provider | 已失效 provider 仍会出现在 committed view |

失败证据包含 NDJSON、TLC JSON counterexample、定理、动作、轨迹行号和版本信息，保存在忽略提交的 `formal/output/` 中。报告中的文件引用统一采用相对于 evidence output root 的 POSIX 路径，失败命令中的本机目录则替换为 `${OUTPUT}`、`${FORMAL_ROOT}`、`${IMPLEMENTATION_ROOT}` 和 `${TOOL_CACHE}`。runner 会在两个不同的临时根生成完整轨迹树并逐字节比较，随后才把一份复制到目标目录。

## 三个仓库分别做了什么

| 仓库 | 本地分支 | 关键提交 | 内容 |
| --- | --- | --- | --- |
| `Stool233/cordis` | `research/cordis-formal-study` | 由研究门户 lock 固定 | 权威 TLA+ 规格、trace recorder/runner、可移植证据、CI、源码观察门禁、运行时修复和回归测试。 |
| `Stool233/deepseek-harness` | `research/cordis-formal-study` | 由研究门户 lock 固定 | backport 内部 hook 和运行时修复，运行同一 conformance kit，增加 vendored 与 AgentLoop 场景、CI 和 Agent Note。 |
| `cordiverse/paper` | `main` | `948a07b369c62adb3b12e102458be5c18dfb69b9` | 仅引用上游英文论文；本地中文翻译和 formal-link 分支不公开。 |

公开研究门户 `Stool233/cordis-formal-study` 通过 submodule gitlink 与 `study.lock.json` 同时固定这三个来源。DeepSeek Harness CI 固定检出门户 lock 中的 Cordis 提交；上游 `origin` 保持不变，研究分支只推送到个人 fork。

## 如何复跑

Cordis 仓库：

```sh
yarn formal:syntax
yarn formal:model
yarn formal:trace
yarn formal:mutation
yarn formal:portable
yarn formal:evidence
yarn formal:check
```

完整 runner 会固定并校验 TLA+ Tools 1.8.0 和 CommunityModules `202505152026` 的 SHA-256，JAR 只进入本地 cache，不提交到仓库。已有经过校验的 JAR 时，可以通过 `CORDIS_TLA_TOOLS_JAR` 和 `CORDIS_TLA_COMMUNITY_JAR` 指定路径。

DeepSeek Harness 仓库：

```sh
CORDIS_FORMAL_ROOT=/path/to/cordis pnpm test:cordis-paper
```

该命令会让权威 kit 加载 `vendor/cordis` 源码，运行共享场景、vendored 专属场景、AgentLoop 装配、mutation checks 和 29 点源码观察门禁。CI 则会按固定 Cordis commit 自动取得 kit。

如果 TLC 或轨迹验证失败，可按 [`specula-guidance.md`](specula-guidance.md) 使用 Specula 1.1.0 的 trace debugger 做交互式定位；Specula 不是 CI 依赖，也没有被修改。

## 应如何解读结论

可以得出的结论：

- 在记录的论文版本、实现版本和有界配置下，抽象模型的 required properties 经 TLC 穷举没有发现反例。
- 已采集的上游与 vendored Cordis 轨迹都逐状态 refine 到论文模型。
- 四种关键错误修改确实会被当前验证拒绝，验证没有退化为恒真的后状态检查。
- 关闭某个定理前提时，系统会显式报告该结论不适用。

不能得出的结论：

- 不能断言任意规模、任意调度的 JavaScript 程序都已被数学证明正确。
- 不能从一条有限 quiescent 轨迹推出实现层面的无限时域活性；弱公平活性来自有界 TLA+ 模型，轨迹只提供 quiescence 和步数上界证据。
- 不能替任意插件证明外部文件、网络、进程或其他 opaque side effect 两两独立且 inverse 正确。
- 不能在 `AcyclicDependencies`、`PairwiseIndependent` 或 `TotalProvision` 等前提不成立时继续宣称对应定理通过。

精确版本和工具链边界记录在 [`provenance.json`](provenance.json) 中。建议阅读顺序是：本文、[`THEOREMS.md`](THEOREMS.md)、[`PREMISES.md`](PREMISES.md)、[`README.md`](README.md)，最后再进入各 TLA+ 模块。
