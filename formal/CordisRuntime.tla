---- MODULE CordisRuntime ----
(***************************************************************************)
(* Refinement layer for Cordis lifecycle values and asynchronous iteration. *)
(***************************************************************************)

EXTENDS FiniteSets, Naturals, TLC

CONSTANTS RuntimeFibers, LogicalKeys, Realms, None, NoUid, MaxRuntimeIterations

ASSUME /\ RuntimeFibers # {}
       /\ LogicalKeys # {}
       /\ Realms # {}
       /\ None \notin RuntimeFibers
       /\ MaxRuntimeIterations \in Nat \ {0}

RuntimePhases == {"PENDING", "LOADING", "ACTIVE", "FAILED", "UNLOADING", "DISPOSED"}
Targets == RuntimeFibers \cup {None}
Outcomes == {"bottom", "error"}

AbstractKey(logicalKey, realm) == <<logicalKey, realm>>
AbstractKeys == {AbstractKey(logicalKey, realm) : logicalKey \in LogicalKeys, realm \in Realms}

VARIABLES phase, uid, listed, target, committed, inFlight, landed,
          outcome, retired, lastLanding

vars == <<phase, uid, listed, target, committed, inFlight, landed,
          outcome, retired, lastLanding>>

PaperLifecycle(fiber) ==
  CASE phase[fiber] = "PENDING" -> [name |-> "Inactive", outcome |-> "bottom"]
    [] phase[fiber] = "LOADING" -> [name |-> "Reloading", outcome |-> "bottom"]
    [] phase[fiber] = "ACTIVE" -> [name |-> "Active", outcome |-> "bottom"]
    [] phase[fiber] = "FAILED" -> [name |-> "Inactive", outcome |-> "error"]
    [] phase[fiber] = "UNLOADING" -> [name |-> "Unloading", outcome |-> outcome[fiber]]
    [] OTHER -> [name |-> "absent", outcome |-> outcome[fiber]]

ProjectedPresent == {fiber \in RuntimeFibers : phase[fiber] # "DISPOSED"}
ProjectedLifecycle == [fiber \in RuntimeFibers |-> PaperLifecycle(fiber)]
ProjectedTarget == [fiber \in RuntimeFibers |-> target[fiber]]
ProjectedCommitted == [fiber \in RuntimeFibers |-> committed[fiber]]
AbstractProjection == <<ProjectedPresent, ProjectedLifecycle, ProjectedTarget, ProjectedCommitted, retired>>

Init ==
  /\ phase = [fiber \in RuntimeFibers |-> "PENDING"]
  /\ uid = [fiber \in RuntimeFibers |-> fiber]
  /\ listed = [fiber \in RuntimeFibers |-> TRUE]
  /\ target = [fiber \in RuntimeFibers |-> None]
  /\ committed = [fiber \in RuntimeFibers |-> None]
  /\ inFlight = [fiber \in RuntimeFibers |-> FALSE]
  /\ landed = [fiber \in RuntimeFibers |-> 0]
  /\ outcome = [fiber \in RuntimeFibers |-> "bottom"]
  /\ retired = {}
  /\ lastLanding = [fiber \in RuntimeFibers |-> "none"]

ChangeTarget(fiber, provider) ==
  /\ phase[fiber] # "DISPOSED"
  /\ provider \in Targets
  /\ provider # target[fiber]
  /\ target' = [target EXCEPT ![fiber] = provider]
  /\ UNCHANGED <<phase, uid, listed, committed, inFlight, landed,
                 outcome, retired, lastLanding>>

Begin(fiber) ==
  /\ phase[fiber] \in {"PENDING", "FAILED"}
  /\ outcome[fiber] = "bottom"
  /\ target[fiber] # None
  /\ phase' = [phase EXCEPT ![fiber] = "LOADING"]
  /\ committed' = [committed EXCEPT ![fiber] = target[fiber]]
  /\ landed' = [landed EXCEPT ![fiber] = 0]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "begin"]
  /\ UNCHANGED <<uid, listed, target, inFlight, outcome, retired>>

Launch(fiber) ==
  /\ phase[fiber] = "LOADING"
  /\ ~inFlight[fiber]
  /\ landed[fiber] < MaxRuntimeIterations
  /\ committed[fiber] = target[fiber]
  /\ inFlight' = [inFlight EXCEPT ![fiber] = TRUE]
  /\ UNCHANGED <<phase, uid, listed, target, committed, landed,
                 outcome, retired, lastLanding>>

Land(fiber) ==
  /\ phase[fiber] = "LOADING"
  /\ inFlight[fiber]
  /\ inFlight' = [inFlight EXCEPT ![fiber] = FALSE]
  /\ landed' = [landed EXCEPT ![fiber] = @ + 1]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Iter"]
  /\ UNCHANGED <<phase, uid, listed, target, committed, outcome, retired>>

Finish(fiber) ==
  /\ phase[fiber] = "LOADING"
  /\ ~inFlight[fiber]
  /\ landed[fiber] = MaxRuntimeIterations
  /\ committed[fiber] = target[fiber]
  /\ phase' = [phase EXCEPT ![fiber] = "ACTIVE"]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Finish"]
  /\ UNCHANGED <<uid, listed, target, committed, inFlight, landed,
                 outcome, retired>>

Divert(fiber) ==
  /\ phase[fiber] \in {"LOADING", "ACTIVE"}
  /\ (fiber \in retired \/ committed[fiber] # target[fiber])
  /\ phase' = [phase EXCEPT ![fiber] = "UNLOADING"]
  /\ inFlight' = [inFlight EXCEPT ![fiber] = FALSE]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Divert"]
  /\ UNCHANGED <<uid, listed, target, committed, landed, outcome, retired>>

Raise(fiber) ==
  /\ phase[fiber] = "LOADING"
  /\ phase' = [phase EXCEPT ![fiber] = "UNLOADING"]
  /\ inFlight' = [inFlight EXCEPT ![fiber] = FALSE]
  /\ outcome' = [outcome EXCEPT ![fiber] = "error"]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Raise"]
  /\ UNCHANGED <<uid, listed, target, committed, landed, retired>>

Recover(fiber) ==
  /\ phase[fiber] = "UNLOADING"
  /\ IF landed[fiber] > 0
     THEN /\ landed' = [landed EXCEPT ![fiber] = @ - 1]
          /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Unload"]
          /\ UNCHANGED <<phase, committed>>
     ELSE /\ phase' = [phase EXCEPT ![fiber] =
                         IF fiber \in retired THEN "DISPOSED"
                         ELSE IF outcome[fiber] = "error" THEN "FAILED" ELSE "PENDING"]
          /\ committed' = [committed EXCEPT ![fiber] = None]
          /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "L-Unload"]
          /\ UNCHANGED landed
  /\ UNCHANGED <<uid, listed, target, inFlight, outcome, retired>>

