# Runtime enforcement contract

The shipped mode is a skill-level workflow. Pstack's session-start hooks inject instructions. They do not intercept every tool call or authenticate advisor authority. This document defines additional host work required before calling the architecture enforced.

## Gate actions outside the workhorse

Implement classification and authorization in the host's tool dispatcher before execution. Cover every mutating tool, including shell commands, scripts, network clients, indirect writes, and delegated children. Unknown operations require review. Regex is a routing signal, not a complete shell analyzer or security boundary.

Bind each review to the exact tool arguments, target, artifact digest, requirement revision, and constraint revision. Recheck them immediately before execution. Changed preconditions require a fresh verdict. Apply user approval separately. Never treat a review token as user authorization.

Give advisors read-only tools in the host. Give workhorses narrowly scoped write capabilities. Persist state through a single writer with atomic replacement or transactional compare-and-swap. Reject stale results even when they say PASS. Protect the record from workhorse writes using actual filesystem or service permissions. A prompt calling a scratchpad read-only cannot provide that protection.

## Acknowledge without leaking an unreviewed answer

Send one factual acknowledgment immediately. Run consultation and safe inspection concurrently where supported. Buffer the substantive answer and side effects until the applicable review finishes. Ordinary APIs do not imply support for injecting new system instructions into an in-flight generation. Resume at a message boundary or restart generation from the new snapshot.

Avoid repetitive filler. Measure acknowledgment latency, time to useful answer, and total completion latency separately. Do not promise under 300 ms or assume an advisor finishes while the user reads two sentences.

## Preserve authority and context

Inject a compact, current constraint projection at each generation boundary. Keep permanent role and authorization rules in their correct system or developer messages. Task constraints cannot overrule the user or those higher-priority instructions. Do not concatenate untrusted conversation text into a system message to obtain a shared prefix.

Record the revision the model actually received. On context compaction or restart, reload canonical state and reconcile with current requirements and artifacts. Recency helps attention but does not guarantee compliance. The tool dispatcher remains responsible for enforcement.

## Treat confidence as an optional signal

Use log probabilities only if the selected provider and model expose them. They are token probabilities, not calibrated probabilities that the answer is correct. A confidence threshold needs workload-specific calibration and cannot replace action gates or independent verification. Missing log probabilities must never disable the reviewed path.

## Optimize caching within supported boundaries

Keep stable instructions and reusable evidence stable within each advisor model's supported caching arrangement. Append changing task data where that API permits. Do not assume identical text shares KV state across Gemini and a different advisor model or provider.

Check cache usage in actual provider responses. Pricing, cache lifetimes, prefix thresholds, and cache scopes depend on the provider and model. Supported prefix reuse does not establish a cache hit or a fixed savings percentage. The [OpenAI caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) and [Claude caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) document their respective boundaries.

## Measure before promoting

Use representative held-out tasks against a frontier-only baseline. Include advisor calls, cache writes and reads, retries, takeover, coordinator overhead, and failures in cost and latency. Measure task success and severe errors separately. Run stale-verdict, advisor-outage, changed-requirement, and indirect-mutation cases against the real host gate.

The proposed 65 to 80 percent cost reduction, threefold speedup, and frontier-level reliability are hypotheses. This skill supplies no measurements supporting them.
