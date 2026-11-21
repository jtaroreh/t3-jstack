# Antigravity: t3-jstack and agystack under T3

T3 starts each Antigravity instance on a private profile, `<profile>`, which is `~/.t3/userdata/providers/antigravity/<SHA-256 of the instance ID>` (`$T3CODE_HOME/userdata/...` when `T3CODE_HOME` is set). Antigravity in a T3 thread reads that profile and never reads `~/.gemini`. An Antigravity thread gets t3-jstack in one of two ways.

| | Default: the t3-jstack plugin | Opt-in: the agystack projection |
| --- | --- | --- |
| What you get | The same skills every other provider gets | agystack's Gemini-native playbooks and its Cloud Run swarm, routed through T3 |
| Command | `npx -y github:jtaroreh/t3-jstack install` | `t3-antigravity install`, or `node tools/antigravity.mjs install` from a clone |
| Writes | `<profile>/config/plugins/t3-jstack` for each Antigravity instance in T3's settings | `<gemini-home>/skills`, where `<gemini-home>` is `--gemini-home`, else `<profile>/config` |
| Needs | Antigravity CLI 1.5.0 or later | The agystack plugin, by default at `~/.gemini/config/plugins/agystack` |

The general installer copies only the plugin. It never runs the projection and never writes `<profile>/config/skills`. The [README](../README.md) covers the plugin. The rest of this page covers the projection.

## Both in one profile

A profile with the plugin and the projection has two copies of most skill names. Antigravity's choice between two skills with one name is unproven. `node tools/install.mjs doctor` warns about each profile that has both. To keep one, do one of these:

- Turn the plugin off. Set `"plugins": { "t3-jstack": { "enabled": false } }` in `<profile>/config/config.json`.
- Remove the projection. Delete each path that `<profile>/config/skills/.t3-agystack-manifest.json` lists, then delete the manifest.

## Usage

Install the projection:

```sh
t3-antigravity install
```

With no `--gemini-home`, both verbs use the one Antigravity profile T3 has created. They stop with exit 1 and write nothing in these cases:

- T3 has created no Antigravity profile yet. Start an Antigravity thread in T3 once, or pass `--gemini-home`.
- T3 has created more than one Antigravity profile. The message lists each `<profile>/config`. Pass the one you want as `--gemini-home`.

A profile whose `config/skills` is a symlink to `~/.gemini/config/skills` reaches the projection that an older install wrote there. Doctor reads it as that one projection. Install with no flag refuses to write through the link, because it leads outside the profile, and names `--gemini-home`. Pass `--gemini-home ~/.gemini/config` to update that projection.

Both verbs accept:

| Flag | Meaning |
| --- | --- |
| `--gemini-home DIR` | Gemini config home. Default `<profile>/config` for the one Antigravity profile T3 has created |
| `--agystack-source DIR` | agystack plugin directory. Default `~/.gemini/config/plugins/agystack`, or `<gemini-home>/plugins/agystack` when you pass `--gemini-home` |
| `--json` | machine-readable report on stdout |

Exit codes are 0 for success, 1 for a blocked install, a degraded doctor, a projection that is absent, or a missing or ambiguous T3 profile, and 2 for a usage error. With `--json` every outcome, usage errors included, is a parseable report on stdout. The report's `from` field names where `<gemini-home>` came from, such as `T3 instance antigravity` or `--gemini-home`. An installed t3-jstack package puts the `t3-antigravity` bin on PATH. From a clone, `node tools/antigravity.mjs` works directly.

Inspect without touching anything:

```sh
t3-antigravity doctor
t3-antigravity doctor --json
```

Reinstall from a different source to move or upgrade the agystack plugin the projection reads from. Every install is idempotent: an unchanged source writes nothing.

## What an install writes

The destination is `<gemini-home>/skills`, and nothing else.

- One real skill directory per agystack source skill. Its `SKILL.md` is the native bytes with a T3-only routing note inserted after the frontmatter, and a `t3-agystack generated` comment bound to the native source hash. The native text is byte-for-byte preserved; the note is the only insertion.
- One relative symlink per other native file, so every relative pointer inside a projected skill, including nested `scripts/...` and `references/...`, reads native content from the plugin source. Each link is a relative path from the projected file to the source file, so a home that moves together with its source keeps resolving. Directory symlinks are deliberately not used, because a directory symlink lets `../` paths escape into the source tree and bypass projected overrides.
- The adapter skill `t3-agystack`, copied byte-for-byte from the installed t3-jstack package. Its bridge scripts (`scripts/cloud-run.mjs` and the sibling modules) are copied as a set when the package ships them, keeping the skill's relative references working.
- A manifest at `<gemini-home>/skills/.t3-agystack-manifest.json` (schema 1). It records exactly the projection's own entries: path, kind, content hash, the native anchor hash, and link targets. Nothing else is listed there, and user-owned files are never adopted into it.

## Safety behavior

- Validate, then write. A collision (any pre-existing, unowned path the projection would write) or drift (an owned generated file whose bytes changed since the last install) fails the whole install before the first write. Restore or remove the file by hand, then install again.
- A missing or unreadable manifest is refused, not adopted. After a crash between writes the projection exists without a manifest, and the next install fails loudly instead of claiming those paths.
- Owned entries the source no longer ships are retired by the next install, because the projection owns them. User-owned entries are never modified, moved, or removed, even when byte-identical to what the projection would write.
- Same-dir atomic writes; the manifest lands last, so a crash can never leave a manifest promising files that were never written.

## The T3 adapter behavior

Every projected `SKILL.md` carries the routing note. It activates only when a `delegate_task` tool is callable in the session, or the environment sets `T3_ACP_MCP_NODE` **and** that variable names an existing, runnable file; both predicates appear in every conditional entry, in that order. When active, the note takes precedence over native orchestration references in the loaded agystack skill and hands control to the `t3-agystack` skill: the one explicit coordinator session, T3 child lifecycles, the structured delegate envelope, and exactly one `cloud-controller` child for one Cloud Run run. A delegate reads the same note but its envelope makes it a leaf: execute the brief, spawn nothing. When neither check passes, the note is dead text and native agystack wins, which is the standalone boundary. A terminal spawned from T3 that wants native behavior reliably can `unset T3_ACP_MCP_NODE`.

The full contract lives in `plugins/jstack/skills/t3-agystack/SKILL.md`. The envelope is an explicit role and ownership block that opens every child brief; a delegate's identity comes from that envelope, never from an adapter filename.

## Limits

- The delegate envelope is a prompt convention. Live T3 task identity is not verifiable from inside a session, so delegation discipline is disclosed, not enforced at runtime.
- The cloud bridge ships when the cloud unit's artifact is installed in the package, and the projection copies it with its siblings; `doctor` reports `bundled`/`projected` state either way.
- Duplicate skill-name resolution in Antigravity's scanner and a cold ACP-fallback session are runtime behaviors this tooling cannot prove. See [Both in one profile](#both-in-one-profile), and verify them on the machine before you rely on the projection.
