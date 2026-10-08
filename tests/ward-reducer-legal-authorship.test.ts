import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { scanReducerReasonChecks } from "./helpers/ward-reducer-reason-checks";

const REDUCER = "src/components/ward-management/ward-flow-reducer.ts";

function literalText(node: ts.Expression): string | undefined {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return literalText(node.expression);
  }
  if (ts.isParenthesizedExpression(node)) return literalText(node.expression);
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
}

function authoredCode(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!ts.isPropertyAssignment(property)) return undefined;
  const name = property.name;
  if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) return undefined;
  return name.text === "code" ? literalText(property.initializer) : undefined;
}

function authoredCodes(text: string): string[] {
  const source = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true);
  const codes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        const code = authoredCode(property);
        if (code !== undefined) codes.push(code);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return codes;
}

describe("legal-form authorship across delegated reducer handlers", () => {
  it("checks every runtime-imported reducer module without inventing form codes", () => {
    const { sources } = scanReducerReasonChecks(REDUCER);
    expect(sources).toContain(path.normalize("src/components/ward-management/ward-flow-legal-form-records-reducer.ts"));
    for (const file of sources) {
      expect(authoredCodes(readFileSync(file, "utf8")), file).toEqual([]);
    }
    expect(authoredCodes(readFileSync("src/components/ward-management/ward-legal-forms.ts", "utf8"))).toContain("1A");
  });

  it("detects literal codes including quoted keys and typed literals, but ignores comments and chosen forms", () => {
    const source = [
      "// const fake = { code: 'COMMENT' };",
      "const chosen = { code: event.formCode };",
      "const literal = { code: '1A' };",
      'const typed = { "code": ("5B" as const) };',
      "const checked = { code: `6A` satisfies string };",
    ].join("\n");
    expect(authoredCodes(source)).toEqual(["1A", "5B", "6A"]);
  });

  it("finds a fabricated form in an imported handler even when the facade has no literal", () => {
    const facade = "import { handle } from './child-reducer'; export const reducer = handle;";
    const child = "export function handle() { return { legalForm: { code: 'FABRICATED' } }; }";
    const read = (file: string): string => {
      if (file === path.normalize("engine/root-reducer.ts")) return facade;
      if (file === path.normalize("engine/child-reducer.ts")) return child;
      throw new Error(`Unexpected source: ${file}`);
    };
    const { sources } = scanReducerReasonChecks("engine/root-reducer.ts", read);
    expect(sources.flatMap((file) => authoredCodes(read(file)))).toEqual(["FABRICATED"]);
  });
});
