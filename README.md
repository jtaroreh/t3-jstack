# t3-jstack, workhorse-advisor.

t3-jstack brings a workhorse-advisor version of [pstack](https://github.com/cursor/plugins/tree/main/pstack) to [T3 Code](https://github.com/pingdotgg/t3code): rigorous agent workflows whose Cursor mechanics are rewritten in place for T3, so every subagent, panel, fan-out, schedule, and PR watch dispatches through T3's `t3-code` MCP tools, and an `interrogate`, `arena`, or `architect` panel can run Claude, GPT, and Grok reviewers side by side, from a Claude Code thread or a Codex thread. It descends from [t3-pstack](https://github.com/chhoumann/t3-pstack) by Christian Bager Bach Houmann and is maintained by jtaroreh. Plugin identity is `t3-jstack`; model sheets from `t3-pstack` installs move to the `t3-jstack` paths on install, and readers fall back to the old paths until they do.

t3-jstack works only inside T3.

## Install

```shell
npx -y github:jtaroreh/t3-jstack install
npx -y github:jtaroreh/t3-jstack update
npx -y github:jtaroreh/t3-jstack doctor
```

`npx -y github:jtaroreh/t3-jstack` runs the installer from the latest commit on `main`. That is the rolling channel, the same one each home's marketplace auto-updates from. To run one release's installer, name its tag, as in `npx -y github:jtaroreh/t3-jstack#v2.1.1 doctor`.

`install` and `update` are the same command, and a second run changes nothing. With Node 20 or later, it installs or updates the `t3-jstack@t3-jstack` plugin in every Claude Code and Codex config home T3 can run: `~/.claude` and `~/.codex`, `$CLAUDE_CONFIG_DIR` and `$CODEX_HOME`, and the home of each `claudeAgent` and `codex` instance in T3's settings, disabled ones included. Name any other home with `--claude-home <dir>` or `--codex-home <dir>`. Each home's `t3-jstack` marketplace must come from `jtaroreh/t3-jstack`, or from `--source <owner/repo|git URL|dir>` on the same run, and a home whose marketplace has another source is left as it is. A local directory needs a path such as `./t3-jstack`, since `owner/repo` always means GitHub. On Codex it also trusts t3-jstack's session-start hook, once its hooks file is the one this release pins. Codex runs a plugin's hook only once it is trusted, and T3's Codex sessions never ask, so without this step the hook never runs. Run `update` after each release.

`doctor` reports on the same homes and changes nothing itself: each marketplace's source, the installed version, whether its files are all there, whether it is enabled, the Codex hook's trust, Claude Code records that pin an old version, plain copies of the plugin's skills, and the model sheet. It exits 1 on any problem and prints a fix for each.

## Use

```text
Use jtaroreh-mode to fix the search filter resetting when I change pages.
```

The session-start hook tells each new chat when to enter `poteto-mode` on its own: work that touches more than one file, a design choice, or a bug whose cause is unknown. `poteto-mode` matches the task to a playbook and opens the other skills from there. They ship as upstream ships them, invoked by `poteto-mode` or typed by you (`/t3-jstack:<name>` on Claude Code, `$t3-jstack:<name>` on Codex).

For a fast workhorse with stronger-model review, invoke `/jtaroreh-mode`. [Jtaroreh mode](plugins/jstack/skills/jtaroreh-mode/SKILL.md) keeps poteto-mode's principles and playbooks. A fast model implements and consults stronger advisors directly. Its optional model-sheet roles are `jtaroreh workhorse`, `jtaroreh advisor`, and `jtaroreh takeover`. Configure them through [setup-jstack](plugins/jstack/skills/setup-jstack/SKILL.md). Existing poteto sheets need no new entries. A parent on another model delegates the bounded task once and integrates its result.

Ordinary implementation receives final review. Consequential decisions receive focused preflight advice. Task notes preserve constraints without a separate state machine. These are agent instructions. The [runtime limits](plugins/jstack/skills/jtaroreh-mode/references/runtime-contract.md) distinguish peer review from host tool enforcement. Automatic session-start routing still enters poteto-mode. Neither mode changes the chat model by loading a skill.

The plugin carries 69 skill directories, 24 of them `principle-*` leaves, and 4 agents.

Optional runtime diagnostics use `node tools/install.mjs doctor --runtime local` or `--runtime cloud --agystack-source /path/to/pstack-agy`. They check local executable and Python-package presence. Authentication, quotas, and model availability remain unproven.

The [agystack capability inventory](docs/agystack-capabilities.md) records the T3-specific integrations and their validation. For Antigravity, use the [agystack integration](docs/antigravity.md). It keeps agystack's playbooks and Cloud Run swarm backend, with T3 owning the controller tasks.

t3-jstack has no server or telemetry. Anything its skills ask your agent to read, including session transcripts, goes to your model provider. Scripts run locally, and PR tools use your GitHub CLI login.

## Model sheet

Run `/t3-jstack:setup-jstack` in a T3 thread on each machine. It writes the model sheet, `~/.config/t3-jstack/models.md`, with one T3 target per role (`<providerInstanceId>/<modelId>` plus that provider's options), and checks it against the machine's `orchestrator_capabilities`. Without a sheet, every role runs on the defaults in its skill's Models section.

## Staying current

This repository syncs from Lauren's tree directly, synced against upstream `e73df47`. `tools/upstream.json` pins each component, `tools/substitutions.json` holds the rewrite rules and a denylist of Cursor terms, and `tools/forks.json` declares every file the port keeps in its own form and why. `bun tools/sync.mjs <component> <sha>` derives each upstream file through the rules, merges it three ways with the port's copy, and fails on an undeclared fork, a denylist hit, or a rule that no longer matches upstream. `tools/sync.mjs` defines and enforces the sync boundary. Release notes for each release live in GitHub Releases.

## Contributing

Bug reports, documentation fixes, and T3 improvements are welcome. Run `bun tools/generate.mjs --check` before opening a pull request. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

t3-jstack is [MIT-licensed](LICENSE). Its T3 modifications and additions are © 2026 Christian Bager Bach Houmann and Joel Taroreh.

[NOTICE.md](NOTICE.md) lists each upstream component with its source commit and license file.
