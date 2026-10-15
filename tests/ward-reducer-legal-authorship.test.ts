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
  const key = ts.isComputedPropertyName(name)
    ? literalText(name.expression)
    : ts.isIdentifier(name) || ts.isStringLiteral(name)
      ? name.text
      : undefined;
  return key === "code" ? literalText(property.initializer) : undefined;
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
    // Rebuild on the current facade, whose legal handlers have not been extracted.
    // Require its existing delegated roots rather than an absent historical module.
    expect(sources).toEqual(
      expect.arrayContaining([
        path.normalize(REDUCER),
        path.normalize("src/components/ward-management/capacity/planned-admissions-reducer.ts"),
        path.normalize("src/components/ward-management/ward-inbox-reducer.ts"),
        path.normalize("src/components/ward-management/alerts/ward-broadcast-reducer.ts"),
        path.normalize("src/components/ward-management/ward-flow-record-events.ts"),
        path.normalize("src/components/ward-management/ward-flow-undo-events.ts"),
      ]),
    );
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

  it.each([
    'const form = { ["code"]: "FABRICATED" };',
    "const form = { ['code']: 'FABRICATED' };",
    "const form = { [`code`]: ('FABRICATED' as const) };",
    'const form = { [("code" as const)]: ("FABRICATED" satisfies string) };',
  ])("detects fabricated form codes behind literal computed keys: %s", (source) => {
    expect(authoredCodes(source)).toEqual(["FABRICATED"]);
  });

  it("keeps chosen form codes and unrelated computed fields distinct from authored form codes", () => {
    expect(authoredCodes('const chosen = { ["code"]: event.formCode, ["label"]: "1A" };')).toEqual([]);
  });
});
