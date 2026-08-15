# Applicability and implementation audit

The theorem prerequisites are data, not optimistic defaults. Every trace line carries all six flags, every scenario report repeats them, and a false prerequisite produces `not-applicable` for the dependent property. A `not-applicable` or `unobserved` result in a core required scenario fails the conformance gate.

| Premise | Model treatment | Implementation audit | General Cordis conclusion |
| --- | --- | --- | --- |
| `AcyclicDependencies` | `ASSUME` in `CordisKernel`; rank ordering is invariant | core scenarios construct an acyclic provider/consumer graph; the negative scenario declares false | arbitrary plugin graphs are not statically rejected, so progress is not generally applicable |
| `FiniteNames` | finite TLC constant sets | a captured scenario has a finite stable-ID table | no conclusion about an unbounded long-running host |
| `BoundedIterator` | `MaxIterations` / `MaxEffectSteps` | scenarios await a finite iterator and runner records a finite event count | an arbitrary async generator may be unbounded, so progress is not generally applicable |
| `PairwiseIndependent` | assumed by effects/kernel/confluence models | controlled scenarios confine effects to named local resources; the negative scenario declares false | opaque JavaScript and external I/O are outside the proof |
| `TotalProvision` | assumed by kernel/confluence models | applicable scenarios observe every service installation they rely on; the negative scenario omits one | Cordis does not enforce totality for arbitrary plugins |
| `NoFailure` | selected per config and trace | ordinary scenarios declare true; rollback declares false and requests only failure-safe properties | confluence is not reported for failing executions |

## Static provision audit

The paper’s `p` is a fixed semantic provision set. In this Cordis revision, `Plugin.provide` exists only as TypeScript metadata and is not consumed by registry or lifecycle logic. Real provision is the stable `(logical key, isolation realm)` installed by `ctx.provide()`. The refinement therefore derives provision from observed `service-provided`/`service-withdrawn` episodes and marks `TotalProvision` applicable only for a closed scenario whose expected providers are under harness control.

This is deliberately not a claim that `Plugin.provide` validates `ctx.provide()`. Making that metadata authoritative would be a separate public runtime design change. Until then, general Total Provision and Theorem 73 remain `not-applicable` outside audited closed assemblies.

## Retirement and removal audit

Cordis clears `uid` at disposal request time. The paper O-Retire landing is emitted only after the synchronous target/lifecycle notification cascade, so a retired provider cannot remain in an active target projection. Runtime-list removal and registry deletion occur only after all fiber inertia has settled; O-Remove is then represented by the `absent` lifecycle projection and `fiber-removed`.

The source observation manifest pins all current writes to `uid`, lifecycle, epoch/target, committed stores, runtime registry, and service stores. A new matching write fails `formal:check` until its paper observation or explicit refinement treatment is recorded.

## Confirmed implementation deviations and refinement boundary

Trace counterexamples identified two implementation-order deviations and one important refinement boundary. The deviations were fixed rather than weakening the paper properties:

1. Provider inverses could begin before asynchronous dependents finished unloading. Providers now join the dependent set before starting any inverse.
2. Each `ctx.effect()` iterator recovers its accumulated resources serially in LIFO order. Independent top-level structural wrappers start in reverse registration order and are joined concurrently, as Section 5.1.3 states; those wrappers are refinement-only bookkeeping and their underlying inverses are the modeled resources.
3. Reload committed its store while the fiber still projected as Inactive, and an active target could change before L-Leave. Reload is deferred until the Reloading state lands, and L-Leave lands before exposing a differing target.

The regression suite and four semantic mutations cover these obligations. The mutations remove the unload guard, compare a replacement by service value instead of provider identity, restore an iterator accumulator in FIFO order, and retain a stale committed provider.
