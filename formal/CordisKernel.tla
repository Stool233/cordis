---- MODULE CordisKernel ----
(***************************************************************************)
(* Section 4 registry/fiber kernel and the three O-rules plus seven L-rules. *)
(***************************************************************************)

EXTENDS FiniteSets, Naturals, Sequences, SequencesExt, TLC

CONSTANTS Fibers, Keys, Root, None, MaxIterations, MaxDepth, AllowFailure,
          AcyclicDependencies, FiniteNames, BoundedIterator,
          PairwiseIndependent, TotalProvision, ExploreAllTopologies,
          ProviderFiber, ConsumerFiber, SiblingFiber

ASSUME /\ Fibers # {}
       /\ Keys # {}
       /\ Root \notin Fibers
       /\ None \notin Fibers \cup {Root}
       /\ MaxIterations \in Nat \ {0}
       /\ MaxDepth \in Nat \ {0}
       /\ AllowFailure \in BOOLEAN
       /\ AcyclicDependencies
       /\ FiniteNames
       /\ BoundedIterator
       /\ PairwiseIndependent
       /\ TotalProvision
       /\ ExploreAllTopologies \in BOOLEAN
       /\ ProviderFiber \in Fibers
       /\ ConsumerFiber \in Fibers \ {ProviderFiber}
       /\ SiblingFiber \in Fibers \ {ProviderFiber, ConsumerFiber}

Phases == {"Inactive", "Reloading", "Active", "Unloading"}
Outcomes == {"bottom", "error"}
Providers == Fibers \cup {None}
EmptyBinding == [key \in Keys |-> None]
AllResources == Fibers \X (1..MaxIterations)

VARIABLES registry, present, retired, everRetired, parent,
          dependency, provision, rank, lifecycle, target, committed, visible,
          remaining, accumulator, resources, installed, restored,
          outcome, restoring, orchestrationFixed

