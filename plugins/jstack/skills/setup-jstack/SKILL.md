---
name: setup-jstack
description: Configure which T3 provider and model pstack uses per role and at what reasoning budget. Detects the models T3 can run and writes the model sheet that overrides the skill defaults. Use for /setup-jstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write the model sheet, `~/.config/t3-jstack/models.md` (`$XDG_CONFIG_HOME/t3-jstack/models.md` when that is set), one per machine. It sets pstack's T3 provider and model per role, and every pstack skill reads it before it dispatches.

## Steps

### 1. Detect available models

For Muse Code plugin loading or a Muse delegation target, read the [Muse Code adapter](../muse-code/SKILL.md) first. It separates plugin discovery from model execution readiness.

Call `orchestrator_capabilities`, or `acp-mcp-call orchestrator_capabilities '{}'` where the T3 tools are not exposed. Its provider instances and their models are the dependable source. A target is valid only when its provider instance can run a child task and lists the model. Note each provider's own option IDs and values, such as `effort` on Claude and `reasoningEffort` on Codex and Grok. Never write a target you have not seen there. The aliases `inherit-parent` and `auto` are always valid.

### 2. Load current state

The default role-to-target mapping is the sheet shape in step 5 below. Read the machine sheet when it exists and treat its `# budget` line and its role values as the current choices. Whether or not it exists, also read every legacy location without changing it: the `t3-pstack` machine sheet (`~/.config/t3-pstack/models.md`, `$XDG_CONFIG_HOME/t3-pstack/models.md` when that is set, where releases before the rename kept the sheet) and both `t3-jstack-models.md` and `t3-pstack-models.md` in each host's config directory (`$CLAUDE_CONFIG_DIR` or `~/.claude` on Claude Code, `$CODEX_HOME` or `~/.codex` on Codex). Step 5 preserves what these hold, so read them before deciding anything. When the machine sheet is absent and the legacy locations hold exactly one distinct content between them, treat it the same way. When nothing is found anywhere, start from the defaults. When the legacy locations disagree with each other, or with an existing machine sheet, report each differing path and ask which file's choices to build on (or the defaults); never merge sheets or silently prefer one. Use the roles and aliases in `<plugin root>/models.json` as the vocabulary, including optional mode roles shown as comments in step 5. Preserve existing explicit optional entries. A line whose role is not in that registry, such as `how critics`, is from a retired role. Drop it. Carry a `strongest judgment` value over to `hardest tasks`, its new name. Also drop any value that is not a T3 entry, such as a bare family name, a `claude-` slug, or an `@<level>` suffix, and a `default effort` line.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Ask a structured multiple-choice question (`AskUserQuestion` on Claude Code, numbered options in plain text elsewhere). Offer these four options with these exact labels, and name the current budget when the sheet records one. With no sheet, say that `large` matches the skill defaults.

- `unlimited - max reasoning`
- `large - xhigh reasoning`
- `medium - high reasoning`
- `small - medium reasoning`

**(b) Apply it.** Build the working table from nonoptional defaults and already-configured optional entries. Leave other optional mode roles omitted unless the user selects that mode or those roles. On a re-run keep any role you changed by provider, list, or alias (`inherit-parent`, `auto`). `unlimited`, `large`, `medium`, and `small` set the reasoning option of every entry, panel entries included, to `max`, `xhigh`, `high`, or `medium`. Use the option ID that provider lists. If the provider does not offer that value, use its highest value at or below the target, else mark the role as needing a choice. So Grok, whose reasoning tops out at `xhigh`, stays at `xhigh` under `unlimited`. `inherit-parent` and `auto` do not change.

