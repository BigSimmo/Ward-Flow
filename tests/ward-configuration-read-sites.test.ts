// tests/ward-configuration-read-sites.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";

/**
 * Task 10 of the audit-wiring plan, 2026-09-16.
 *
 * Once `ED_ACCESS_TARGET_MINUTES`, `PARALLEL_REFERRAL_CAP` and `PULL_HOLD_MINUTES` became
 * DEFAULTS behind a configurable value (`ward-configuration.ts`'s `defaultWardConfiguration`),
 * every OTHER read site had to move to `state.configuration.*` — but nothing stopped a later
 * change from quietly reading the bare module constant again instead of the live configuration,
 * which would silently ignore a coordinator's saved change while looking identical on screen at
 * the moment it was written. This file is that tripwire: it enumerates the only files with a
 * legitimate reason to read any of the three constants directly, by name, and fails on any other
 * read anywhere under `WARD_DIR`.
 *
 *   - `ward-model.ts` — declares all three.
 *   - `ward-configuration.ts` — seeds `defaultWardConfiguration()` from all three; this is the
 *     one place a "default" is allowed to mean the constant itself.
 *   - `settings/settings-thresholds.ts` — reads `ED_ACCESS_TARGET_MINUTES` ONLY, to state the
 *     owner's original figure in the published-thresholds table when a coordinator has since
 *     configured the target away from it (Task 6/9's "owner-figure comparison" sentence).
 *   - `ward-derivations.ts` — reads `PARALLEL_REFERRAL_CAP` ONLY, inside `heavilyDeclined`, which
 *     counts declines against the product's own courtesy cap rather than the coordinator-tunable
 *     one (a named, narrow exemption — see that function's own doc comment).
 *
 * Every other file must read `state.configuration.<field>` instead.
 */
const RESTRICTED_NAMES = ["ED_ACCESS_TARGET_MINUTES", "PARALLEL_REFERRAL_CAP", "PULL_HOLD_MINUTES"] as const;

/** Basename -> the subset of `RESTRICTED_NAMES` that file may read directly. Absent from this map
 *  (or present with an empty set) means none of the three may appear there at all. */
