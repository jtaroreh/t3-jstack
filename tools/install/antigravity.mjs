// Antigravity: T3 starts each antigravity instance on Antigravity CLI 1.5.0 or
// newer as `<cli> acp --gemini-dir <profile>`, where the profile is <T3 userdata>/providers/antigravity/<the
// SHA-256 of the instance ID> (apps/server antigravityAuthSupport.ts), and agy
// discovers a plugin at <profile>/config/plugins/<dir>. `agy plugin install`
// writes ~/.gemini whatever GEMINI_HOME says, so the installer copies the
// plugin tree into each profile itself. The older ACP runtime (1.4.x) that
// earlier T3 releases installed loads no plugins or session-start hooks.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { MANIFEST_NAME, carriesNote } from "./agystack.mjs";
import { check, pluginIntact, readJson, tempBeside } from "./common.mjs";

export const ANTIGRAVITY_MANIFEST = ".antigravity-plugin/plugin.json";
// The install directory, which keys Antigravity's enabled state in config.json.
const DIR = "t3-jstack";

const installPath = (home) => join(home.dir, "config", "plugins", DIR);
const installedVersion = (path) => (existsSync(join(path, ANTIGRAVITY_MANIFEST)) ? readJson(join(path, ANTIGRAVITY_MANIFEST)).version : undefined);
// The session-start hook's files: the hooks file agy reads, its script, and
// what the script reads. A copy routes as released only while each matches
// the plugin this run installs.
const HOOK_FILES = ["hooks.json", "hooks/session-start.sh", "hooks/session-start-context.md", "skills/setup-jstack/scripts/read-sheet.sh"];
const intact = (path, pluginRoot, skills) =>
  pluginIntact(path, ANTIGRAVITY_MANIFEST, skills) &&
  HOOK_FILES.every((file) => existsSync(join(path, file)) && readFileSync(join(path, file)).equals(readFileSync(join(pluginRoot, file))));
// config.json wins over the manifest wherever it has an entry, and the
// manifest ships the plugin on.
const enabled = (home) => {
  const config = join(home.dir, "config", "config.json");
  return !existsSync(config) || readJson(config).plugins?.[DIR]?.enabled !== false;
};

export function installAntigravity(home, { pluginRoot, version, skills }) {
  const path = installPath(home);
  const before = installedVersion(path);
  if (before === version && intact(path, pluginRoot, skills)) return [];
  // T3 creates the profile private, and keeps it so when it starts the instance.
  mkdirSync(home.dir, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(path), { recursive: true });
  // A whole tree swapped in by rename, so a session never loads half a plugin
  // and files a release dropped do not linger.
  const fresh = tempBeside(path);
  cpSync(pluginRoot, fresh, { recursive: true });
  const old = existsSync(path) ? tempBeside(path) : undefined;
  if (old) renameSync(path, old);
  renameSync(fresh, path);
  if (old) rmSync(old, { recursive: true, force: true });
  return [before === undefined ? `installed ${version}` : before === version ? `reinstalled ${version}, whose files were missing or changed` : `updated ${before} to ${version}`];
}

// The opt-in agystack projection (tools/antigravity.mjs) beside the plugin
// gives the profile two skills of each name both ship. A projected SKILL.md is
// one the manifest records at its current bytes, or one carrying the whole
// routing note where the projection inserts it, at a path the manifest lists
// when a manifest is readable.
// A stray file in a skills folder, such as macOS's .DS_Store, makes
// `<it>/SKILL.md` an ENOTDIR path rather than a missing one.
const isFile = (path) => {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
};
function ownedSkills(skillsDir) {
  try {
    const { entries } = JSON.parse(readFileSync(join(skillsDir, MANIFEST_NAME), "utf8"));
    return Array.isArray(entries) ? new Map(entries.filter((e) => e?.kind === "generated-skill" || e?.kind === "adapter-skill").map((e) => [e.path, e.hash])) : null;
  } catch {
    return null;
  }
}
function bothPresent(home, path) {
  const skillsDir = join(home.dir, "config", "skills");
  const owned = ownedSkills(skillsDir);
  const projected = (name) => {
    const file = join(skillsDir, name, "SKILL.md");
    if (!isFile(file)) return false;
    const bytes = readFileSync(file);
    const key = `${name}/SKILL.md`;
    if (owned && !owned.has(key)) return false;
    return (owned && createHash("sha256").update(bytes).digest("hex") === owned.get(key)) || carriesNote(bytes.toString("utf8"));
  };
  const pluginSkills = join(path, "skills");
  const twice = existsSync(pluginSkills) ? readdirSync(pluginSkills).filter((name) => isFile(join(pluginSkills, name, "SKILL.md")) && projected(name)) : [];
  if (!twice.length) return [];
  const files = twice.map((name) => join(skillsDir, name, "SKILL.md"));
  return [
    check(
      "agystack projection",
      false,
      `${skillsDir} also holds the agystack projection, so ${twice.length} skill name${twice.length === 1 ? "" : "s"} load twice (${twice.join(", ")}), from t3-jstack at ${path} and from the projection. Which copy Antigravity loads for a duplicate name is unproven`,
      owned
        ? `keep one: turn t3-jstack off in ${join(home.dir, "config", "config.json")}, or delete the paths ${join(skillsDir, MANIFEST_NAME)} lists and then the manifest itself`
        : `keep one: turn t3-jstack off in ${join(home.dir, "config", "config.json")}, or inspect and remove the projected files, which no manifest records: ${files.join(", ")}`,
      true,
    ),
  ];
}

export function doctorAntigravity(home, { pluginRoot, version, skills, hint }) {
  const path = installPath(home);
  const installed = installedVersion(path);
  const whole = intact(path, pluginRoot, skills);
  const on = enabled(home);
  return [
    check(
      "installed",
      installed === version && whole,
      !installed ? "not installed" : installed !== version ? `${installed}, expected ${version}` : whole ? installed : `${installed}, but its files at ${path} are missing or changed`,
      hint,
    ),
    check("enabled", on, on ? "yes" : `no, ${join(home.dir, "config", "config.json")} turns it off`, `turn t3-jstack on in that file's "plugins" map`),
    ...(installed && on ? bothPresent(home, path) : []),
  ];
}
