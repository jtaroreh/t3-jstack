#!/usr/bin/env node
// The dedicated agystack projection CLI.
//
//   install  project the agystack Antigravity plugin into <gemini-home>/skills
//   doctor   read-only report on the projection and its manifest
//
// <gemini-home> is --gemini-home, else the config directory of the one
// Antigravity profile T3 keeps, found as tools/install/homes.mjs finds it. It
// writes nothing outside the destination skills directory, and the general
// installer in tools/install.mjs never runs it.
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { existsSync, realpathSync } from "node:fs";

import { expandHome } from "./install/common.mjs";
import { discoverHomes } from "./install/homes.mjs";
import { ADAPTER_RESOURCE_PATH, MANIFEST_NAME, ProjectionBlocked, buildProjection, doctor, project } from "./install/agystack.mjs";

const USAGE = `usage: node tools/antigravity.mjs install|doctor [--gemini-home DIR] [--agystack-source DIR] [--json]

install projects the agystack Antigravity plugin into <gemini-home>/skills as
flat, manifest-owned skill directories. doctor reports drift, broken links,
and the state of the cloud bridge (${ADAPTER_RESOURCE_PATH}).

Without --gemini-home, <gemini-home> is <profile>/config for the one
Antigravity profile T3 keeps under <T3 userdata>/providers/antigravity. With
no such profile, or more than one, both verbs stop and ask for --gemini-home.
--agystack-source defaults to ~/.gemini/config/plugins/agystack, or to
<gemini-home>/plugins/agystack when --gemini-home is given.

Exit codes: 0 success, 1 blocked install or degraded doctor, 2 usage error.
`;

function parseArgs(argv) {
  const options = { verb: null, geminiHome: null, agystackSource: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--gemini-home" || arg === "--agystack-source") {
      const name = arg === "--gemini-home" ? "geminiHome" : "agystackSource";
      if (i + 1 >= argv.length) usageError(`${arg} needs a directory`);
      options[name] = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    }
    if (options.verb === null && (arg === "install" || arg === "doctor")) {
      options.verb = arg;
      continue;
    }
    usageError(`unexpected argument "${arg}"`);
  }
  return options;
}

function usageError(message) {
  // Machine-readable usage errors too: --json promises a parseable report on
  // stdout, so a parse failure must not become a bare human banner.
  if (process.argv.slice(2).includes("--json")) {
    process.stdout.write(`${JSON.stringify({ status: "usage", message }, null, 2)}\n`);
  } else {
    process.stderr.write(`antigravity: ${message}\n\n${USAGE}`);
  }
  process.exit(2);
}

