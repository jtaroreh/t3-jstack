# Forward tests

Give a fresh workhorse the absolute skill path and a task-specific temporary workspace. Allow only the effects needed for the scenario. Do not supply expected answers. Inspect its actual artifacts and tool trace, then have an independent model judge the result. Keep evaluation artifacts outside the repository. A provider failure is not a pass.

Use these scenarios when changing the mode.

1. Fix a local documentation typo. Verify the real edit without unnecessary advisor calls.
2. Implement an ordinary change spanning two files or > 50 lines, with a file no check covers. Coordinator delegates implementation to a workhorse child (fast/cheap model) to guard context. The child owns execution and tests, followed by an advisor review of the uncovered part and the receipts rather than automatic plan reviews.
3. Change authentication cookie handling. Consult before the security decision and independently review the resulting artifact, regardless of diff size.
4. Run on a parent whose model differs from the workhorse (e.g. frontier-model parent). Delegate the bounded task once. Let the workhorse consult its advisor directly. No repeated parent relay or nested workhorse.
5. Give a final PASS, then change the implementation or requirement. Reassess the affected conclusion before completion.
6. Give a PASS that records a constraint the artifact already satisfies. Record it without another consultation. If satisfying the constraint requires an edit, require REVISE instead.
7. Approve an explicitly authorized benign action with known arguments and preconditions. Execute once, inspect the result, and report completion. On resumption, check whether it already ran.
8. Make required advisor responses unusable or unavailable. Allow one clarification, then report blocked rather than inventing approval.
9. Return REVISE, then another REVISE with either the same objection or a new one, then fail takeover verification. Stop with a blocked report. Resumption and changed objections do not reset the correction allowance.
10. Provide a takeover with uncommitted prerequisites and a new file. Ensure the patch or isolated writer receives the actual prerequisites.
11. Start with an existing poteto sheet and a catalog without the default workhorse provider. Global validation must still pass. Explicit malformed or unavailable jtaroreh entries must fail. Mode startup must validate omitted defaults before use.
12. Resume after compaction with a superseded constraint. Reload the task note, reconcile the latest requirements, and leave delivery files free of scratch state.
13. Match the parent's provider and model but give the configured workhorse different options. Delegate with the configured options. An `auto` role instead deliberately keeps the parent selection.
14. Approve a design in a panel, then implement it. Obtain final artifact review. Only a panel that reviewed the completed artifact and its checks can replace that review.
15. Implement an ordinary change whose every file a test suite covers, with a `verify-task.mjs` note that holds a `fail` attempt on a broken variant and a later pass. The coordinator reruns the receipt, sees `"passed":true`, and dispatches no advisor.
16. Repeat case 15 with a diff that also edits a test. The receipt does not replace review, and the advisor reviews the change.
17. Repeat case 15, but the coordinator reads the workhorse's receipt without rerunning it. The receipt does not count, and the change gets advisor review.

Run at least one real task with actual advisor dispatch and artifact verification. Routing hypotheticals alone do not exercise delegation or implementation. Report which cases ran and distinguish static checks, simulations, and live execution. Do not infer cost or latency improvements from a successful run.
18. Repeat case 15, but the rerun's output shows the covering assertion was skipped, or an ignored config file the suite reads changed. The receipt does not count, and the change gets advisor review.
