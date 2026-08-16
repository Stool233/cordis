---- MODULE CordisConfluence ----
(***************************************************************************)
(* Product model: identical orchestration inputs, independent schedulers.   *)
(***************************************************************************)

EXTENDS FiniteSets, Naturals, Sequences, TLC

CONSTANTS Components, Provider, Consumer, Sibling, MaxEffectSteps,
          PairwiseIndependent, TotalProvision, NoFailure

ASSUME /\ {Provider, Consumer, Sibling} \subseteq Components
       /\ Cardinality({Provider, Consumer, Sibling}) = 3
       /\ MaxEffectSteps \in Nat \ {0}
       /\ PairwiseIndependent
       /\ TotalProvision
       /\ NoFailure

Phases == {"Inactive", "Reloading", "Active", "Unloading"}
AllResources == Components \X (1..MaxEffectSteps)
ResourceOf(component, index) == <<component, index>>

VARIABLES phaseA, phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
          resourcesA, resourcesB, stoppedA, stoppedB

vars == <<phaseA, phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
          resourcesA, resourcesB, stoppedA, stoppedB>>

Needs(component) == IF component = Consumer THEN {Provider} ELSE {}

Ready(component, phase) == \A dependency \in Needs(component) : phase[dependency] = "Active"

DependentsQuiet(component, phase) ==
  component # Provider \/ phase[Consumer] = "Inactive"

SideInit(phase, remaining, accumulator, resources, stopped) ==
  /\ phase = [component \in Components |-> "Inactive"]
  /\ remaining = [component \in Components |-> 0]
  /\ accumulator = [component \in Components |-> <<>>]
  /\ resources = {}
  /\ stopped = FALSE

Init ==
  /\ SideInit(phaseA, remainingA, accumulatorA, resourcesA, stoppedA)
  /\ SideInit(phaseB, remainingB, accumulatorB, resourcesB, stoppedB)

BeginA(component) ==
  /\ ~stoppedA
  /\ phaseA[component] = "Inactive"
  /\ Ready(component, phaseA)
  /\ phaseA' = [phaseA EXCEPT ![component] = "Reloading"]
  /\ remainingA' = [remainingA EXCEPT ![component] = MaxEffectSteps]
  /\ accumulatorA' = [accumulatorA EXCEPT ![component] = <<>>]
  /\ UNCHANGED <<phaseB, remainingB, accumulatorB, resourcesA, resourcesB, stoppedA, stoppedB>>

IterA(component) ==
  /\ phaseA[component] = "Reloading"
  /\ ~stoppedA
  /\ Ready(component, phaseA)
  /\ remainingA[component] > 0
  /\ LET index == MaxEffectSteps - remainingA[component] + 1
         resource == ResourceOf(component, index)
     IN /\ remainingA' = [remainingA EXCEPT ![component] = @ - 1]
        /\ accumulatorA' = [accumulatorA EXCEPT ![component] = Append(@, resource)]
        /\ resourcesA' = resourcesA \cup {resource}
  /\ UNCHANGED <<phaseA, phaseB, remainingB, accumulatorB, resourcesB, stoppedA, stoppedB>>

FinishA(component) ==
  /\ phaseA[component] = "Reloading"
  /\ ~stoppedA
  /\ Ready(component, phaseA)
  /\ remainingA[component] = 0
  /\ phaseA' = [phaseA EXCEPT ![component] = "Active"]
  /\ UNCHANGED <<phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedA, stoppedB>>

LeaveA(component) ==
  /\ phaseA[component] \in {"Active", "Reloading"}
  /\ (stoppedA \/ ~Ready(component, phaseA))
  /\ phaseA' = [phaseA EXCEPT ![component] = "Unloading"]
  /\ UNCHANGED <<phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedA, stoppedB>>

UnloadA(component) ==
  /\ phaseA[component] = "Unloading"
  /\ DependentsQuiet(component, phaseA)
  /\ IF Len(accumulatorA[component]) > 0
     THEN LET resource == accumulatorA[component][Len(accumulatorA[component])]
          IN /\ accumulatorA' = [accumulatorA EXCEPT ![component] = SubSeq(@, 1, Len(@) - 1)]
             /\ resourcesA' = resourcesA \ {resource}
             /\ UNCHANGED phaseA
     ELSE /\ phaseA' = [phaseA EXCEPT ![component] = "Inactive"]
          /\ UNCHANGED <<accumulatorA, resourcesA>>
  /\ UNCHANGED <<phaseB, remainingA, remainingB, accumulatorB, resourcesB, stoppedA, stoppedB>>

StopA ==
  /\ ~stoppedA
  /\ stoppedA' = TRUE
  /\ UNCHANGED <<phaseA, phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedB>>