SeqSet(sequence) == {sequence[index] : index \in 1..Len(sequence)}
RemoveFrom(sequence, value) == SelectSeq(sequence, LAMBDA item : item # value)
ProvidedKeys(pres, provisions) == UNION {provisions[fiber] : fiber \in pres}
ResourceOf(fiber, index) == <<fiber, index>>
ResourcesOf(fiber) == {resource \in AllResources : resource[1] = fiber}

ResolveKey(fiber, key, pres, reti, phases, deps, provisions) ==
  LET candidates == {
    provider \in pres \ reti :
      /\ phases[provider] = "Active"
      /\ key \in provisions[provider]
  }
  IN IF key \notin deps[fiber] \/ candidates = {}
     THEN None
     ELSE CHOOSE provider \in candidates : TRUE

ResolveAll(pres, reti, phases, deps, provisions) ==
  [fiber \in Fibers |->
    IF fiber \in pres
    THEN [key \in Keys |-> ResolveKey(fiber, key, pres, reti, phases, deps, provisions)]
    ELSE EmptyBinding]

RECURSIVE CascadeLeaves(_, _, _)
RECURSIVE ParentDepth(_, _)

ParentDepth(owner, steps) ==
  IF owner = Root
  THEN 0
  ELSE IF steps = 0
       THEN MaxDepth + 1
       ELSE 1 + ParentDepth(parent[owner], steps - 1)

CascadeLeaves(phases, reti, steps) ==
  IF steps = 0
  THEN phases
  ELSE LET previous == CascadeLeaves(phases, reti, steps - 1)
           nextTarget == ResolveAll(present, reti, previous, dependency, provision)
       IN [fiber \in Fibers |->
            IF previous[fiber] = "Active"
               /\ (fiber \in reti \/ committed[fiber] # nextTarget[fiber])
            THEN "Unloading"
            ELSE previous[fiber]]

Ready(fiber) ==
  /\ fiber \in present \ retired
  /\ outcome[fiber] = "bottom"
  /\ \A key \in dependency[fiber] : target[fiber][key] # None

DependsOn(consumer, provider) ==
  \E key \in dependency[consumer] : committed[consumer][key] = provider

DependentsQuiet(provider) ==
  \A consumer \in present :
    DependsOn(consumer, provider) => lifecycle[consumer] = "Inactive"

vars == <<registry, present, retired, everRetired, parent,
          dependency, provision, rank, lifecycle, target, committed, visible,
          remaining, accumulator, resources, installed, restored,
          outcome, restoring, orchestrationFixed>>

Init ==
  /\ registry = <<>>
  /\ present = {}
  /\ retired = {}
  /\ everRetired = {}
  /\ parent = [fiber \in Fibers |-> Root]
  /\ dependency = [fiber \in Fibers |-> {}]
  /\ provision = [fiber \in Fibers |-> {}]
  /\ rank = [fiber \in Fibers |-> 0]
  /\ lifecycle = [fiber \in Fibers |-> "Inactive"]
  /\ target = [fiber \in Fibers |-> EmptyBinding]
  /\ committed = [fiber \in Fibers |-> EmptyBinding]
  /\ visible = [fiber \in Fibers |-> EmptyBinding]
  /\ remaining = [fiber \in Fibers |-> 0]
  /\ accumulator = [fiber \in Fibers |-> <<>>]
  /\ resources = {}
  /\ installed = [fiber \in Fibers |-> <<>>]
  /\ restored = [fiber \in Fibers |-> <<>>]
  /\ outcome = [fiber \in Fibers |-> "bottom"]
  /\ restoring = [fiber \in Fibers |-> FALSE]
  /\ orchestrationFixed = FALSE

OInsert(fiber, owner, deps, provides) ==
  /\ ~orchestrationFixed
  /\ fiber \in Fibers \ present
  /\ fiber \notin everRetired
  /\ owner \in present \cup {Root}
  /\ ParentDepth(owner, Cardinality(Fibers)) < MaxDepth
  /\ deps \subseteq ProvidedKeys(present, provision)
  /\ provides \subseteq Keys
  /\ deps \cap provides = {}
  /\ provides \cap ProvidedKeys(present, provision) = {}
  /\ \A consumer \in present : dependency[consumer] \cap provides = {}
  /\ IF ExploreAllTopologies
     THEN TRUE
     ELSE /\ owner = Root
          /\ deps = IF fiber = ConsumerFiber THEN Keys ELSE {}
          /\ provides = IF fiber = ProviderFiber THEN Keys ELSE {}
  /\ LET nextPresent == present \cup {fiber}
         nextParent == [parent EXCEPT ![fiber] = owner]
         nextDependency == [dependency EXCEPT ![fiber] = deps]
         nextProvision == [provision EXCEPT ![fiber] = provides]
     IN /\ registry' = Append(registry, fiber)
        /\ present' = nextPresent
        /\ parent' = nextParent
        /\ dependency' = nextDependency
        /\ provision' = nextProvision
        /\ rank' = [rank EXCEPT ![fiber] = Cardinality(present \cup everRetired)]
        /\ target' = ResolveAll(nextPresent, retired, lifecycle, nextDependency, nextProvision)
  /\ UNCHANGED <<retired, everRetired, lifecycle, committed, visible, remaining,
                 accumulator, resources, installed, restored, outcome,
                 restoring, orchestrationFixed>>

ORetire(fiber) ==
  /\ ~orchestrationFixed
  /\ fiber \in present \ retired
  /\ LET family == {member \in present : member = fiber \/ parent[member] = fiber}
         nextRetired == retired \cup family
         nextLifecycle == CascadeLeaves(lifecycle, nextRetired, Cardinality(Fibers))
     IN /\ retired' = nextRetired
        /\ everRetired' = everRetired \cup family
        /\ lifecycle' = nextLifecycle
        /\ target' = ResolveAll(present, nextRetired, nextLifecycle, dependency, provision)
  /\ UNCHANGED <<registry, present, parent, dependency, provision, rank,
                 committed, visible, remaining, accumulator, resources,
                 installed, restored, outcome, restoring, orchestrationFixed>>

ORemove(fiber) ==
  /\ fiber \in retired
  /\ lifecycle[fiber] = "Inactive"
  /\ ~\E member \in present : parent[member] = fiber
  /\ ~\E consumer \in present : DependsOn(consumer, fiber)
  /\ LET nextPresent == present \ {fiber}
         nextRetired == retired \ {fiber}
     IN /\ registry' = RemoveFrom(registry, fiber)
        /\ present' = nextPresent
        /\ retired' = nextRetired
        /\ target' = ResolveAll(nextPresent, nextRetired, lifecycle, dependency, provision)
  /\ UNCHANGED <<everRetired, parent, dependency, provision, rank, lifecycle,
                 committed, visible, remaining, accumulator, resources, installed,
                 restored, outcome, restoring, orchestrationFixed>>

LBegin(fiber) ==
  /\ lifecycle[fiber] = "Inactive"
  /\ Ready(fiber)
  /\ lifecycle' = [lifecycle EXCEPT ![fiber] = "Reloading"]
  /\ committed' = [committed EXCEPT ![fiber] = target[fiber]]
  /\ visible' = [visible EXCEPT ![fiber] = target[fiber]]
  /\ remaining' = [remaining EXCEPT ![fiber] = MaxIterations]
  /\ accumulator' = [accumulator EXCEPT ![fiber] = <<>>]
  /\ installed' = [installed EXCEPT ![fiber] = <<>>]
  /\ restored' = [restored EXCEPT ![fiber] = <<>>]
  /\ outcome' = [outcome EXCEPT ![fiber] = "bottom"]
  /\ restoring' = [restoring EXCEPT ![fiber] = FALSE]
  /\ target' = ResolveAll(present, retired, lifecycle', dependency, provision)
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, resources, orchestrationFixed>>

LIter(fiber) ==
  /\ lifecycle[fiber] = "Reloading"
  /\ committed[fiber] = target[fiber]
  /\ remaining[fiber] > 0
  /\ LET index == MaxIterations - remaining[fiber] + 1
         resource == ResourceOf(fiber, index)
     IN /\ remaining' = [remaining EXCEPT ![fiber] = @ - 1]
        /\ accumulator' = [accumulator EXCEPT ![fiber] = Append(@, resource)]
        /\ resources' = resources \cup {resource}
        /\ installed' = [installed EXCEPT ![fiber] = Append(@, resource)]
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, lifecycle, target, committed, visible, restored,
                 outcome, restoring, orchestrationFixed>>

LFinish(fiber) ==
  /\ lifecycle[fiber] = "Reloading"
  /\ fiber \notin retired
  /\ committed[fiber] = target[fiber]
  /\ remaining[fiber] = 0
  /\ lifecycle' = [lifecycle EXCEPT ![fiber] = "Active"]
  /\ target' = ResolveAll(present, retired, lifecycle', dependency, provision)
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, committed, visible, remaining, accumulator, resources,
                 installed, restored, outcome, restoring, orchestrationFixed>>

