// The model sheet. Provider instance IDs differ per machine, not per harness,
// so since 2.0.0-rc.3 there is one sheet per machine, at
// `${XDG_CONFIG_HOME:-~/.config}/t3-jstack/models.md`. Releases before the
// rename kept it at `${XDG_CONFIG_HOME:-~/.config}/t3-pstack/models.md` and
// read `t3-pstack-models.md` in each config home, so the installer moves those
// sheets to the machine path once and leaves a symlink at each old path.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, symlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { checkSheet, parseSheet } from "../../plugins/jstack/skills/setup-jstack/scripts/t3-sheet.mjs";
import { check, INSTALL_HINT, tempBeside, writeAtomic } from "./common.mjs";

export const HOME_SHEET = "t3-jstack-models.md";
// The home file name the t3-pstack install wrote, kept as a migration source
// and a reader fallback until the installer moves it.
export const OLD_HOME_SHEET = "t3-pstack-models.md";
const SETUP_HINT = "run /t3-jstack:setup-jstack in a T3 thread";

export const sheetPath = (env, home) =>
  join(env.XDG_CONFIG_HOME?.trim() ? resolve(env.XDG_CONFIG_HOME.trim()) : join(home, ".config"), "t3-jstack", "models.md");

// The machine path the rename replaces, derived from the new one so any sheet
// location maps onto its old twin.
export const oldSheetPath = (sheet) => sheet.replace(/(t3-)jstack([/\\]models\.md)$/, "$1pstack$2");

const isFile = (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
const sameBytes = (a, b) => readFileSync(a).equals(readFileSync(b));
const resolvesTo = (path, target) => isFile(path) && isFile(target) && realpathSync(path) === realpathSync(target);
const homeSheets = (homes) => homes.map((home) => join(home.dir, HOME_SHEET));
const oldHomeSheets = (homes) => homes.map((home) => join(home.dir, OLD_HOME_SHEET));

function link(target, path) {
  const tmp = tempBeside(path);
  symlinkSync(target, tmp);
  renameSync(tmp, path);
}

// A sheet a home links to from outside every home, such as one kept in a
// dotfiles repository, is the user's file to keep.
function outsideHomes(path, homes) {
  return homes.every(({ dir }) => {
    const rel = relative(existsSync(dir) ? realpathSync(dir) : resolve(dir), path);
    return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  });
}

export function moveSheet(sheet, homes) {
  const steps = [];
  const oldSheet = oldSheetPath(sheet);
  if (!isFile(sheet)) {
    if (isFile(oldSheet)) {
      mkdirSync(dirname(sheet), { recursive: true });
      const kept = lstatSync(oldSheet).isSymbolicLink() && outsideHomes(realpathSync(oldSheet), homes) ? realpathSync(oldSheet) : null;
      if (kept) {
        link(kept, sheet);
        steps.push(`linked the sheet to ${kept}`);
      } else {
        writeAtomic(sheet, readFileSync(oldSheet), oldSheet);
        steps.push(`moved the sheet from ${oldSheet}`);
      }
    } else {
      const found = [...new Set([...homeSheets(homes), ...oldHomeSheets(homes)].filter(isFile).map((path) => realpathSync(path)))];
      if (!found.length) return steps;
      if (new Set(found.map((path) => readFileSync(path, "utf8"))).size > 1) return steps;
      mkdirSync(dirname(sheet), { recursive: true });
      const kept = found.find((path) => outsideHomes(path, homes));
      if (kept) {
        link(kept, sheet);
        steps.push(`linked the sheet to ${kept}`);
      } else {
        writeAtomic(sheet, readFileSync(found[0]), found[0]);
        steps.push(`moved the sheet from ${found[0]}`);
      }
    }
  }
  // The old machine sheet stays readable for an older install, so once the
  // new sheet holds the same bytes, link the old path to it instead of
  // letting the two copies diverge. Never create an old path on a fresh
  // install, and never touch a link that points elsewhere.
  if (isFile(oldSheet) && !resolvesTo(oldSheet, sheet) && !lstatSync(oldSheet).isSymbolicLink() && sameBytes(oldSheet, sheet)) {
    link(sheet, oldSheet);
    steps.push(`linked ${oldSheet} to it`);
  }
  // A home sheet that differs from the machine sheet stays, and a link to
  // another file stays too, so that file is never orphaned.
  for (const path of [...homeSheets(homes), ...oldHomeSheets(homes)]) {
    if (path.endsWith(OLD_HOME_SHEET) && !existsSync(path)) continue;
    if (!existsSync(dirname(path)) || resolvesTo(path, sheet)) continue;
    const present = lstatSync(path, { throwIfNoEntry: false });
    if (present && isFile(path) && (present.isSymbolicLink() || !sameBytes(path, sheet))) continue;
    link(sheet, path);
    steps.push(`linked ${path} to it`);
  }
  return steps;
}

export function doctorSheet(sheet, homes, { catalog, roles, tiers }) {
  const oldSheet = oldSheetPath(sheet);
  const old = [...homeSheets(homes), ...oldHomeSheets(homes)].filter(isFile);
  const legacy = [oldSheet, ...oldHomeSheets(homes)].filter(isFile);
  if (!isFile(sheet)) {
    const sources = [...new Set([...legacy, ...old].map((path) => realpathSync(path)))];
    if (sources.length) {
      const paths = [...new Set([...legacy, ...old])];
      const differ = new Set(paths.map((path) => readFileSync(path, "utf8"))).size > 1;
      return [
        check(
          "machine sheet",
          false,
          `missing; ${paths.join(", ")} ${differ ? "differ, so the installer leaves them" : "not moved yet"}`,
          differ ? `keep one, then ${INSTALL_HINT}` : INSTALL_HINT,
        ),
      ];
    }
    return [check("machine sheet", false, "none, so every role runs on its skill's defaults", SETUP_HINT, true)];
  }
  const problems = checkSheet(parseSheet(readFileSync(sheet, "utf8")), { roles, defaults: tiers, catalog });
  const shadowing = [...(isFile(oldSheet) ? [oldSheet] : []), ...old].filter((path) => !resolvesTo(path, sheet) && !sameBytes(path, sheet));
  return [
    check(
      "machine sheet valid",
      problems.length === 0,
      problems.length
        ? problems.join("; ")
        : catalog
          ? "every line parses and dispatches on the catalog"
          : "every line parses (pass --catalog to check targets)",
      SETUP_HINT,
    ),
    check(
      "home sheets",
      shadowing.length === 0,
      shadowing.length ? `${shadowing.join(", ")} differ from the machine sheet` : "none differ from it",
      `move each aside, then ${INSTALL_HINT} to link it`,
    ),
  ];
}
