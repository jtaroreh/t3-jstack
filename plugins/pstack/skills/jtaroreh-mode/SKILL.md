---
name: jtaroreh-mode
description: Use jtaroreh-mode for a Gemini 3.8 Flash workhorse that consults stronger models for plans, verification, and bounded takeovers in T3 Code.
---

# Jtaroreh mode

Use Gemini 3.8 Flash for routine execution. Use a stronger advisor to challenge risky plans and judge the resulting artifact. Keep the workhorse as the main author unless it cannot implement a correction.

This mode owns routing while active. Reuse relevant sibling skills by path without importing poteto-mode's default implementation delegation. Preserve higher-priority host instructions and user authorization.

## Establish the session

1. Send a short, task-specific acknowledgment before consulting. State the next useful action. Do not claim work or verification that has not happened.
2. Call `orchestrator_capabilities` with `search: "Gemini 3.8 Flash"`. Read the model sheet at `$XDG_CONFIG_HOME/t3-pstack/models.md`, or `~/.config/t3-pstack/models.md`. If missing, use `t3-pstack-models.md` in the host config directory.
3. Resolve the requested workhorse from the live catalog. Prefer an enabled provider with the exact Gemini 3.8 Flash label and delegation support. Use only its advertised options. Never replace an unavailable model silently.
4. Resolve the advisor from the sheet's `judgment and prose` role and takeover from `hardest tasks`. Their defaults are owned by [poteto-mode's Models section](../poteto-mode/SKILL.md#models). Require a different model from the workhorse. Prefer a different family for independent review. If no suitable advisor can run, keep review-required work blocked.
5. Inspect the parent's provider, model, and options. A skill cannot switch the current chat's model. If the parent is Gemini 3.8 Flash, execute routine work here. Otherwise keep this parent as coordinator and delegate execution to Gemini. Disclose that arrangement and its unmeasured overhead once. Do not start a new top-level thread.
6. Read [the consultation protocol](references/protocol.md). Create a task-scoped record at `.audit/jtaroreh/<session-id>/state.json`, outside tracked delivery when it contains private context. Use a unique session ID and one coordinator as its sole writer.

T3 children get only their supplied brief. Pass absolute paths, the raw relevant user requirements, current constraints, exact artifact identity, and permitted actions. Use `delegate_task` with `mode: "async"`, an explicit catalog target, and a distinct stable `clientRequestId` for each logical dispatch. Retain every `taskId`. Validate the returned provider, model, and options. Do not substitute prompt text for unsupported model settings.

An async completion wakes the parent. Continue independent useful work, or end the turn with an accurate pending status. Do not poll for the child's completion. Use `task_status` when its result is needed during active work.

## Route every unit of work

Classify before acting and again when scope changes. A unit is one plan, bounded edit, answer, or external action. Several small edits in one task count together.

Use the direct path only for read-only inspection, summaries of supplied material, formatting, and contained reversible edits with obvious verification. A task in any category below takes the reviewed path even if the workhorse feels confident.

- Architecture, concurrency, security, cryptography, authentication, authorization, data migrations, or mathematical proofs.
- Financial, medical, or legal conclusions where an error materially affects the user.
- Multi-file changes, changed public signatures, non-obvious bugs, or a cumulative diff above 30 added and deleted lines. Count a replacement as a deletion plus an addition. Thirty lines is a routing heuristic, not evidence that smaller changes are safe.
- Commands or tools that mutate service data, alter infrastructure, publish, deploy, delete user data, change permissions, transmit messages, spend money, or have unknown effects. Contained local edits meeting the direct-path criteria and coordinator state maintenance are exempt from this mutation trigger. Other risk categories still apply to them.
- A failed check, contradicted assumption, unresolved API behavior, or workhorse request for help.

Advisor review is separate from user authorization. A PASS grants no permission to send a message, deploy, or perform another action outside the authorized task. Existing user authorization remains valid. Ask only when the discovered effects exceed it or a higher-priority rule requires approval. Never classify a shell tool by its name alone. Inspect the command, target, and consequences. Unknown effects take the reviewed path.

For reviewed work, send an acknowledgment and gather read-only evidence immediately. Obtain advisor review before committing to the risky plan or action. Reversible local implementation follows the reviewed plan. Obtain a final artifact review after verification and before presenting completion or executing an external mutation.

This classification is an instruction to the agent, not a runtime interceptor. Do not advertise deterministic enforcement unless a host actually supplies it. Read [the runtime contract](references/runtime-contract.md) when discussing deployment, enforcement, caching, or latency.

## Consult and verify

1. Snapshot the task revision, active constraint revision, exact proposed action or artifact, assumptions, workhorse draft, and raw supporting evidence. Give the advisor repository paths or a diff as well as the draft. A workhorse summary alone is insufficient.
2. Dispatch a read-only advisor using the prompt and response contract in [the consultation protocol](references/protocol.md). Ask it to identify defects, contradicted constraints, and missing evidence. Request compact output, not private reasoning. A brief asking for brevity is not an enforced token budget.
3. Accept only a complete response matching the protocol for that snapshot. A stale, malformed, truncated, unavailable, or timed-out response cannot pass the gate. Allow one fresh retry for a malformed response or transient failure, then report the blocked unit. No silent PASS or automatic provider substitution. Count every advisor dispatch before sending it. Permit at most eight advisor dispatches per unit across plan, artifact, action, retries, and constraint refreshes. Persist that count across revisions. If another review is needed after the limit, block the unit. Never create a new unit ID just to reset its budget.
4. Apply accepted constraint changes through the coordinator. Reload active constraints before the next plan, delegation, action, or final answer. Invariants are task records, not higher-priority instructions. User changes can obsolete them after reconciliation with actual requirements.
5. On `REVISE`, let the workhorse make one correction and run the real verification. Obtain a fresh review of the changed artifact. A second `REVISE` or an immediate `TAKEOVER` hands the bounded difficult part to the takeover model.
6. On takeover, request the smallest patch, proof, or corrected block plus its verification requirements. Stop any writer that could overlap first. Confirm it is terminal with no pending child runs. A writing child gets an isolated worktree based on the intended commit. Uncommitted files are not copied, so provide them explicitly when needed. Review and apply the returned artifact, then verify and obtain a fresh read-only advisor verdict. Permit one takeover attempt. Unresolved findings then block completion.
7. On `PASS`, check that the artifact, requirements, and constraint revisions still match. Run the task's real checks. A plan PASS never covers the final artifact. Tests passing never replace required independent review.

An advisor supplies proposed constraints and critical blocks. The coordinator resolves conflicts with the user's actual requirements. Never paste an advisor command or patch blindly. Match its anchors against the current artifact and compare required blocks byte-for-byte in the intended file or answer. Reject missing, duplicate, changed, or misplaced anchors. Any accepted change invalidates the previous artifact verdict.

## Preserve state and ownership

Keep one versioned record for the task. Store requirement revisions, active and obsolete constraints, artifact identities, review results, retries, and dispatch identities. Store evidence paths rather than full transcripts or secrets. Resume by reading that record and checking it against the current files and latest user requirements. Missing or changed evidence returns the unit to review-required.

Children return proposed updates and never write the state record. Workhorse children write only their assigned isolated artifacts. Advisor children inspect only and spawn nothing. Read-only briefs are behavioral limits until the host enforces tool permissions.

Keep the advisor visible in the final dispatch ledger when it ran. Do not pretend an independent check was your own unaided judgment. Use concise progress updates instead of filler or invented activity.

## Deliver

Run verification appropriate to the actual artifact. Use a project's existing control skill when available. Read [unslop](../unslop/SKILL.md) for user-facing prose and [technical-writing](../technical-writing/SKILL.md) for documentation. Use [interrogate](../interrogate/SKILL.md) when the user requests a diverse adversarial panel or the design remains contested.

Report the outcome, material limitations, actual checks, unresolved findings, and pending tasks. Include a compact dispatch ledger with each role's returned provider/model and relevant options. Label blocked review as blocked. Report costs, cache hits, quality, and latency only when measured. This mode promises no savings percentage or reliability equivalence.

For development of this skill, run [the forward tests](references/forward-tests.md).
