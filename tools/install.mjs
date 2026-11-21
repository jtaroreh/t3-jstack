#!/usr/bin/env node
// t3-jstack's installer. `install`, or `update`, the same command, brings
// every Claude Code and Codex home T3 can run, and the profile of each
// Antigravity instance T3 runs, to this package's version of t3-jstack, pins each Codex home's marketplace to that version's tag, trusts
// the Codex session-start hook, and moves the model sheet to its one path per
// machine. Each step converges, so a second run changes nothing. `doctor`
// checks the same homes and writes nothing itself, though the Codex app-server
// it starts refreshes a Git marketplace, as any T3 Codex thread does. Both
// exit 1 when a check fails.
//
// Each home's t3-jstack marketplace must come from jtaroreh/t3-jstack or
// from this run's --source, which defaults to the repository npx fetched this
// installer from. A home whose marketplace has another source, such as a
// local --source from an earlier run, gets nothing installed and no hook
// trusted, and doctor fails it with that source. A run never switches a
// home's source: one from jtaroreh/t3-jstack stays on it under another
// --source, and doctor warns with the commands that switch it.
//
// The pin is the `ref` of a Codex home's Git marketplace, the tag v<version>.
// Codex's own auto-upgrade leaves a lightweight tag, as each release's is,
// where it is, so a release reaches the home only through this installer,
// which trusts the hook again. A local
// directory has no tag and stays unpinned. Claude Code homes still auto-update
// from their marketplace's default branch. An Antigravity profile gets a copy
// of the plugin this run installs, so it too changes only when `update` runs.
//
//   npx -y github:jtaroreh/t3-jstack <install|update|doctor>
//     --source <owner/repo|git URL|dir>   marketplace source, default the repo npx ran, else jtaroreh/t3-jstack
//     --claude-home <dir>, --codex-home <dir>   more homes, repeatable
//     --catalog <file>   an orchestrator_capabilities dump to check the sheet's targets against
//     --json
// Node 20 or later, no dependencies.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { doctorAntigravity, installAntigravity } from "./install/antigravity.mjs";
import { doctorClaude, installClaude } from "./install/claude.mjs";
import { doctorCodex, installCodex } from "./install/codex.mjs";
import { check, hasCli, HOME_REPO, installHint, npxOrigin, parseSource, readJson } from "./install/common.mjs";
import { discoverHomes } from "./install/homes.mjs";
import { doctorSheet, moveSheet, sheetPath } from "./install/sheet.mjs";
import { doctorRuntime } from "./install/runtime.mjs";
import { FROZEN_HOOKS } from "./plugin.mjs";

const HARNESSES = {
  claude: { name: "Claude Code", install: installClaude, doctor: doctorClaude },
  codex: { name: "Codex", install: installCodex, doctor: doctorCodex },
  antigravity: { name: "Antigravity", install: installAntigravity, doctor: doctorAntigravity },
};
// Released versions read a model sheet only in Claude Code and Codex homes.
const SHEET_HARNESSES = new Set(["claude", "codex"]);

const USAGE =
  "usage: t3-jstack <install|update|doctor> [--source <owner/repo|git URL|dir>] " +
  "[--claude-home <dir>]... [--codex-home <dir>]... [--catalog <file>] [--runtime local|cloud] [--agystack-source <dir>] [--json]";

