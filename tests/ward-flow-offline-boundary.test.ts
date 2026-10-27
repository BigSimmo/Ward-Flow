import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { WARD_FLOW_PATH_PREFIX, isWardFlowPath } from "@/lib/developer-area/headers";

const WARD_SOURCE_ROOTS = ["src/components/ward-management", "src/app/ward-flow"];

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function sourceFiles(): string[] {
  return WARD_SOURCE_ROOTS.flatMap(walk).filter((file) => /\.tsx?$/u.test(file));
}

function importsAndCalls(file: string): { imports: string[]; networkCalls: string[] } {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const networkCalls: string[] = [];
  const visit = (node: ts.Node): void => {
    // A type-only import is erased at build, so it can load no provider code and make no call.
    const typeOnly =
      (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly === true) ||
      (ts.isExportDeclaration(node) && node.isTypeOnly);
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      !typeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ((/\bfetch\b/u.test(node.expression.getText(source)) &&
        (ts.isIdentifier(node.expression) || ts.isParenthesizedExpression(node.expression))) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ["send", "open"].includes(node.expression.name.text) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "XMLHttpRequest"))
    ) {
      networkCalls.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, networkCalls };
}

describe("Ward Flow's isolated demo and shared-adapter boundary", () => {
  it("matches the exact route subtree", () => {
    expect(WARD_FLOW_PATH_PREFIX).toBe("/ward-flow");
    expect(isWardFlowPath("/ward-flow")).toBe(true);
    expect(isWardFlowPath("/ward-flow/capacity")).toBe(true);
    expect(isWardFlowPath("/ward-flow-archive")).toBe(false);
    expect(isWardFlowPath("/mockups/ward-flow")).toBe(false);
    expect(isWardFlowPath("/documents")).toBe(false);
  });

  it("confines provider imports and network calls to the exact shared adapters", () => {
    const violations: string[] = [];
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(50);

    for (const file of files) {
      const relative = file.replaceAll("\\", "/").replace("src/components/ward-management/", "");
      const allowedImports: Record<string, string> = {
        "ward-shared-access.tsx": "./use-ward-supabase-shared",
        "use-ward-supabase-shared.ts": "./ward-supabase-auth",
        "ward-shared-client.ts": "./ward-supabase-auth",
      };
      const { imports, networkCalls } = importsAndCalls(file);
      for (const specifier of imports) {
        if (
          /site-content|clinical-registry|database/iu.test(specifier) ||
          (/supabase/iu.test(specifier) && allowedImports[relative] !== specifier)
        ) {
          violations.push(`${file} imports ${specifier}`);
        }
      }
      // front-door-pass-client.ts is the front door's one same-origin call to this app's own
      // /api/session, for the pass the server gate checks (D-88). It reaches no provider.
      if (
        !["ward-supabase-auth.ts", "ward-shared-client.ts", "front-door/front-door-pass-client.ts"].includes(relative)
      ) {
        for (const call of networkCalls) violations.push(`${file} calls ${call}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("opens without an access gate and keeps its layout free of Clinical KB authentication", () => {
    // The developer-key gate was removed on 28 September 2026 at Josh's request. Ward Flow is
    // synthetic, so the layout now mounts the provider directly; this guards against either gate
    // returning by accident.
    const layout = readFileSync("src/app/ward-flow/layout.tsx", "utf8");
    const layoutFile = "src/app/ward-flow/layout.tsx";

    expect(layout).not.toContain("WardFlowAccessGate");
    expect(layout).not.toContain("DeveloperAreaGate");
    const { imports, networkCalls } = importsAndCalls(layoutFile);
    expect(
      imports.filter((specifier) =>
        /supabase|site-content|clinical-registry|database|developer-area/iu.test(specifier),
      ),
      layoutFile,
    ).toEqual([]);
    expect(networkCalls, layoutFile).toEqual([]);
  });

  it("keeps the root layout free of Clinical KB auth, account and Supabase code", () => {
    // Until the PsychSift removal pass (25 September 2026) the root layout carried PsychSift's
    // providers in a branch Ward Flow's trusted marker skipped. With PsychSift gone the layout
    // renders its children directly, so the guard is now that none of that code comes back.
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/<OverlayRoot \/>\s*\{children\}/u);
    for (const forbidden of [
      "AuthProvider",
      "AccountDataProvider",
      "MobileKeyboardProvider",
      "PwaLifecycle",
      "WebVitalsReporter",
      "supabase",
      "PsychSiftAppFrame",
    ]) {
      expect(layout, forbidden).not.toContain(forbidden);
    }
  });
});
