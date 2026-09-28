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
    /needs: \[static, unit, browser\]/u,
    /test "\$STATIC_RESULT" = success && test "\$UNIT_RESULT" = success && test "\$BROWSER_RESULT" = success/u,
    /fail-fast: false/u,
    /WARD_GATE_SHARD: \$\{\{ matrix\.shard \}\}\/\d+/u,
    /WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/\d+/u,
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
  // The unit shards must be exactly 1..N for the N named in WARD_GATE_SHARD, or some files never run.
  const shards = /^\s*shard: \[([\d, ]+)\]$/mu
    .exec(source)?.[1]
    .split(",")
    .map((value) => Number(value.trim()));
  const count = Number(/WARD_GATE_SHARD: \$\{\{ matrix\.shard \}\}\/(\d+)/u.exec(source)?.[1]);
  assert.ok(shards && count >= 1, "unit shard matrix and WARD_GATE_SHARD count are required");
  assert.deepEqual(
    shards,
    Array.from({ length: count }, (_, index) => index + 1),
  );
  // Likewise the browser groups must be exactly 1..N for the N in WARD_JOURNEY_GROUP.
  const groups = /^\s*group: \[([\d, ]+)\]$/mu
    .exec(source)?.[1]
    .split(",")
    .map((value) => Number(value.trim()));
  const groupCount = Number(/WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/(\d+)/u.exec(source)?.[1]);
  assert.ok(groups && groupCount >= 1, "browser group matrix and WARD_JOURNEY_GROUP count are required");
  assert.deepEqual(
    groups,
    Array.from({ length: groupCount }, (_, index) => index + 1),
  );
}

requireWorkflow(workflow);
for (const bad of [
  workflow.replace("name: Ward Flow required", "name: Optional"),
  workflow.replace("if: always()", "if: success()"),
  workflow.replace("contents: read", "contents: write"),
  workflow.replace("npm run check:ward-expected-reds", "echo no unit checks"),
  workflow.replace("needs: [static, unit, browser]", "needs: [static, browser]"),
  workflow.replace("shard: [1, 2, 3, 4]", "shard: [1, 2, 3]"),
  workflow.replaceAll("fail-fast: false", "fail-fast: true"),
  workflow.replace("group: [1, 2, 3]", "group: [1, 2]"),
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