LDivert(fiber) ==
  /\ lifecycle[fiber] = "Reloading"
  /\ (fiber \in retired \/ committed[fiber] # target[fiber])
  /\ lifecycle' = [lifecycle EXCEPT ![fiber] = "Unloading"]
  /\ target' = ResolveAll(present, retired, lifecycle', dependency, provision)
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, committed, visible, remaining, accumulator, resources,
                 installed, restored, outcome, restoring, orchestrationFixed>>

LRaise(fiber) ==
  /\ AllowFailure
  /\ lifecycle[fiber] = "Reloading"
  /\ lifecycle' = [lifecycle EXCEPT ![fiber] = "Unloading"]
  /\ outcome' = [outcome EXCEPT ![fiber] = "error"]
  /\ target' = ResolveAll(present, retired, lifecycle', dependency, provision)
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, committed, visible, remaining, accumulator, resources,
                 installed, restored, restoring, orchestrationFixed>>

LLeave(fiber) ==
  /\ lifecycle[fiber] = "Active"
  /\ (fiber \in retired \/ committed[fiber] # target[fiber])
  /\ LET first == [lifecycle EXCEPT ![fiber] = "Unloading"]
         nextLifecycle == CascadeLeaves(first, retired, Cardinality(Fibers))
     IN /\ lifecycle' = nextLifecycle
        /\ target' = ResolveAll(present, retired, nextLifecycle, dependency, provision)
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, committed, visible, remaining, accumulator, resources,
                 installed, restored, outcome, restoring, orchestrationFixed>>

LUnload(fiber) ==
  /\ lifecycle[fiber] = "Unloading"
  /\ DependentsQuiet(fiber)
  /\ IF Len(accumulator[fiber]) > 0
     THEN LET resource == accumulator[fiber][Len(accumulator[fiber])]
          IN /\ accumulator' = [accumulator EXCEPT ![fiber] = SubSeq(@, 1, Len(@) - 1)]
             /\ resources' = resources \ {resource}
             /\ restored' = [restored EXCEPT ![fiber] = Append(@, resource)]
             /\ restoring' = [restoring EXCEPT ![fiber] = TRUE]
             /\ UNCHANGED <<lifecycle, target, committed, visible>>
     ELSE /\ lifecycle' = [lifecycle EXCEPT ![fiber] = "Inactive"]
          /\ committed' = [committed EXCEPT ![fiber] = EmptyBinding]
          /\ visible' = [visible EXCEPT ![fiber] = EmptyBinding]
          /\ restoring' = [restoring EXCEPT ![fiber] = FALSE]
          /\ target' = ResolveAll(present, retired, lifecycle', dependency, provision)
          /\ UNCHANGED <<accumulator, resources, restored>>
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, remaining, installed, outcome,
                 orchestrationFixed>>