const READ_ALLOWLIST: Readonly<Record<string, ReadonlySet<(typeof RESTRICTED_NAMES)[number]>>> = {
  "ward-model.ts": new Set(RESTRICTED_NAMES),
  "ward-configuration.ts": new Set(RESTRICTED_NAMES),
  "settings-thresholds.ts": new Set(["ED_ACCESS_TARGET_MINUTES"]),
  "ward-derivations.ts": new Set(["PARALLEL_REFERRAL_CAP"]),
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function isScannable(file: string): boolean {
  return file.endsWith(".ts") || file.endsWith(".tsx");
}

interface ScannedFile {
  readonly file: string;
  readonly basename: string;
  readonly source: string;
}

let wardDirFilesCache: ScannedFile[] | undefined;
function wardDirFiles(): ScannedFile[] {
  if (!wardDirFilesCache) {
    wardDirFilesCache = walk(WARD_DIR)
      .filter(isScannable)
      .filter((file) => !file.replaceAll("\\", "/").includes("/tests/")) // no test fixtures live under WARD_DIR, but stay explicit
      .map((file) => ({
        file: file.replaceAll("\\", "/"),
        basename: file.replaceAll("\\", "/").split("/").pop()!,
        source: readFileSync(file, "utf8"),
      }));
  }
  return wardDirFilesCache;
}

function parseSource(source: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/**
 * Every restricted identifier actually read in `source`, by name — an AST walk, not a substring
 * search, so a comment or a string mentioning the constant's name (both real in this codebase;
 * see e.g. `ward-derivations.ts`'s own doc comment on `PARALLEL_REFERRAL_CAP`) can never trip it.
 */
function restrictedIdentifierReads(source: string, fileName: string): Set<string> {
  if (!RESTRICTED_NAMES.some((name) => source.includes(name))) return new Set();

  const sourceFile = parseSource(source, fileName);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && (RESTRICTED_NAMES as readonly string[]).includes(node.text)) {
      found.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** True for a `.now` property access (`event.now`, `now`'s own container) — never a bare
 *  identifier, so a hand-authored fixture value like `NOW_ANCHOR + 45`
 *  (`ward-movements.ts`) is never mistaken for the engine's own clock arithmetic. */
function isNowPropertyAccess(node: ts.Expression): boolean {
  return ts.isPropertyAccessExpression(node) && node.name.text === "now";
}

/**
 * True if any `pullExpiresAt` property assignment's initializer is a direct
 * `event.now + <number literal>` binary expression — the exact carried-over shape
 * (`event.now + 60`) Task 4 of the audit-wiring plan replaced with
 * `event.now + state.configuration.pullHoldMinutes`. Catches only the direct literal case, the
 * same limit every AST-identifier scanner in this suite states for itself: it cannot see the
 * figure reaching `pullExpiresAt` through an intermediate variable or a helper in another file.
 */
function assignsPullExpiresAtFromNumberLiteral(source: string, fileName: string): boolean {
  if (!source.includes("pullExpiresAt")) return false;

  const sourceFile = parseSource(source, fileName);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "pullExpiresAt") {
      const init = node.initializer;
      if (
        ts.isBinaryExpression(init) &&
        init.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        isNowPropertyAccess(init.left) &&
        ts.isNumericLiteral(init.right)
      ) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

describe("configuration constants are read only through state.configuration", () => {
  it("scans a non-empty set of ward-management source files", () => {
    // The same failure mode every scan in this repo's sibling guards states for itself: a scan
    // that comes back empty makes every check below pass vacuously.
    expect(wardDirFiles().length).toBeGreaterThan(0);
  });

  it("finds ED_ACCESS_TARGET_MINUTES read in ward-model.ts and settings-thresholds.ts, and PARALLEL_REFERRAL_CAP read in ward-derivations.ts — so the offender list below is not empty by coincidence", () => {
    // Non-vacuity against REAL files, not only the synthetic probe below: proves the scanner
    // genuinely finds these identifiers where they are known to exist today, before trusting it
    // to find their ABSENCE everywhere else.
    const files = wardDirFiles();
    const modelFile = files.find((f) => f.basename === "ward-model.ts");
    const thresholdsFile = files.find((f) => f.basename === "settings-thresholds.ts");
    const derivationsFile = files.find((f) => f.basename === "ward-derivations.ts");
    if (!modelFile || !thresholdsFile || !derivationsFile) throw new Error("expected file missing from the scan");

    expect(restrictedIdentifierReads(modelFile.source, modelFile.file).has("ED_ACCESS_TARGET_MINUTES")).toBe(true);
    expect(restrictedIdentifierReads(thresholdsFile.source, thresholdsFile.file).has("ED_ACCESS_TARGET_MINUTES")).toBe(
      true,
    );
    expect(restrictedIdentifierReads(derivationsFile.source, derivationsFile.file).has("PARALLEL_REFERRAL_CAP")).toBe(
      true,
    );
  });

  it("reads none of the three restricted constants outside the named allowlist", () => {
    const offenders = wardDirFiles()
      .flatMap(({ file, basename, source }) => {
        const allowed = READ_ALLOWLIST[basename] ?? new Set();
        const found = restrictedIdentifierReads(source, file);
        const disallowed = [...found].filter((name) => !allowed.has(name as (typeof RESTRICTED_NAMES)[number]));
        return disallowed.map((name) => `${file}: ${name}`);
      })
      .sort();

    expect(
      offenders,
      "a file outside the named allowlist reads one of ED_ACCESS_TARGET_MINUTES/PARALLEL_REFERRAL_CAP/" +
        "PULL_HOLD_MINUTES directly — read state.configuration.<field> instead",
    ).toEqual([]);
  });

  it("never assigns pullExpiresAt: <expr> + <number literal>", () => {
    const offenders = wardDirFiles()
      .filter(({ file, source }) => assignsPullExpiresAtFromNumberLiteral(source, file))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  /**
   * Non-vacuity for the two rules above, proved on synthetic probe strings — the same discipline
   * `tests/ward-flow-single-source.test.ts`'s own ED-access-target checks use: this demonstrates
   * both predicates can fail, not merely that today's real files happen to pass them.
   */
  it("flags a synthetic offender of each rule", () => {
    const probeFile = "probe.ts";
    expect(
      restrictedIdentifierReads("const cap = PARALLEL_REFERRAL_CAP;", probeFile).has("PARALLEL_REFERRAL_CAP"),
      "a bare read of PARALLEL_REFERRAL_CAP was not flagged",
    ).toBe(true);
    expect(
      restrictedIdentifierReads("const target = ED_ACCESS_TARGET_MINUTES;", probeFile).has("ED_ACCESS_TARGET_MINUTES"),
      "a bare read of ED_ACCESS_TARGET_MINUTES was not flagged",
    ).toBe(true);
    expect(
      restrictedIdentifierReads("const hold = PULL_HOLD_MINUTES;", probeFile).has("PULL_HOLD_MINUTES"),
      "a bare read of PULL_HOLD_MINUTES was not flagged",
    ).toBe(true);
    expect(
      assignsPullExpiresAtFromNumberLiteral("const m = { pullExpiresAt: event.now + 60 };", probeFile),
      "event.now + 60 was not flagged",
    ).toBe(true);
    // The replacement shape must NOT be flagged, or this rule would refuse the fix Task 4 made.
    expect(
      assignsPullExpiresAtFromNumberLiteral(
        "const m = { pullExpiresAt: event.now + state.configuration.pullHoldMinutes };",
        probeFile,
      ),
      "the real, correct read site was wrongly flagged",
    ).toBe(false);
  });
});