function emit(options, payload, human) {
  if (options.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else process.stdout.write(`${human}\n`);
}

// A profile counts once T3 has created it, so the projection never creates one.
function t3GeminiHome(home) {
  const { homes, settings } = discoverHomes({ env: process.env, home });
  const profiles = homes.filter((h) => h.harness === "antigravity" && existsSync(h.dir));
  if (profiles.length === 1) return { geminiHome: join(profiles[0].dir, "config"), from: profiles[0].from.join(", "), profileDir: profiles[0].dir };
  if (!profiles.length) {
    throw new Error(`no T3 Antigravity profile found from ${settings.path}${settings.error ? ` (${settings.error})` : ""}; start an Antigravity thread in T3 once, or pass --gemini-home DIR`);
  }
  throw new Error(`${profiles.length} T3 Antigravity profiles found (${profiles.map((p) => `${join(p.dir, "config")} for ${p.from.join(", ")}`).join("; ")}); pass --gemini-home with the one to use`);
}

// An inferred destination that a symlink leads out of the profile is somewhere
// the user never named, so install refuses it and doctor still reads it. The
// nearest existing ancestor decides, since a missing skills directory is
// created inside whatever its parent resolves to.
function escapes(profileDir, dest) {
  let at = dest;
  while (!existsSync(at) && dirname(at) !== at) at = dirname(at);
  const real = join(realpathSync(at), relative(at, dest));
  const rel = relative(realpathSync(profileDir), real);
  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? real : undefined;
}

function homes(options) {
  const home = homedir();
  const userGeminiHome = resolve(expandHome(options.geminiHome ?? join(home, ".gemini", "config"), home));
  const { geminiHome, from, profileDir } = options.geminiHome ? { geminiHome: userGeminiHome, from: "--gemini-home" } : t3GeminiHome(home);
  return {
    destSkillsDir: join(geminiHome, "skills"),
    from,
    outsideProfile: profileDir ? escapes(profileDir, join(geminiHome, "skills")) : undefined,
    sourceRoot: resolve(expandHome(options.agystackSource ?? join(userGeminiHome, "plugins", "agystack"), home)),
    packageRoot: fileURLToPath(new URL("..", import.meta.url)),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.verb) usageError("install or doctor expected");
  let resolved;
  try {
    resolved = homes(options);
  } catch (error) {
    emit(options, { status: "error", message: error.message }, `antigravity: ${error.message}`);
    process.exit(1);
  }
  const { destSkillsDir, from, outsideProfile, sourceRoot, packageRoot } = resolved;
  if (options.verb === "install") {
    const emitBlocked = (payload, human) => {
      emit(options, payload, human);
      process.exit(1);
    };
    if (outsideProfile) {
      const detail = `the inferred projection path resolves outside the T3 profile, at ${outsideProfile}; pass --gemini-home ${dirname(destSkillsDir)} --agystack-source ${sourceRoot} to allow this destination explicitly`;
      emitBlocked(
        { status: "blocked", problems: [{ path: destSkillsDir, code: "outside-profile", detail }], dest: destSkillsDir, manifest: join(destSkillsDir, MANIFEST_NAME) },
        `install blocked before any write (nothing was written):\n  outside-profile ${destSkillsDir}: ${detail}`,
      );
    }
    if (!existsSync(sourceRoot)) {
      // Missing source is an environment problem, not a usage error: report it
      // in the blocked-report shape and exit 1 so automation can parse it.
      emitBlocked(
        {
          status: "blocked",
          problems: [{ path: sourceRoot, code: "missing-source", detail: "the agystack source directory does not exist; pass --agystack-source pointing at the installed agystack plugin" }],
          dest: destSkillsDir,
          manifest: join(destSkillsDir, MANIFEST_NAME),
        },
        `install blocked before any write (nothing was written):\n  missing-source ${sourceRoot}: the agystack source directory does not exist; pass --agystack-source pointing at the installed agystack plugin`,
      );
    }
    try {
      const build = buildProjection({ sourceRoot, destSkillsDir, packageRoot });
      const result = project({ build });
      const counts = {
        generated: result.applied.filter((e) => e.kind === "generated-skill").length,
        adapterSkill: result.applied.filter((e) => e.kind === "adapter-skill").length,
        adapterResource: result.applied.filter((e) => e.kind === "adapter-resource").length,
        links: result.applied.filter((e) => e.kind === "resource-link").length,
      };
      const summary = `installed ${build.sourceSkillNames.length} agystack skill${build.sourceSkillNames.length === 1 ? "" : "s"} into ${destSkillsDir}, from ${from} (manifest ${MANIFEST_NAME}: ${build.entries.length} owned entries; this run wrote ${result.applied.length} paths, ${counts.generated} generated)`;
      emit(
        options,
        {
          status: "ok",
          dest: destSkillsDir,
          from,
          manifest: result.manifestPath,
          skills: build.sourceSkillNames,
          applied: result.applied.map((e) => e.path),
          skipped: result.skipped.map((e) => e.path),
          removed: result.removed.map((e) => e.path),
          counts,
        },
        summary,
      );
      process.exit(0);
    } catch (error) {
      if (error instanceof ProjectionBlocked) {
        emitBlocked(
          {
            status: "blocked",
            problems: error.problems,
            dest: destSkillsDir,
            manifest: join(destSkillsDir, MANIFEST_NAME),
          },
          [`install blocked before any write (nothing was written):`, ...error.problems.map((p) => `  ${p.code} ${p.path}: ${p.detail}`)].join("\n"),
        );
      }
      // Planning ran to completion but something environmental failed (bad
      // source names, missing adapter skill). Report, don't stack-trace.
      emit(
        options,
        { status: "error", dest: destSkillsDir, message: String(error.message ?? error) },
        `install failed before any write:\n  ${error.stack ?? String(error)}`,
      );
      process.exit(1);
    }
  }
  if (options.verb === "doctor") {
    let report;
    try {
      report = doctor({ sourceRoot, destSkillsDir, packageRoot });
    } catch (error) {
      // Doctor must degrade to a machine-readable error, not a stack trace.
      emit(
        options,
        { status: "error", dest: destSkillsDir, message: String(error.message ?? error) },
        `doctor failed:\n  ${error.stack ?? String(error)}`,
      );
      process.exit(1);
    }
    report.from = from;
    const lines = [
      `agystack projection doctor "${sourceRoot}" -> "${destSkillsDir}" (from ${from})`,
      `  status: ${report.status}`,
      `  source: ${report.source.present ? report.source.skills.join(", ") : "not found"}`,
      `  manifest entries: ${report.manifest?.entries ?? "no manifest"}`,
      `  drift: ${report.drift.join(", ") || "none"}`,
      `  broken links: ${report.brokenLinks.map((l) => l.path).join(", ") || "none"}`,
      `  cloud bridge (${ADAPTER_RESOURCE_PATH}): ${report.adapterResource.projected ? `projected with ${report.adapterResource.projectedFiles} script file(s)` : report.adapterResource.bundled ? "bundled but not projected" : "not shipped by the installed package"}`,
    ];
    report.summary = lines.join("\n");
    emit(options, report, report.summary);
    process.exit(report.ok ? 0 : 1);
  }
  usageError(`unknown verb "${options.verb}"`);
}

main();
