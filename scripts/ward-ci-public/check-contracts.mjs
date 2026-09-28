import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyChanges, parseNameStatus } from "./plan.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
function requireWorkflow(source) {
  for (const pattern of [
    /^on:\s*\n\s*pull_request:/mu,
    /permissions:\s*\n\s*contents: read/u,
    /persist-credentials: false/u,
    /name: Ward Flow required/u,
    /if: always\(\)/u,
    /^  browser:\s*\n\s*name: Ward Flow browser journeys/mu,
    /needs: \[validate, browser\]/u,
    /test "\$VALIDATION_RESULT" = success && test "\$BROWSER_RESULT" = success/u,
    /npm run check:ward-reference/u,
    /npm run check:ward-expected-reds/u,
    /WARD_PUBLIC_STANDALONE: "1"/u,
    /npm run test:e2e:ward-journeys/u,
  ])
    assert.match(source, pattern);
  for (const pattern of [/pull_request_target:/u, /continue-on-error:/u, /secrets\./u, /contents: write/u]) {
    assert.doesNotMatch(source, pattern);
  }
}

requireWorkflow(workflow);
for (const bad of [
  workflow.replace("name: Ward Flow required", "name: Optional"),
  workflow.replace("if: always()", "if: success()"),
  workflow.replace("needs: [validate, browser]", "needs: [validate]"),
  workflow.replace(
    'test "$VALIDATION_RESULT" = success && test "$BROWSER_RESULT" = success',
    'test "$VALIDATION_RESULT" = success',
  ),
  workflow.replace("contents: read", "contents: write"),
  workflow.replace("npm run check:ward-expected-reds", "echo no unit checks"),
])
  assert.throws(() => requireWorkflow(bad));

assert.deepEqual(parseNameStatus("M\tdocs/ward-flow/README.md\n"), [{ status: "M", file: "docs/ward-flow/README.md" }]);
assert.equal(classifyChanges([{ status: "M", file: "docs/ward-flow/README.md" }]).full, false);
assert.equal(classifyChanges([{ status: "D", file: "docs/ward-flow/README.md" }]).full, true);
assert.equal(
  classifyChanges([{ status: "M", file: "src/components/ward-management/board/ward-board.tsx" }]).full,
  true,
);
assert.equal(classifyChanges([{ status: "M", file: ".github/workflows/ward-flow.yml" }]).full, true);
assert.equal(classifyChanges([]).full, true);
console.log("Ward public CI contracts OK");
