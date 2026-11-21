// Each runtime's shipped SessionStart command, run for real: the mandate is
// injected unless the model sheet turns it off. The sheet is the machine's,
// or, until the installer moves it there, that runtime's home sheet.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { agentSkills } from "../tools/generate.mjs";
import { sheetCases, writeSheet } from "./session-hook-sheets.mjs";

const pluginRoot = fileURLToPath(new URL("../plugins/jstack/", import.meta.url));
const mandate = readFileSync(join(pluginRoot, "hooks/session-start-context.md"), "utf8");
const codexManifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));

// Claude Code loads hooks/hooks.json by convention; Codex loads the file its
// manifest names; Antigravity loads hooks.json at the plugin root.
const sessionStart = Object.fromEntries(
  Object.entries({ claude: "hooks/hooks.json", codex: codexManifest.hooks }).map(([runtime, file]) => [
    runtime,
    JSON.parse(readFileSync(join(pluginRoot, file), "utf8")).hooks.SessionStart[0],
  ]),
);
const antigravityHooks = JSON.parse(readFileSync(join(pluginRoot, "hooks.json"), "utf8"))["t3-jstack"].SessionStart;
const commands = {
  claude: sessionStart.claude.hooks[0].command,
  codex: sessionStart.codex.hooks[0].command,
  antigravity: antigravityHooks[0].command,
};

// Antigravity replies in JSON and injects each step's text as a system message.
const decodeAntigravity = (out) => {
  const steps = JSON.parse(out).injectSteps;
  expect(steps).toHaveLength(1);
  return steps[0].systemMessage.systemMessage;
};

// CODEX_HOME and CLAUDE_CONFIG_DIR are only present when the user has
// relocated that runtime's directory. PLUGIN_ROOT is a generic name any shell
// profile may export, so it must not move a Claude Code session to Codex's sheet.
const runtimes = {
  claude: { hooks: "claude", sheetDir: ".claude", env: () => ({}) },
  "claude with CLAUDE_CONFIG_DIR": {
    hooks: "claude",
    sheetDir: "claude-config",
    env: (sheetRoot) => ({ CLAUDE_CONFIG_DIR: sheetRoot }),
  },
  "claude with PLUGIN_ROOT exported": { hooks: "claude", sheetDir: ".claude", env: () => ({ PLUGIN_ROOT: pluginRoot }) },
  codex: { hooks: "codex", sheetDir: ".codex", env: () => ({}) },
  "codex with CODEX_HOME": {
    hooks: "codex",
    sheetDir: "codex-home",
    env: (sheetRoot) => ({ CODEX_HOME: sheetRoot }),
  },
  // Antigravity runs the command in the plugin root and exports PLUGIN_ROOT.
  // It has no home sheet, so its cases use the machine sheet.
  antigravity: {
    hooks: "antigravity",
    sheetDir: ".config/t3-jstack",
    sheetFile: "models.md",
    env: () => ({ PLUGIN_ROOT: pluginRoot }),
    reply: decodeAntigravity,
    silent: "{}\n",
  },
};

