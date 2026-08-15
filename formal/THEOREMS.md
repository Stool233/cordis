# Paper-to-conformance index

Page numbers refer to the PDF identified by [`provenance.json`](provenance.json). “Trace evidence” means a `cordis.paper-trace/v1` observation followed by the complete abstract post-state, not an event-only assertion.

## Paper to specification

| Paper result | PDF page | TLA+ operator or action | Implementation observation | Required premise |
| --- | ---: | --- | --- | --- |
| Theorem 7, recovery invariance | 11 | `CordisEffects!RecoveryExactness` | `inverse-collected`, `inverse-started`, `inverse-finished`; resource and accumulator projection | sound inverse |
| Theorem 16, reverse recovery | 15 | `CordisEffects!LifoRecovery` | stable resource IDs and per-iterator stacks | bounded iterator |
| Theorem 20 / Corollary 21, independent withdrawal and permutation | 16–17 | `CordisEffects!IndependentExchangeInvariant` | controlled independent-effect scenarios; no claim for opaque external effects | `PairwiseIndependent` |
| Lemma 54, write and lifecycle locality | 40–41 | `WriteLocality`, `CommittedLifecycle`, `RetirementMonotone` in `CordisKernel` | every state, committed, resource, and retirement observation | state is within the modeled projection |
| Lemma 55, observational invariance | 41 | `VisibleResolution` and the abstract projection used by `CordisRuntime` | only paper-visible fields enter NDJSON | equivalence-hidden data has no paper-visible effect |
| Lemma 56, equivariance | 41 | `RegistryWellFormed`; canonical logical IDs in the recorder | deterministic fiber/realm IDs and canonical terminal comparison | comparison is up to fresh-name renaming |
| Lemma 57, vestigial entries | 42 | `VestigialInvisible`, `NoStaleCommittedProvider` | `fiber-retired`, `fiber-removed`, full target/committed projection | removal has no remaining child or dependent |
| Theorem 59, preservation | 42–43 | `CordisKernel!Preservation` | `TraceStateWellFormed` after every consumed line | all four well-formedness clauses and declared prerequisites |
| Theorem 61 / Corollary 62, recovery exactness | 44–45 | `CordisKernel!RecoveryExactness` plus `installed`/`restored` ghost state | stable resource IDs, accumulator stacks, failure rollback | `PairwiseIndependent`; finite observed episode |
| Theorem 63, ordering | 45–46 | `CordisKernel!Ordering`, `DependentsQuiet`; `CordisTrace!ConsumersQuiet` | provider inverse cannot start while a committed dependent is non-Inactive | fixed dependency/provision declarations for the episode |
| Theorem 64, resolution coherence | 46–47 | `CordisKernel!ResolutionCoherence`; runtime launch/landing refinement | `target-changed`, `committed-changed`, lifecycle and landing observations | finite auxiliary launch state |
| Theorem 66, progress | 47–49 | `CordisKernel!Progress`, `Quiescent`, bounded rank | awaited scenario quiescence and finite event count (`ProgressBound`) | `AcyclicDependencies`, `FiniteNames`, `BoundedIterator`; weak fairness only in the model |
| Theorem 73, confluence | 52–53 | `CanonicalTerminalEquality`, `EventuallyCanonical` in `CordisConfluence` | two byte-stable schedules with equal canonical terminal projections | acyclic precedence, `PairwiseIndependent`, `TotalProvision`, `NoFailure` |

The trace suite does not turn a completed finite execution into a liveness proof. Theorem 66’s weak-fairness claim comes from the bounded TLA+ model; implementation traces contribute only quiescence and the configured step bound.

## Rules and implementation landing points

| Paper action | Abstract implementation landing |
| --- | --- |
| O-Insert | `fiber-created` after registry membership exists |
| O-Retire | `fiber-retired` after synchronous lifecycle/target notifications settle; early `uid = null` is runtime-only refinement state |
| O-Remove | lifecycle `absent` plus `fiber-removed` after teardown and runtime-list removal |
| L-Begin | `state-changed` to `Reloading` followed by the committed-view observation; the pair refines one paper step |
| L-Iter | `iteration-landed` with an optional preceding `inverse-collected`; launch is a strictly bounded silent step |
| L-Finish | `state-changed` from `Reloading` to `Active` |
| L-Divert | landing or target change followed by `state-changed` to `Unloading` |
| L-Raise | `iteration-raised`, error outcome, and transition to `Unloading` |
| L-Leave | `state-changed` from `Active` to `Unloading` before the differing target is exposed |
| L-Unload | LIFO `inverse-started`/`inverse-finished`, committed withdrawal, then `Inactive` or `absent` |

## Observation to paper result

| Observation | Primary paper obligation |
| --- | --- |
| `fiber-created`, `fiber-retired`, `fiber-removed` | Lemmas 54, 56, 57; Theorem 59 |
| `target-changed`, `committed-changed`, `state-changed` | Lemma 54; Theorems 59, 63, 64, 66 |
| `iteration-landed`, `iteration-raised` | Theorems 7, 16, 61, 64 |
| `inverse-collected`, `inverse-started`, `inverse-finished` | Theorems 7, 16, 20; Theorems 61 and 63 |
| `service-provided`, `service-withdrawing`, `service-withdrawn` | Theorems 63, 64, 66, 73 and `TotalProvision` audit |
| `inverse-bookkeeping-*` | refinement-only stuttering; constrained to an unchanged abstract state |
