---
name: muse-code
description: Integrate t3-jstack with Muse Code, verify plugin and skill loading, or select Muse as a T3 delegation target. Use for Muse Code setup and compatibility work. This adapter keeps T3 orchestration separate from Muse-native subagents.
---

# Use pstack with Muse Code

## Check the installed runtime

Run `muse --version`, `muse plugins --help`, and `muse skills --help`. Use the installed CLI contract when it differs from cookbook examples. Muse Code 1.4.7 accepts this plugin's Claude-compatible manifest and discovers its skills. This does not establish compatibility with its session hook or prove a model can run.

For local installation, resolve the plugin root that contains `skills/`, `agents/`, and `.claude-plugin/plugin.json`. Run these commands with that absolute path in place of `<plugin-root>`.

```sh
muse plugins validate <plugin-root> --json
muse plugins install <plugin-root> --scope user --json
muse plugins inspect t3-jstack --json
muse skills list --source plugin --json
```

Inspect diagnostics and capability states. The existing installer manages Claude Code and Codex homes. Use Muse's own plugin commands for Muse. Do not invent a Muse config home, copy skills individually, or add a root `plugin.json` to the shared plugin. Skills refer to sibling skills and agent briefs.

Do not approve imported hooks merely to enable skills. The current session hook targets Claude Code or Codex and has no verified Muse contract. Keep it unapproved unless a Muse-specific hook test proves its behavior. After source edits, run `muse plugins update t3-jstack --json` and inspect the installed skills again. Installation uses a cached copy.

## Select Muse as a T3 worker

Call `orchestrator_capabilities` before dispatch. Use the exact provider instance ID, model ID, runtime modes, and option IDs it advertises. A provider named `muse` can be disabled. A Muse model offered by another provider is a different target with its own options.

If the short catalog omits a requested Muse model, search capabilities for that model. A disabled provider, an absent model, or a provider unable to run child tasks is unavailable. Report the reason. Preserve the model sheet and do not switch providers without authorization. Use [setup-pstack](../setup-pstack/SKILL.md) when the user requests role changes.

On T3, dispatch through `delegate_task`. Give writing children `isolation: "worktree"`; T3 creates and binds the checkout. Record task IDs and obey each result's `next` instruction. Cancel an abandoned child with `task_cancel` before replacing work it could still write. Use `task_status` to confirm cancellation, not to poll a running child. Give children explicit scope and no further delegation unless the task requires it.

Do not replace T3 child tasks with Muse-native `subagent_*` tools, a nested `muse exec`, or new top-level threads. Standalone Muse fanout is a separate workflow. Its worktree flag and cooperative cancellation are not evidence of T3 isolation or cancellation behavior.

## Load skills and preserve the task

Read the full selected pstack skill before applying it. If inspection returns a `plugin://` path, obtain `record.cache_path` from `muse plugins inspect t3-jstack --json` and resolve the skill under that package directory. Follow relative links from that installed skill location. Check `muse skills list` for the actual installed IDs and activation states. Do not assume namespaced Claude or Codex shortcuts are valid Muse commands.

Muse's bundled plan, grilling, grill-with-docs, and taste skills are explicit choices. Do not auto-invoke them because poteto-mode selected planning, review, or UI work. The cookbook scopes those bundled instructions to the invoking turn. Keep acceptance checks and task IDs in the task's existing note across turns rather than assuming a prior invocation stays active.

A request to integrate Muse does not authorize creating a persistent goal or schedule. Keep T3 scheduling in T3 when that is the user's chosen host. Muse loop and cron commands have their own persistence, timezone, and timing behavior.

## Verify the claimed behavior

Plugin validation proves package recognition. Skill listing and inspection prove discovery and installed content. For execution readiness, dispatch a bounded read-only child through the advertised Muse target and inspect its result. For isolation claims, inspect the actual T3-created checkout before permitting writes. A disabled provider leaves execution unverified even when plugin installation succeeds.

Treat session logs as evidence of recorded events. Replay checks event-to-context projection, not tool re-execution or instruction following. Inspect fixture load errors and projection differences as well as the exit code. Keep approvals and sandbox controls in the runtime; skill prose does not enforce them. Do not weaken guardrails to make installation or a check pass.

## Sources

Consult these recipes for their native Muse contracts. Verify commands against the installed CLI before using them.

- [Bundled skills](https://github.com/meta-models/meta-model-cookbook/blob/main/04_muse_code/08_bundled_skills/README.md).
- [Subagent fanout](https://github.com/meta-models/meta-model-cookbook/blob/main/04_muse_code/06_subagent_fanout/README.md).
- [Deterministic replay](https://github.com/meta-models/meta-model-cookbook/blob/main/04_muse_code/02_deterministic_replay/README.md).
- [Immutable guardrails](https://github.com/meta-models/meta-model-cookbook/blob/main/04_muse_code/05_immutable_guardrails/README.md).
- [Loop and cron](https://github.com/meta-models/meta-model-cookbook/blob/main/04_muse_code/09_loop_and_cron/README.md).
