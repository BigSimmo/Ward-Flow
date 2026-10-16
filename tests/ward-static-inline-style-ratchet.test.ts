// tests/ward-static-inline-style-ratchet.test.ts
//
// A JSX `style={{ ... }}` whose values are all fixed literals belongs in the component's CSS
// Module. The styles cleanup of 16 October 2026 moved about 250 of them into stylesheets with no
// visual change. This ratchet stops new ones and lets the remaining ones only go down.
//
// Inline styles that carry data (a width from a percentage, a custom property from a record)
// are not counted. Neither are the files listed in REMAINING, each with its reason.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** Static inline styles each file may still carry. Lower a number when you move one out, never raise it. */
const REMAINING: Record<string, number> = {
  // Renders when the root layout has failed, so it cannot rely on any stylesheet loading.
  "src/app/global-error.tsx": 9,
  // next/og ImageResponse only understands inline styles.
  "src/app/opengraph-image.tsx": 4,
  // Raw colour fallbacks that tests/ward-raw-colour.test.ts forbids in a ward stylesheet.
  "src/components/ward-management/referrals/upload-forms-modal.tsx": 11,
  // Pills on the retired --text-3xs size, pinned by the text size ratchet.
  "src/components/ward-management/override-register.tsx": 2,
  // An undeclared --r0 token that the token reference test forbids in a stylesheet.
  "src/components/ward-management/board/ward-board.tsx": 1,
  // Not mounted by any screen.
  "src/components/ward-management/ward-chrome-search.tsx": 18,
  // Owned by the Tasks screen work.
  "src/components/ward-management/ward-tasks-drawer.tsx": 6,
};

function isLiteral(node: ts.Expression): boolean {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  );
}

function countStaticInlineStyles(fileName: string, text: string): number {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "style" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isObjectLiteralExpression(node.initializer.expression) &&
      node.initializer.expression.properties.length > 0 &&
      node.initializer.expression.properties.every(
        (property) => ts.isPropertyAssignment(property) && isLiteral(property.initializer),
      )
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

describe("fixed inline styles live in CSS Modules", () => {
  it("adds no static inline style beyond the remaining allowance", () => {
    const files = execFileSync("git", ["ls-files", "src/**/*.tsx"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const over: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("style=")) continue;
      const count = countStaticInlineStyles(file, text);
      if (count > (REMAINING[file] ?? 0))
        over.push(`${file}: ${count} static inline styles, allowed ${REMAINING[file] ?? 0}`);
    }
    expect(over, "move fixed styles into the component's CSS Module").toEqual([]);
  });

  it("control: counts only all-literal style objects", () => {
    const text = `const a = <div style={{ margin: 0, color: "red" }} />;
const b = <div style={{ width: \`\${pct}%\` }} />;
const c = <div style={{ margin: 0, width }} />;`;
    expect(countStaticInlineStyles("control.tsx", text)).toBe(1);
  });
});