**(c) Show the roles and confirm.** Show every selected role with its entry. List unselected optional mode roles separately as available choices, without requiring their providers. Mark any selected target not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles, offering the detected targets plus `inherit-parent` and `auto` (both mean: this role runs on the parent chat's model) as the options. For panel roles (`arena runners`, `architect runners`, `interrogate reviewers`) the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. A panel needs at least two model families among its targets. A model's family is the first segment of its ID's last `/` part, such as `claude`, `gpt`, or `grok`. `arena cross-judge pool` is also a list, but Arena selects one value from it whose model ran no candidate and whose family differs from the parent's when possible. `swarm workers` is the default target for every worker unless a race or comparison assigns another per arm.

**(d) Ask about the session-start hook.** Ask whether t3-jstack's session-start hook should keep telling new chats when to enter `/poteto-mode`. Write `session hook: on` or `session hook: off`.

### 4. Validate

Write the candidate to a temp file. Call `orchestrator_capabilities` again and save its result to a temp file as `{"providers": [...]}`, copying verbatim the entry of every provider instance the candidate or the defaults name. Run `node <plugin root>/skills/setup-jstack/scripts/t3-sheet.mjs <candidate> <catalog.json>`, where `<plugin root>` is the directory that holds this plugin's `skills/`, and fix every line it prints. If `node` is missing, check each entry against the catalog by reading, and say so. A nonoptional role with no line runs on its default, so add a line if this machine cannot run it. Leave unselected optional roles omitted. Their modes validate resolved defaults when invoked.

### 5. Write the sheet

Write the candidate to the sheet path, creating its directory. When the path is absent, write it. When it is a symlink, resolve it with `realpath`: a link the installer manages (into a config home) is followed, while a link to a file outside every config home, such as a dotfiles checkout, is the user's own file, so keep the link and write through it only with explicit approval. When a different file already holds the path, run the checker on it, show what it holds, and ask before replacing it; on a refusal leave it and report that the sheet was not written. Write the whole file so re-runs stay idempotent. Then point each host's `t3-jstack-models.md` at the sheet with a link (`ln -sf`), creating it when absent: leave an existing symlink exactly as it is so no linked file is orphaned, and when an existing file's bytes differ from the new sheet, leave it in place and report it, linking it only with explicit approval. For the `t3-pstack` machine sheet and each `t3-pstack-models.md` that already exists, never create one that is not there: leave a symlink as it is, replace a byte-identical file with a link to the sheet so an older install reads the same sheet, and leave a differing file in place and report it, converting it only with explicit approval. Step 2 already read what each held. On Codex, ask before removing any pstack model rows an earlier setup pasted into `<codex-home>/AGENTS.md`. With every default kept, the sheet reads:

```markdown
# pstack model configuration (T3). One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat's model (`delegate_task` omits `target`). Alias entries in a panel list still count toward its fan-out.
# budget: large (xhigh)
# Optional mode roles are commented out. Configure them when selecting that mode.
feature, refactoring: claudeAgent/claude-opus-5-5 effort=xhigh
bug-fix: claudeAgent/claude-fable-5-1 effort=xhigh
perf-issue: claudeAgent/claude-fable-5-1 effort=xhigh
hillclimb: claudeAgent/claude-fable-5-1 effort=xhigh
judgment and prose: claudeAgent/claude-opus-5-5 effort=xhigh
hardest tasks: claudeAgent/claude-fable-5-1 effort=xhigh
how explorer: claudeAgent/claude-opus-5-5 effort=xhigh
how explainer: claudeAgent/claude-opus-5-5 effort=xhigh
why investigators: claudeAgent/claude-opus-5-5 effort=xhigh
why synthesizer: claudeAgent/claude-opus-5-5 effort=xhigh
reflect tooling: claudeAgent/claude-opus-5-5 effort=xhigh
reflect judgment, divergent, synthesizer: claudeAgent/claude-opus-5-5 effort=xhigh
arena runners: claudeAgent/claude-opus-5-5 effort=xhigh, codex/gpt-6.1-sol reasoningEffort=xhigh, grok/grok-4.7 reasoningEffort=xhigh
arena cross-judge pool: claudeAgent/claude-opus-5-5 effort=xhigh, codex/gpt-6.1-sol reasoningEffort=xhigh, grok/grok-4.7 reasoningEffort=xhigh
swarm workers: claudeAgent/claude-opus-5-5 effort=xhigh
architect runners: claudeAgent/claude-opus-5-5 effort=xhigh, codex/gpt-6.1-sol reasoningEffort=xhigh, grok/grok-4.7 reasoningEffort=xhigh
interrogate reviewers: claudeAgent/claude-opus-5-5 effort=xhigh, codex/gpt-6.1-sol reasoningEffort=xhigh, grok/grok-4.7 reasoningEffort=xhigh
# jtaroreh workhorse: antigravity/gemini-3.8-flash-high
# jtaroreh advisor: claudeAgent/claude-opus-5-5 effort=xhigh
# jtaroreh takeover: claudeAgent/claude-fable-5-1 effort=xhigh
session hook: on
```

### 6. Confirm

Tell the user the sheet was written and that it applies to new sessions. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, read [`../create-verification-skill/SKILL.md`](../create-verification-skill/SKILL.md) from this file and follow it. Do not call the Skill tool for it, since that tool refuses a skill only the user may invoke. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill." On yes, read [`../create-formal-verification-skill/SKILL.md`](../create-formal-verification-skill/SKILL.md) from this file and follow it. Do not call the Skill tool for it, since that tool refuses a skill only the user may invoke. On no, move on without pushing.