// What to converge on comes from the plugin this run installs: the local
// source, or else this package, which is the marketplace's own repo. `skills`
// maps each skill to its SKILL.md, and `codexHook` is the hooks file the
// Codex manifest names, with its pinned digest.
function pluginFacts(root) {
  const plugin = join(root, "plugins/jstack");
  const { roles, tiers, retired } = readJson(join(plugin, "models.json"));
  const hooks = readJson(join(plugin, ".codex-plugin/plugin.json")).hooks.replace(/^\.\//, "");
  const skills = readdirSync(join(plugin, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return {
    pluginRoot: plugin,
    version: readJson(join(plugin, ".claude-plugin/plugin.json")).version,
    skills: new Map(skills.map(({ name }) => [name, readFileSync(join(plugin, "skills", name, "SKILL.md"), "utf8")])),
    codexHook: { path: hooks, sha256: readJson(join(root, FROZEN_HOOKS))[`plugins/jstack/${hooks}`].sha256 },
    roles,
    tiers,
    retired,
  };
}

async function run(argv, env, home) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      source: { type: "string" },
      "claude-home": { type: "string", multiple: true, default: [] },
      "codex-home": { type: "string", multiple: true, default: [] },
      catalog: { type: "string" },
      runtime: { type: "string" },
      "agystack-source": { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const [command] = positionals;
  if (positionals.length !== 1 || !["install", "update", "doctor"].includes(command)) return { usage: true };
  if ((values.runtime && (command !== "doctor" || !["local", "cloud"].includes(values.runtime)))
    || (values["agystack-source"] && values.runtime !== "cloud")) return { usage: true };

  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const origin = npxOrigin(packageRoot) ?? HOME_REPO;
  const source = parseSource(values.source ?? origin, home);
  const facts = pluginFacts(source.local ?? packageRoot);
  const trusted = new Set([parseSource(HOME_REPO, home).key, source.key]);
  const hint = installHint(source);
  const context = { source, trusted, hint, pluginRoot: facts.pluginRoot, version: facts.version, skills: facts.skills, codexHook: facts.codexHook };
  const { homes, settings } = discoverHomes({
    env,
    home,
    claudeHomes: values["claude-home"],
    codexHomes: values["codex-home"],
  });
  const catalog = values.catalog ? readJson(values.catalog) : null;

  const report = { command, version: facts.version, source: source.arg, settings, homes: [] };
  for (const target of homes) {
    const harness = HARNESSES[target.harness];
    const row = { harness: target.harness, dir: target.dir, from: target.from, steps: [], checks: [] };
    report.homes.push(row);
    if (target.bin !== null && !hasCli(target.bin)) {
      row.checks.push(check("CLI", false, `${target.bin} not found, so this home was skipped`, `install ${harness.name} if T3 runs it`, true));
      continue;
    }
    if (command === "doctor" && !existsSync(target.dir)) {
      row.checks.push(check("installed", false, "the home does not exist", hint));
      continue;
    }
    try {
      if (command !== "doctor") row.steps = await harness.install(target, context);
      row.checks.push(...(await harness.doctor(target, context)));
    } catch (err) {
      row.checks.push(check(command === "doctor" ? "doctor" : "install", false, err.message, hint));
    }
  }
  const sheet = sheetPath(env, home);
  const sheetHomes = homes.filter((target) => SHEET_HARNESSES.has(target.harness));
  report.sheet = { path: sheet, steps: [], checks: [] };
  try {
    if (command !== "doctor") report.sheet.steps = moveSheet(sheet, sheetHomes);
  } catch (err) {
    report.sheet.checks.push(check("move", false, err.message, hint));
  }
  report.sheet.checks.push(...doctorSheet(sheet, sheetHomes, { catalog, roles: facts.roles, tiers: facts.tiers, retired: facts.retired, hint }));
  if (values.runtime) report.runtime = doctorRuntime(values.runtime, { env, source: values["agystack-source"] });
  const all = [...report.homes.flatMap((row) => row.checks), ...report.sheet.checks, ...(report.runtime ?? [])];
  report.failed = all.filter((c) => !c.ok && !c.warn).length;
  report.warnings = all.filter((c) => !c.ok && c.warn).length;
  return { report, json: values.json };
}

function render({ command, version, source, settings, homes, sheet, runtime, failed, warnings }, home) {
  const lines = [`t3-jstack ${version} from ${source}`];
  lines.push(`T3 settings: ${settings.path}${settings.error ? ` (${settings.error})` : `, ${settings.instances} Claude Code, Codex, or Antigravity instances`}`);
  const section = (title, steps, checks) => {
    lines.push("", title);
    for (const step of steps) lines.push(`  - ${step}`);
    for (const c of checks) {
      lines.push(`  ${c.ok ? "ok  " : c.warn ? "warn" : "FAIL"}  ${c.name}: ${c.detail}`);
      if (!c.ok && c.fix) lines.push(`        fix: ${c.fix}`);
    }
  };
  for (const row of homes) section(`${HARNESSES[row.harness].name}  ${row.dir}  (${row.from.join(", ")})`, row.steps, row.checks);
  section(`Model sheet  ${sheet.path}`, sheet.steps, sheet.checks);
  if (runtime) section("Runtime prerequisites", [], runtime);
  const changed = [...homes.flatMap((row) => row.steps), ...sheet.steps].length;
  const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  lines.push(
    "",
    `${command === "doctor" ? "" : changed ? `${count(changed, "change")}. ` : "Nothing to change. "}` +
      (failed ? `${count(failed, "check")} failed` : "Every check passes") +
      (warnings ? `, ${count(warnings, "warning")}.` : "."),
  );
  return lines.join("\n").replaceAll(home, "~");
}

const home = homedir();
try {
  const { usage, report, json } = await run(process.argv.slice(2), process.env, home);
  if (usage) {
    console.error(USAGE);
    process.exitCode = 2;
  } else {
    console.log(json ? JSON.stringify(report, null, 2) : render(report, home));
    process.exitCode = report.failed ? 1 : 0;
  }
} catch (err) {
  console.error(`t3-jstack: ${err.message}`);
  process.exitCode = 2;
}