BeginB(component) ==
  /\ ~stoppedB
  /\ phaseB[component] = "Inactive"
  /\ Ready(component, phaseB)
  /\ phaseB' = [phaseB EXCEPT ![component] = "Reloading"]
  /\ remainingB' = [remainingB EXCEPT ![component] = MaxEffectSteps]
  /\ accumulatorB' = [accumulatorB EXCEPT ![component] = <<>>]
  /\ UNCHANGED <<phaseA, remainingA, accumulatorA, resourcesA, resourcesB, stoppedA, stoppedB>>

IterB(component) ==
  /\ phaseB[component] = "Reloading"
  /\ ~stoppedB
  /\ Ready(component, phaseB)
  /\ remainingB[component] > 0
  /\ LET index == MaxEffectSteps - remainingB[component] + 1
         resource == ResourceOf(component, index)
     IN /\ remainingB' = [remainingB EXCEPT ![component] = @ - 1]
        /\ accumulatorB' = [accumulatorB EXCEPT ![component] = Append(@, resource)]
        /\ resourcesB' = resourcesB \cup {resource}
  /\ UNCHANGED <<phaseA, phaseB, remainingA, accumulatorA, resourcesA, stoppedA, stoppedB>>

FinishB(component) ==
  /\ phaseB[component] = "Reloading"
  /\ ~stoppedB
  /\ Ready(component, phaseB)
  /\ remainingB[component] = 0
  /\ phaseB' = [phaseB EXCEPT ![component] = "Active"]
  /\ UNCHANGED <<phaseA, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedA, stoppedB>>

LeaveB(component) ==
  /\ phaseB[component] \in {"Active", "Reloading"}
  /\ (stoppedB \/ ~Ready(component, phaseB))
  /\ phaseB' = [phaseB EXCEPT ![component] = "Unloading"]
  /\ UNCHANGED <<phaseA, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedA, stoppedB>>

UnloadB(component) ==
  /\ phaseB[component] = "Unloading"
  /\ DependentsQuiet(component, phaseB)
  /\ IF Len(accumulatorB[component]) > 0
     THEN LET resource == accumulatorB[component][Len(accumulatorB[component])]
          IN /\ accumulatorB' = [accumulatorB EXCEPT ![component] = SubSeq(@, 1, Len(@) - 1)]
             /\ resourcesB' = resourcesB \ {resource}
             /\ UNCHANGED phaseB
     ELSE /\ phaseB' = [phaseB EXCEPT ![component] = "Inactive"]
          /\ UNCHANGED <<accumulatorB, resourcesB>>
  /\ UNCHANGED <<phaseA, remainingA, remainingB, accumulatorA, resourcesA, stoppedA, stoppedB>>

StopB ==
  /\ ~stoppedB
  /\ stoppedB' = TRUE
  /\ UNCHANGED <<phaseA, phaseB, remainingA, remainingB, accumulatorA, accumulatorB,
                 resourcesA, resourcesB, stoppedA>>

StepA(component) == BeginA(component) \/ IterA(component) \/ FinishA(component) \/ LeaveA(component) \/ UnloadA(component)
StepB(component) == BeginB(component) \/ IterB(component) \/ FinishB(component) \/ LeaveB(component) \/ UnloadB(component)

TerminalA == stoppedA /\ \A component \in Components : phaseA[component] = "Inactive"
TerminalB == stoppedB /\ \A component \in Components : phaseB[component] = "Inactive"
Terminal == TerminalA /\ TerminalB

Next ==
  \/ \E component \in Components : StepA(component)
  \/ \E component \in Components : StepB(component)
  \/ StopA
  \/ StopB
  \/ /\ Terminal
     /\ UNCHANGED vars

ConfluenceTypeOK ==
  /\ phaseA \in [Components -> Phases]
  /\ phaseB \in [Components -> Phases]
  /\ remainingA \in [Components -> 0..MaxEffectSteps]
  /\ remainingB \in [Components -> 0..MaxEffectSteps]
  /\ accumulatorA \in [Components -> Seq(AllResources)]
  /\ accumulatorB \in [Components -> Seq(AllResources)]
  /\ resourcesA \subseteq AllResources
  /\ resourcesB \subseteq AllResources
  /\ stoppedA \in BOOLEAN
  /\ stoppedB \in BOOLEAN

CanonicalA == <<phaseA, resourcesA>>
CanonicalB == <<phaseB, resourcesB>>

CanonicalTerminalEquality == Terminal => CanonicalA = CanonicalB
EventuallyCanonical == (stoppedA /\ stoppedB) ~> Terminal

ConfluenceSpec ==
  /\ Init
  /\ [][Next]_vars
  /\ WF_vars(StopA)
  /\ WF_vars(StopB)
  /\ \A component \in Components : WF_vars(StepA(component)) /\ WF_vars(StepB(component))

====