RetireEarly(fiber) ==
  /\ phase[fiber] # "DISPOSED"
  /\ fiber \notin retired
  /\ uid' = [uid EXCEPT ![fiber] = NoUid]
  /\ listed' = [listed EXCEPT ![fiber] = FALSE]
  /\ retired' = retired \cup {fiber}
  /\ IF phase[fiber] \in {"ACTIVE", "LOADING"}
     THEN phase' = [phase EXCEPT ![fiber] = "UNLOADING"]
     ELSE phase' = [phase EXCEPT ![fiber] = "DISPOSED"]
  /\ inFlight' = [inFlight EXCEPT ![fiber] = FALSE]
  /\ lastLanding' = [lastLanding EXCEPT ![fiber] = "O-Retire"]
  /\ UNCHANGED <<target, committed, landed, outcome>>

Next ==
  \/ \E fiber \in RuntimeFibers, provider \in Targets : ChangeTarget(fiber, provider)
  \/ \E fiber \in RuntimeFibers :
       \/ Begin(fiber)
       \/ Launch(fiber)
       \/ Land(fiber)
       \/ Finish(fiber)
       \/ Divert(fiber)
       \/ Raise(fiber)
       \/ Recover(fiber)
       \/ RetireEarly(fiber)
  \/ /\ \A fiber \in RuntimeFibers : phase[fiber] = "DISPOSED"
     /\ UNCHANGED vars

RuntimeTypeOK ==
  /\ phase \in [RuntimeFibers -> RuntimePhases]
  /\ uid \in [RuntimeFibers -> RuntimeFibers \cup {NoUid}]
  /\ listed \in [RuntimeFibers -> BOOLEAN]
  /\ target \in [RuntimeFibers -> Targets]
  /\ committed \in [RuntimeFibers -> Targets]
  /\ inFlight \in [RuntimeFibers -> BOOLEAN]
  /\ landed \in [RuntimeFibers -> 0..MaxRuntimeIterations]
  /\ outcome \in [RuntimeFibers -> Outcomes]
  /\ retired \subseteq RuntimeFibers
  /\ lastLanding \in [RuntimeFibers -> {"none", "begin", "L-Iter", "L-Finish", "L-Divert", "L-Raise", "L-Unload", "O-Retire"}]

RetirementRefinement ==
  \A fiber \in RuntimeFibers :
    /\ (uid[fiber] = NoUid => fiber \in retired)
    /\ (~listed[fiber] => fiber \in retired)
    /\ (phase[fiber] = "DISPOSED" => fiber \in retired)

CommittedRefinement ==
  \A fiber \in RuntimeFibers :
    /\ (phase[fiber] \in {"LOADING", "ACTIVE", "UNLOADING"} => committed[fiber] # None)
    /\ (phase[fiber] \in {"PENDING", "FAILED"} => committed[fiber] = None)

BoundedLanding ==
  \A fiber \in RuntimeFibers : landed[fiber] \leq MaxRuntimeIterations

RealmProjectionInjective ==
  \A left, right \in AbstractKeys : left = right => left[1] = right[1] /\ left[2] = right[2]

RuntimeRefinesPaper ==
  /\ RuntimeTypeOK
  /\ RetirementRefinement
  /\ CommittedRefinement
  /\ BoundedLanding
  /\ RealmProjectionInjective

RuntimeSpec == Init /\ [][Next]_vars

====
