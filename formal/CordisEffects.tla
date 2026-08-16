---- MODULE CordisEffects ----
(***************************************************************************)
(* Section 3 effect calculus: accumulation, reverse recovery, and exchange. *)
(***************************************************************************)

EXTENDS FiniteSets, Naturals, Sequences, SequencesExt, TLC

CONSTANTS EffectNames, MaxEffectSteps, AllowFailure, PairwiseIndependent

ASSUME /\ EffectNames # {}
       /\ MaxEffectSteps \in Nat \ {0}
       /\ AllowFailure \in BOOLEAN
       /\ PairwiseIndependent

Phases == {"Installing", "Active", "Restoring", "Inactive"}
Outcomes == {"bottom", "error"}
EffectResource(effect, index) == <<effect, index>>
AllResources == EffectNames \X (1..MaxEffectSteps)
ResourcesOf(effect) == {resource \in AllResources : resource[1] = effect}
SeqSet(sequence) == {sequence[index] : index \in 1..Len(sequence)}

VARIABLES phase, remaining, accumulator, resources, installed, restored, outcome

vars == <<phase, remaining, accumulator, resources, installed, restored, outcome>>

Init ==
  /\ phase = [effect \in EffectNames |-> "Installing"]
  /\ remaining = [effect \in EffectNames |-> MaxEffectSteps]
  /\ accumulator = [effect \in EffectNames |-> <<>>]
  /\ resources = {}
  /\ installed = [effect \in EffectNames |-> <<>>]
  /\ restored = [effect \in EffectNames |-> <<>>]
  /\ outcome = [effect \in EffectNames |-> "bottom"]

Install(effect) ==
  /\ phase[effect] = "Installing"
  /\ remaining[effect] > 0
  /\ LET index == MaxEffectSteps - remaining[effect] + 1
         resource == EffectResource(effect, index)
     IN /\ remaining' = [remaining EXCEPT ![effect] = @ - 1]
        /\ accumulator' = [accumulator EXCEPT ![effect] = Append(@, resource)]
        /\ resources' = resources \cup {resource}
        /\ installed' = [installed EXCEPT ![effect] = Append(@, resource)]
  /\ UNCHANGED <<phase, restored, outcome>>

FinishInstall(effect) ==
  /\ phase[effect] = "Installing"
  /\ remaining[effect] = 0
  /\ phase' = [phase EXCEPT ![effect] = "Active"]
  /\ UNCHANGED <<remaining, accumulator, resources, installed, restored, outcome>>

Raise(effect) ==
  /\ AllowFailure
  /\ phase[effect] = "Installing"
  /\ phase' = [phase EXCEPT ![effect] = "Restoring"]
  /\ outcome' = [outcome EXCEPT ![effect] = "error"]
  /\ UNCHANGED <<remaining, accumulator, resources, installed, restored>>

BeginRecovery(effect) ==
  /\ phase[effect] = "Active"
  /\ phase' = [phase EXCEPT ![effect] = "Restoring"]
  /\ UNCHANGED <<remaining, accumulator, resources, installed, restored, outcome>>

RestoreOne(effect) ==
  /\ phase[effect] = "Restoring"
  /\ Len(accumulator[effect]) > 0
  /\ LET resource == accumulator[effect][Len(accumulator[effect])]
     IN /\ accumulator' = [accumulator EXCEPT ![effect] = SubSeq(@, 1, Len(@) - 1)]
        /\ resources' = resources \ {resource}
        /\ restored' = [restored EXCEPT ![effect] = Append(@, resource)]
  /\ UNCHANGED <<phase, remaining, installed, outcome>>

FinishRecovery(effect) ==
  /\ phase[effect] = "Restoring"
  /\ accumulator[effect] = <<>>
  /\ phase' = [phase EXCEPT ![effect] = "Inactive"]
  /\ UNCHANGED <<remaining, accumulator, resources, installed, restored, outcome>>

Next ==
  \/ \E effect \in EffectNames :
       \/ Install(effect)
       \/ FinishInstall(effect)
       \/ Raise(effect)
       \/ BeginRecovery(effect)
       \/ RestoreOne(effect)
       \/ FinishRecovery(effect)
  \/ /\ \A effect \in EffectNames : phase[effect] = "Inactive"
     /\ UNCHANGED vars

TypeOK ==
  /\ phase \in [EffectNames -> Phases]
  /\ remaining \in [EffectNames -> 0..MaxEffectSteps]
  /\ accumulator \in [EffectNames -> Seq(AllResources)]
  /\ resources \subseteq AllResources
  /\ installed \in [EffectNames -> Seq(AllResources)]
  /\ restored \in [EffectNames -> Seq(AllResources)]
  /\ outcome \in [EffectNames -> Outcomes]

WriteLocality ==
  \A effect \in EffectNames :
    /\ SeqSet(accumulator[effect]) \subseteq ResourcesOf(effect)
    /\ SeqSet(installed[effect]) \subseteq ResourcesOf(effect)
    /\ SeqSet(restored[effect]) \subseteq ResourcesOf(effect)

LifoRecovery ==
  \A effect \in EffectNames :
    restored[effect] = SubSeq(Reverse(installed[effect]), 1, Len(restored[effect]))

RecoveryExactness ==
  \A effect \in EffectNames :
    phase[effect] = "Inactive" =>
      /\ accumulator[effect] = <<>>
      /\ resources \cap ResourcesOf(effect) = {}

Forward(state, resource) == state \cup {resource}
Inverse(state, resource) == state \ {resource}

IndependentExchange ==
  \A left, right \in AllResources :
    left[1] # right[1] =>
      /\ Forward(Forward({}, left), right) = Forward(Forward({}, right), left)
      /\ Inverse(Inverse({left, right}, left), right) = Inverse(Inverse({left, right}, right), left)

IndependentExchangeInvariant == IndependentExchange /\ resources \subseteq AllResources

EffectsSpec == Init /\ [][Next]_vars

====