OFix ==
  /\ ~orchestrationFixed
  /\ orchestrationFixed' = TRUE
  /\ UNCHANGED <<registry, present, retired, everRetired, parent, dependency,
                 provision, rank, lifecycle, target, committed, visible, remaining,
                 accumulator, resources, installed, restored, outcome, restoring>>

FiberStep(fiber) ==
  \/ LBegin(fiber)
  \/ LIter(fiber)
  \/ LFinish(fiber)
  \/ LDivert(fiber)
  \/ LRaise(fiber)
  \/ LLeave(fiber)
  \/ LUnload(fiber)

PaperNext ==
  \/ \E fiber \in Fibers, owner \in Fibers \cup {Root},
        deps \in SUBSET Keys, provides \in SUBSET Keys :
       OInsert(fiber, owner, deps, provides)
  \/ \E fiber \in Fibers : ORetire(fiber)
  \/ \E fiber \in Fibers : ORemove(fiber)
  \/ \E fiber \in Fibers : FiberStep(fiber)

Quiescent ==
  \A fiber \in present :
    \/ lifecycle[fiber] = "Active"
    \/ /\ lifecycle[fiber] = "Inactive"
       /\ (~Ready(fiber) \/ fiber \in retired)

Next ==
  \/ PaperNext
  \/ OFix
  \/ /\ orchestrationFixed /\ Quiescent
     /\ UNCHANGED vars

