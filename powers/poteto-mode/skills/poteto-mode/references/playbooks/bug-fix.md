### Bug fix

**You own this task. Plan, review, verify.** Delegate investigation and the fix to subagents, stay in the lead.

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might help" is a hypothesis, not a fix. It does not ship. When evidence refutes a hypothesis, revert what it motivated. The smallest change the evidence justifies ships, nothing more.

1. Reproduce it yourself on the matching surface (run the app, the CLI, the test), even when a debug or instrumentation protocol says to ask the user to reproduce. Ask the user only with a stated, specific reason you cannot reach the target, and only after driving it as far as it goes. If it won't reproduce directly, synthesize the trigger, tighten conditions, or instrument until it fires.
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them by reading the affected subsystem and its history (`git log`, `git blame`). Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. The `systematic-debugging` skill covers the loop. Confirm the surviving *mechanism* with runtime evidence before step 3.
3. Plan the fix. If it crosses a function boundary, explore the design first with the `codebase-design` skill. Delegate implementation to a subagent (`agent/runSubagent`) with a specific scope.
4. Verify on the same surface. The original repro now passes. "Inconclusive" or wrong-surface is not a pass. Flag it. Unit tests show branch behavior, not bug absence.
5. Stage the commits so the failing repro lands before the fix in git history. See the `tdd` skill for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear.
   This is the canonical **Sequence Work into Verifiable Units** principle, the failing test first and the fix on top.
6. Open the PR (or hand the branch back) with the reply below.

**Reply:** what was broken, root cause, fix, how you verified. Paste failing-then-passing repro output verbatim.
