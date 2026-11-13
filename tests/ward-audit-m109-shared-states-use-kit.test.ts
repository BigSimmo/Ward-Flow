// M109 (master audit list, 10 Nov 2026): shared states look the same everywhere.
//
// Colour and type tokens are already guarded elsewhere; the type-scale and icon-scale guards belong to
// another thread. This test keeps the five shared states on their kit parts:
//
// - "Not part of your role": drawn only by the access gate's closed screen (`shell/ward-access.tsx`).
// - Offline: every offline sentence on screen starts "You're offline." (DESIGN-SYSTEM §6 states line),
//   or is a short kit status word, except OFFLINE_EXCEPTIONS.
// - Loading: the spinner icon is drawn only by the kit's loading parts.
// - Disabled: a plain <button disabled> outside the kit is a ratchet (RAW_DISABLED): the kit's
//   Button, Switch and the rest carry the reason a control cannot be used (K11).
// - Error: a raw role="alert" outside the kit is a ratchet (RAW_ALERTS); the kit's StateLine,
//   FieldError and ErrorSummary are the error parts.
//
// The ratchets are exact counts per file: a new raw state fails, and moving one onto the kit must lower
// its number. The nightly picture baselines (one picture per state) are not added here: they are made
// on the hosted runner and need Josh's go-ahead for that job. Reads source with `readFileSync`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const LEFT_OUT = /mockups|ward-redesign/;
const KIT = /^src\/components\/(?:wf|primitive-recipes)\//;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split("\\").join("/");
    if (LEFT_OUT.test(path)) return [];
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

const SOURCES = [...files("src/components"), ...files("src/app")];

type Facts = { texts: string[]; rawDisabled: number; rawAlerts: number; imports: string[] };

function factsOf(path: string): Facts {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, false, kind);
  const facts: Facts = { texts: [], rawDisabled: 0, rawAlerts: 0, imports: [] };
  const attribute = (node: ts.JsxOpeningLikeElement, name: string) =>
    node.attributes.properties.find(
      (property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name,
    );
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      for (const element of node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        ? node.importClause.namedBindings.elements
        : [])
        facts.imports.push(element.name.text);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
      facts.texts.push(node.text.replace(/\s+/g, " ").trim());
    else if (ts.isTemplateExpression(node))
      facts.texts.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("…"));
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (ts.isIdentifier(node.tagName) && node.tagName.text === "button" && attribute(node, "disabled"))
        facts.rawDisabled += 1;
      const role = attribute(node, "role");
      if (role?.initializer && ts.isStringLiteral(role.initializer) && role.initializer.text === "alert")
        facts.rawAlerts += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return facts;
}

const FACTS = new Map(SOURCES.map((path) => [path, factsOf(path)]));

/** Offline words on screen that are not "You're offline." sentences, each with why. */
const OFFLINE_EXCEPTIONS: Readonly<Record<string, string>> = {
  "No connection. Unlock when it is back.": "TV lock: says what to do, on a locked shared screen.",
  "Offline. Snapshot when the connection returns.": "Downtime pack button state.",
  "No connection.": "Front door title, before any desk is chosen; its body says what to do.",
  "Optional. In your browser settings, to remove display settings and offline files too.":
    "About this demo: what clearing browser data also removes, not an offline state.",
};

/**
 * Plain <button disabled> outside the kit, 10 Nov 2026, across 40 files. Exact: lower it when one moves
 * onto the kit's Button (which carries its reason); never raise it.
 */
const RAW_DISABLED = 79;

/**
 * Raw role="alert" outside the kit, 10 Nov 2026, across 80 files. Exact: lower it when one moves onto
 * StateLine, FieldError or ErrorSummary; never raise it.
 */
const RAW_ALERTS = 115;

describe("M109: the five shared states use the kit's parts", () => {
  it("reads the screens' source (control)", () => {
    expect(FACTS.size).toBeGreaterThan(500);
    expect(FACTS.get("src/components/ward-management/shell/ward-access.tsx")!.texts).toContain("Not part of your role");
  });

  it('draws "Not part of your role" only on the access gate\'s closed screen', () => {
    const drawers = [...FACTS]
      .filter(([, facts]) => facts.texts.some((text) => /^Not part of your role/.test(text)))
      .map(([path]) => path)
      .toSorted();
    expect(drawers).toEqual([
      "src/components/ward-management/shell/ward-access.tsx",
      // A push notification's reason for an unavailable screen, never drawn on a page.
      "src/components/ward-management/shell/ward-phone-push.ts",
    ]);
  });

  it('starts every offline sentence with "You\'re offline."', () => {
    const odd = new Set<string>();
    for (const [path, facts] of FACTS) {
      // Help explains offline in running text; it is not an offline state.
      if (KIT.test(path) || path.includes("/help/")) continue;
      for (const text of facts.texts) {
        if (!/[.!]$/.test(text) || !/\b(?:offline|no connection)\b/i.test(text)) continue;
        if (text.startsWith("You're offline.") || text in OFFLINE_EXCEPTIONS) continue;
        if (/^[a-z]/.test(text) || text.includes("`")) continue;
        odd.add(text);
      }
    }
    expect([...odd].toSorted()).toEqual([]);
  });

  it("draws the loading spinner only in the kit", () => {
    const outside = [...FACTS]
      .filter(([path, facts]) => !KIT.test(path) && facts.imports.includes("LoaderCircle"))
      .map(([path]) => path);
    expect(outside).toEqual([]);
  });

  const outsideKit = (count: (facts: Facts) => number) =>
    [...FACTS].filter(([path]) => !KIT.test(path)).map(([path, facts]) => [path, count(facts)] as const);

  it("adds no plain disabled button outside the kit", () => {
    const found = outsideKit((facts) => facts.rawDisabled).filter(([, n]) => n > 0);
    const total = found.reduce((sum, [, n]) => sum + n, 0);
    expect(total, `use the kit's Button with its reason; files: ${found.map(([p, n]) => `${p} ${n}`).join(", ")}`).toBe(
      RAW_DISABLED,
    );
  });

  it('adds no raw role="alert" outside the kit', () => {
    const found = outsideKit((facts) => facts.rawAlerts).filter(([, n]) => n > 0);
    const total = found.reduce((sum, [, n]) => sum + n, 0);
    expect(
      total,
      `use StateLine, FieldError or ErrorSummary; files: ${found.map(([p, n]) => `${p} ${n}`).join(", ")}`,
    ).toBe(RAW_ALERTS);
  });
});