TypeOK ==
  /\ registry \in Seq(Fibers)
  /\ present \subseteq Fibers
  /\ retired \subseteq present
  /\ everRetired \subseteq Fibers
  /\ parent \in [Fibers -> Fibers \cup {Root}]
  /\ dependency \in [Fibers -> SUBSET Keys]
  /\ provision \in [Fibers -> SUBSET Keys]
  /\ rank \in [Fibers -> 0..Cardinality(Fibers)]
  /\ lifecycle \in [Fibers -> Phases]
  /\ target \in [Fibers -> [Keys -> Providers]]
  /\ committed \in [Fibers -> [Keys -> Providers]]
  /\ visible \in [Fibers -> [Keys -> Providers]]
  /\ remaining \in [Fibers -> 0..MaxIterations]
  /\ accumulator \in [Fibers -> Seq(AllResources)]
  /\ resources \subseteq AllResources
  /\ installed \in [Fibers -> Seq(AllResources)]
  /\ restored \in [Fibers -> Seq(AllResources)]
  /\ outcome \in [Fibers -> Outcomes]
  /\ restoring \in [Fibers -> BOOLEAN]
  /\ orchestrationFixed \in BOOLEAN

RegistryWellFormed ==
  /\ SeqSet(registry) = present
  /\ Len(registry) = Cardinality(present)
  /\ \A fiber \in present : parent[fiber] = Root \/ parent[fiber] \in present

DependencyAcyclic ==
  \A consumer, provider \in present :
    (dependency[consumer] \cap provision[provider] # {}) => rank[provider] < rank[consumer]

WriteLocality ==
  /\ resources = UNION {SeqSet(accumulator[fiber]) : fiber \in Fibers}
  /\ \A fiber \in Fibers :
       /\ SeqSet(accumulator[fiber]) \subseteq ResourcesOf(fiber)
       /\ SeqSet(installed[fiber]) \subseteq ResourcesOf(fiber)
       /\ SeqSet(restored[fiber]) \subseteq ResourcesOf(fiber)

CommittedLifecycle ==
  \A fiber \in Fibers :
    /\ (lifecycle[fiber] = "Inactive" => committed[fiber] = EmptyBinding)
    /\ (lifecycle[fiber] \in {"Reloading", "Active", "Unloading"} =>
          \A key \in dependency[fiber] : committed[fiber][key] # None)

RetirementMonotone == retired \subseteq everRetired

VestigialInvisible ==
  \A consumer \in present, key \in Keys : target[consumer][key] \notin retired

NoStaleCommittedProvider ==
  \A consumer \in present :
    \A key \in dependency[consumer] :
      committed[consumer][key] # None => committed[consumer][key] \in present

RecoveryExactness ==
  \A fiber \in Fibers :
    /\ restored[fiber] = SubSeq(Reverse(installed[fiber]), 1, Len(restored[fiber]))
    /\ (lifecycle[fiber] = "Inactive" =>
          /\ accumulator[fiber] = <<>>
          /\ resources \cap ResourcesOf(fiber) = {})

Ordering ==
  \A provider \in present : restoring[provider] => DependentsQuiet(provider)

ResolutionCoherence ==
  \A fiber \in present : lifecycle[fiber] = "Active" => committed[fiber] = target[fiber]

VisibleResolution ==
  \A fiber \in Fibers :
    /\ (lifecycle[fiber] \in {"Reloading", "Active", "Unloading"} =>
          visible[fiber] = committed[fiber])
    /\ (lifecycle[fiber] = "Inactive" => visible[fiber] = EmptyBinding)

Preservation ==
  /\ TypeOK
  /\ RegistryWellFormed
  /\ DependencyAcyclic
  /\ WriteLocality
  /\ CommittedLifecycle
  /\ RetirementMonotone
  /\ VestigialInvisible
  /\ NoStaleCommittedProvider
  /\ VisibleResolution

Progress == orchestrationFixed ~> Quiescent

KernelSpec ==
  /\ Init
  /\ [][Next]_vars
  /\ WF_vars(OFix)
  /\ \A fiber \in Fibers : WF_vars(FiberStep(fiber) \/ ORemove(fiber))

====