function runHook(runtime, sheet, command = commands[runtimes[runtime].hooks]) {
  const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
  const { sheetDir, sheetFile = "t3-jstack-models.md", env } = runtimes[runtime];
  const sheetRoot = join(home, sheetDir);
  if (sheet !== null) {
    mkdirSync(sheetRoot, { recursive: true });
    writeSheet(join(sheetRoot, sheetFile), sheet);
  }
  try {
    const r = spawnSync("sh", ["-c", command], {
      cwd: pluginRoot,
      env: { PATH: process.env.PATH, HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot, ...env(sheetRoot) },
      encoding: "utf8",
    });
    return { status: r.status, out: r.stdout, err: r.stderr };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

describe("SessionStart hook", () => {
  // The manifest names Codex's own hooks file instead of relying on Codex's
  // default discovery; `resume` keeps the mandate present after a restart.
  test("declares the hook in the Codex manifest", () => {
    expect(codexManifest.hooks).toBe("./hooks/codex-hooks.json");
    expect(sessionStart.claude.matcher).toBe("startup|resume|clear|compact");
    expect(sessionStart.codex.matcher).toBe("startup|resume|clear|compact");
  });

  test("names only skills that exist", () => {
    const named = [...mandate.matchAll(/(?:t3-jstack:|`\/)([a-z0-9-]+)/g)].map((m) => m[1]);
    const skills = new Set(agentSkills(join(pluginRoot, "skills")).map(({ name }) => name));
    expect(named).toContain("poteto-mode");
    expect(named.filter((name) => !skills.has(name))).toEqual([]);
  });

  for (const arg of ["cursor", "copilot", ""]) {
    test(`fails on runtime argument ${JSON.stringify(arg)}`, () => {
      const r = runHook("claude", null, `"\${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh" ${arg}`);
      expect(r.status).not.toBe(0);
      expect(r.out).toBe("");
      expect(r.err.trimEnd().split("\n")).toEqual([`session-start.sh: unknown runtime '${arg}' (expected claude, codex, or antigravity)`]);
    });
  }

  for (const runtime of Object.keys(runtimes)) {
    const { reply = (out) => out, silent = "" } = runtimes[runtime];
    const wrap = (out) => (out === silent ? out : reply(out));
    const expected = (off) => (off ? silent : mandate);
    describe(runtime, () => {
      test("injects the mandate when no sheet exists", () => {
        const r = runHook(runtime, null);
        expect({ ...r, out: wrap(r.out) }).toEqual({ status: 0, out: expected(false), err: "" });
      });

      // iconv rejects a UTF-16 LE sheet that ends mid-character, so the hook
      // cannot decode it and must inject as it does for a missing sheet.
      test("injects the mandate when the sheet cannot be decoded", () => {
        const r = runHook(runtime, Buffer.from([0xff, 0xfe, 0x73, 0x00, 0x65]));
        expect({ status: r.status, out: wrap(r.out) }).toEqual({ status: 0, out: expected(false) });
      });

      for (const { name, sheet, off } of sheetCases) {
        test(`${off ? "injects nothing" : "injects the mandate"} when the sheet has ${name}`, () => {
          const r = runHook(runtime, sheet);
          expect({ ...r, out: off ? r.out : wrap(r.out) }).toEqual({ status: 0, out: expected(off), err: "" });
        });
      }
    });
  }
});

describe("the machine sheet", () => {
  const run = (runtime, home, env = {}) =>
    spawnSync("sh", ["-c", sessionStart[runtime].hooks[0].command], {
      env: { PATH: process.env.PATH, HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot, ...env },
      encoding: "utf8",
    }).stdout;

  test("Antigravity loads its one SessionStart hook with no timeout of its own", () => {
    expect(Object.keys(JSON.parse(readFileSync(join(pluginRoot, "hooks.json"), "utf8")))).toEqual(["t3-jstack"]);
    expect(antigravityHooks).toEqual([{ type: "command", command: "sh ./hooks/session-start.sh antigravity" }]);
  });

  test.each(["claude", "codex"])("decides over the %s home sheet", (runtime) => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      const machineSheet = join(home, ".config/t3-jstack/models.md");
      mkdirSync(join(home, ".config/t3-jstack"), { recursive: true });
      mkdirSync(join(home, `.${runtime}`));
      writeFileSync(machineSheet, "session hook: off\n");
      writeFileSync(join(home, `.${runtime}`, "t3-jstack-models.md"), "session hook: on\n");
      expect(run(runtime, home)).toBe("");
      writeFileSync(machineSheet, "session hook: on\n");
      writeFileSync(join(home, `.${runtime}`, "t3-jstack-models.md"), "session hook: off\n");
      expect(run(runtime, home)).toBe(mandate);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("moves with XDG_CONFIG_HOME on antigravity", () => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    const run = (env = {}) =>
      spawnSync("sh", ["-c", commands.antigravity], {
        cwd: pluginRoot,
        env: { PATH: process.env.PATH, HOME: home, PLUGIN_ROOT: pluginRoot, ...env },
        encoding: "utf8",
      }).stdout;
    try {
      mkdirSync(join(home, "xdg/t3-pstack"), { recursive: true });
      writeFileSync(join(home, "xdg/t3-pstack/models.md"), "session hook: off\n");
      expect(decodeAntigravity(run())).toBe(mandate);
      expect(run({ XDG_CONFIG_HOME: join(home, "xdg") })).toBe("{}\n");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test.each(["claude", "codex"])("moves with XDG_CONFIG_HOME on %s", (runtime) => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      mkdirSync(join(home, "xdg/t3-jstack"), { recursive: true });
      writeFileSync(join(home, "xdg/t3-jstack/models.md"), "session hook: off\n");
      expect(run(runtime, home)).toBe(mandate);
      expect(run(runtime, home, { XDG_CONFIG_HOME: join(home, "xdg") })).toBe("");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test.each(["claude", "codex"])("falls back to the t3-pstack machine sheet on %s", (runtime) => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      mkdirSync(join(home, ".config/t3-pstack"), { recursive: true });
      writeFileSync(join(home, ".config/t3-pstack/models.md"), "session hook: off\n");
      expect(run(runtime, home)).toBe("");
      writeFileSync(join(home, ".config/t3-pstack/models.md"), "session hook: on\n");
      expect(run(runtime, home)).toBe(mandate);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test.each(["claude", "codex"])("prefers the new machine sheet over the legacy one on %s", (runtime) => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      mkdirSync(join(home, ".config/t3-jstack"), { recursive: true });
      mkdirSync(join(home, ".config/t3-pstack"), { recursive: true });
      writeFileSync(join(home, ".config/t3-jstack/models.md"), "session hook: on\n");
      writeFileSync(join(home, ".config/t3-pstack/models.md"), "session hook: off\n");
      expect(run(runtime, home)).toBe(mandate);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("without a machine sheet, each host reads only its own home sheet", () => {
  test("an off sheet in the other host's config directory leaves injection on", () => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      const run = (runtime) =>
        spawnSync("sh", ["-c", sessionStart[runtime].hooks[0].command], {
          env: { PATH: process.env.PATH, HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot },
          encoding: "utf8",
        }).stdout;
      mkdirSync(join(home, ".codex"));
      writeFileSync(join(home, ".codex", "t3-jstack-models.md"), "session hook: off\n");
      expect(run("claude")).toBe(mandate);
      expect(run("codex")).toBe("");
      rmSync(join(home, ".codex"), { recursive: true });
      mkdirSync(join(home, ".claude"));
      writeFileSync(join(home, ".claude", "t3-jstack-models.md"), "session hook: off\n");
      expect(run("claude")).toBe("");
      expect(run("codex")).toBe(mandate);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("a legacy t3-pstack home sheet still counts until the installer moves it", () => {
    const home = mkdtempSync(join(tmpdir(), "pstack-hook-"));
    try {
      const run = (runtime) =>
        spawnSync("sh", ["-c", sessionStart[runtime].hooks[0].command], {
          env: { PATH: process.env.PATH, HOME: home, CLAUDE_PLUGIN_ROOT: pluginRoot },
          encoding: "utf8",
        }).stdout;
      mkdirSync(join(home, ".codex"));
      writeFileSync(join(home, ".codex", "t3-pstack-models.md"), "session hook: off\n");
      expect(run("codex")).toBe("");
      expect(run("claude")).toBe(mandate);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
