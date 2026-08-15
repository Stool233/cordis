# Optional Specula trace debugging

Specula is not a build or CI dependency. Its trace debugger can be used interactively when `formal:trace` or a mutation check leaves an NDJSON trace and TLC counterexample under `formal/output/`.

The guidance below is pinned to Specula 1.1.0 at the revision in [`provenance.json`](provenance.json).

## Setup

From a separate Specula checkout:

```sh
cd tools/trace_debugger
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Register `tools/trace_debugger/mcp_server.py` with the client as documented by Specula. Do not copy the debugger, its virtual environment, or its JAR cache into Cordis.

## Failure workflow

1. Read `formal/output/failures/<case>.json`. Record `theorem`, `action`, `traceLine`, implementation revision, and the referenced NDJSON file.
2. Call Specula’s `get_trace_info` for the NDJSON file and confirm the line count and first/last envelopes.
3. Call `run_trace_validation` with:
   - `spec_file`: `CordisTrace.tla`
   - `config_file`: `config/CordisTrace.cfg`
   - `trace_file`: the failing NDJSON path
   - `work_dir`: the absolute `formal/` directory
   - the exact TLA+ and CommunityModules JAR paths verified by the Cordis runner
4. Inspect the NDJSON line named by the failure report. In this specification `cursor` is the next line to consume; a stopped cursor identifies the first unmatched observation.
5. Use `run_trace_debugging` with breakpoints at `TraceStep`, the matching case in `ObservedStep`, and its action predicate. Condition the breakpoints on `cursor = <failed-line>` and evaluate `point`, `logline.observation`, `abstractState`, and `logline.state`.
6. Reduce the scenario while preserving the same failed theorem/action/line. Save the reduced NDJSON and TLC JSON counterexample in the failure output.

Classify the result before changing code:

- If the implementation post-state violates the paper predicate, fix the implementation and retain the minimal trace as a regression.
- If the observation omitted an implementation write, fix the trace hook and observation manifest.
- If the refinement mapping is wrong, change `CordisRuntime.tla` or the recorder only when the paper-visible states remain equivalent.
- If a declared premise is false, change the report to `not-applicable`; do not relax the theorem predicate or report a pass.

The failure is resolved only when the reduced trace and the original scenario are both fully consumed by `TraceMatched` and the corresponding mutation remains rejected.
