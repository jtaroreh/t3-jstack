// models.json is the T3 model policy every stamped Models section and
// setup-jstack's sheet block derive from.
// parseModels checks its shape when the generator loads it, and a role label
// is the runtime join key between the sheet the user writes and the prose that
// tells the agent which role to look up.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { t3Regions } from "../tools/derive-t3.mjs";
import { loadModels, parseModels } from "../tools/generate.mjs";
import { markdownFiles } from "../tools/validate-skills.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const skillsDir = join(repoRoot, "plugins/jstack/skills");
const raw = JSON.parse(readFileSync(join(repoRoot, "plugins/jstack/models.json"), "utf8"));
const models = loadModels();

describe("committed models.json", () => {
  test("the file stays one row per role so a role change is a one-line diff", () => {
    const text = readFileSync(join(repoRoot, "plugins/jstack/models.json"), "utf8");
    expect(text.match(/^\s*\{ "role"/gm)).toHaveLength(raw.roles.length);
  });
});

describe("parseModels", () => {
  const anySkill = () => true;
  const parse = (mutate, skillExists = anySkill) => {
    const policy = structuredClone(raw);
    mutate(policy);
    return () => parseModels(policy, skillExists);
  };
  const role = (policy, label) => policy.roles.find((r) => r.role === label);

  test.each(["default", "fast", "strongest", "panel", "judges", "workhorse"])("a missing %s tier throws naming it", (tier) => {
    expect(parse((p) => delete p.tiers[tier])).toThrow(`models.json: tiers has no "${tier}"`);
  });

  test("a tier entry outside the T3 sheet grammar throws naming the tier", () => {
    expect(parse((p) => (p.tiers.default = "opus"))).toThrow(
      'models.json: tier "default": "opus" does not start with <providerInstanceId>/<modelId>',
    );
    expect(parse((p) => (p.tiers.fast = "inherit-parent"))).toThrow(
      'models.json: tier "fast" must name a target, not inherit the parent',
    );
    expect(parse((p) => (p.tiers.default = "claudeAgent/claude-opus-5-5  effort=xhigh"))).toThrow(
      "is not one entry written with single spaces",
    );
  });

  test("a single-model tier holds one entry, and the panel and the judges a list of two families", () => {
    expect(parse((p) => (p.tiers.default = [p.tiers.default]))).toThrow('models.json: tier "default" must be one entry, not a list');
    expect(parse((p) => (p.tiers.judges = p.tiers.judges[0]))).toThrow('models.json: tier "judges" must be a list');
    expect(parse((p) => (p.tiers.panel = ["claudeAgent/claude-opus-5-5", "codex_pool/claude-sonnet-5-5"]))).toThrow(
      'models.json: tier "panel" needs at least two model families',
    );
    expect(parse((p) => (p.tiers.judges = ["claudeAgent/claude-opus-5-5"]))).toThrow(
      'models.json: tier "judges" needs at least two model families',
    );
    expect(parse((p) => (p.tiers.panel = ["codex/gpt-6.1-sol", "codex/gpt-6.1-sol"]))).toThrow(
      'models.json: tier "panel" lists an entry twice',
    );
  });

  test("a role naming an undefined tier throws naming the role and the tier", () => {
    expect(parse((p) => (role(p, "bug-fix").tier = "strongset"))).toThrow(
      'models.json: role "bug-fix" names tier "strongset", which tiers does not define',
    );
  });

  test("a duplicate role label or alias throws naming it", () => {
    expect(parse((p) => p.roles.push({ ...role(p, "swarm workers") }))).toThrow('models.json: role "swarm workers" appears twice');
    expect(parse((p) => (role(p, "bug-fix").alias = "hillclimb"))).toThrow(
      'models.json: role "hillclimb" appears twice',
    );
  });

  test("optional roles require boolean metadata and the workhorse tier is a concrete single target", () => {
    expect(parse((p) => (role(p, "jtaroreh workhorse").optional = "true"))).toThrow("optional must be a boolean");
    expect(parse((p) => (role(p, "jtaroreh workhorse").optional = false))()).toBeDefined();
    expect(parse((p) => (p.tiers.workhorse = [p.tiers.workhorse]))).toThrow('tier "workhorse" must be one entry, not a list');
    expect(parse((p) => (p.tiers.workhorse = "auto"))).toThrow('tier "workhorse" must name a target, not inherit the parent');
  });

  test("a role whose skill directory does not exist throws naming both", () => {
    expect(parse(() => {}, (skill) => skill !== "swarm")).toThrow(
      'models.json: role "swarm workers" names skill "swarm", which has no SKILL.md',
    );
  });

  test("a retired label that is still a role throws, so a live line is never skipped", () => {
    expect(parse((p) => p.retired.push("swarm workers"))).toThrow('models.json: "swarm workers" is both a role and retired');
    expect(parse((p) => delete p.retired)).toThrow('models.json: "retired" must be a list');
  });
});

describe("role labels reach the prose", () => {
  // The prose may hyphenate a label ("swarm-workers" for the sheet's
  // "swarm workers") and names only the first segment of a comma-joined label.
  const normalize = (text) => text.toLowerCase().replace(/[-\s]+/g, " ");

  function skillProse(skill) {
    return markdownFiles(join(skillsDir, skill))
      .map((file) => {
        const lines = readFileSync(file, "utf8").split("\n");
        const owned = t3Regions(models)
          .filter((r) => r.file === relative(repoRoot, file))
          .map((r) => r.locate(lines))
          .filter(Boolean);
        return lines.filter((_, i) => !owned.some(([s, e]) => i >= s && i < e)).join("\n");
      })
      .join("\n");
  }

  for (const role of models.roles) {
    test(`"${role.role}" is named by the ${role.skill} skill outside its stamped regions`, () => {
      const needle = normalize(role.role.split(",")[0]);
      expect(normalize(skillProse(role.skill))).toContain(needle);
    });
  }
});
