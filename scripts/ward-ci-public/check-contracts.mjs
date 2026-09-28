import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyChanges, hasDependencyChanges, parseNameStatus } from "./plan.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
function requireWorkflow(source) {
  for (const pattern of [
    /^on:\s*\n\s*pull_request:/mu,
    /permissions:\s*\n\s*contents: read/u,
    /persist-credentials: false/u,
    /name: Ward Flow required/u,
    /if: always\(\)/u,
    /needs: \[validate\]/u,
    /npm run check:ward-reference/u,
    /npm run check:ward-expected-reds/u,
    /check:ward-expected-reds -- --print-signatures/u,
    /npm run test:e2e:ward-journeys/u,
    /screen-verification\.mjs --check/u,
    /dependency-review-action@[0-9a-f]{40}/u,
    /steps\.plan\.outputs\.dependency_review == 'true'/u,
    /actions\/upload-artifact@[0-9a-f]{40}/u,
    /steps\.journeys\.outcome == 'failure'/u,
  ])
    assert.match(source, pattern);
  for (const pattern of [
    /pull_request_target:/u,
    /continue-on-error:/u,
    /secrets\./u,
    /contents: write/u,
    /WARD_PUBLIC_STANDALONE:/u,
  ]) {
    assert.doesNotMatch(source, pattern);
  }
}

requireWorkflow(workflow);
for (const bad of [
  workflow.replace("name: Ward Flow required", "name: Optional"),
  workflow.replace("if: always()", "if: success()"),
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
assert.equal(hasDependencyChanges([{ status: "M", file: "docs/ward-flow/README.md" }]), false);
assert.equal(hasDependencyChanges([{ status: "M", file: "backend/ward-flow/package-lock.json" }]), true);
assert.equal(hasDependencyChanges([{ status: "A", file: "package.json" }]), true);
console.log("Ward public CI contracts OK");
