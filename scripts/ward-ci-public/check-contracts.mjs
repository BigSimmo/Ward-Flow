import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyChanges, hasDependencyChanges, parseNameStatus } from "./plan.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/ward-flow.yml", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n",
);
function requireWorkflow(source) {
  for (const pattern of [
    /^on:\s*\n\s*pull_request:/mu,
    // Railway deploys main, so main must get its own run.
    /^ {2}push:\s*\n {4}branches: \[main\]/mu,
    /permissions:\s*\n\s*contents: read/u,
    /persist-credentials: false/u,
    /name: Ward Flow required/u,
    /if: always\(\)/u,
    /needs: \[static, unit, browser, secret-scan, build\]/u,
    /test "\$STATIC_RESULT" = success && test "\$UNIT_RESULT" = success && test "\$BROWSER_RESULT" = success && test "\$SECRET_SCAN_RESULT" = success && test "\$BUILD_RESULT" = success/u,
    /SECRET_SCAN_RESULT: \$\{\{ needs\.secret-scan\.result \}\}/u,
    /BUILD_RESULT: \$\{\{ needs\.build\.result \}\}/u,
    // Secret scan: a pinned gitleaks release verified against a pinned SHA-256, over full history,
    // honouring the reviewed fingerprints.
    /GITLEAKS_SHA256: [0-9a-f]{64}\n/u,
    /echo "\$\{GITLEAKS_SHA256\}  \$\{archive\}" \| sha256sum -c -/u,
    /gitleaks" git \. --redact --no-banner --exit-code 1 --gitleaks-ignore-path \.gitleaksignore/u,
    // The deploy build: Railway's command, in a job that never sets WARD_GATE_BUILD.
    /^ {8}run: node --max-old-space-size=8192 node_modules\/next\/dist\/bin\/next build --webpack$/mu,
    /fail-fast: false/u,
    /WARD_GATE_SHARD: \$\{\{ matrix\.shard \}\}\/\d+/u,
    /related-tests\.mjs --base "\$WARD_BASE_SHA" --head HEAD/u,
    /node scripts\/ward-ci-public\/changed-checks\.mjs/u,
    /steps\.plan\.outputs\.unit == 'true'/u,
    /steps\.plan\.outputs\.browser == 'true'/u,
    // Browser builds may skip their own type check only because the static job checks route types.
    /next\/dist\/bin\/next typegen\n\s*node node_modules\/typescript\/bin\/tsc -p tsconfig\.json --noEmit/u,
    /WARD_GATE_BUILD: "1"/u,
    /actions\/cache@[0-9a-f]{40}/u,
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
  // The production build job must not inherit the gate build's ignoreBuildErrors.
  const buildJob = /^ {2}build:\n([\s\S]*?)(?=^ {2}[a-z][a-z0-9_-]*:\n|(?![\s\S]))/mu.exec(source)?.[1];
  assert.ok(buildJob, "the production build job is required");
  assert.doesNotMatch(buildJob, /^(?!\s*#).*WARD_GATE_BUILD/mu);
  assert.match(buildJob, /next\/dist\/bin\/next build --webpack/u);
}

requireWorkflow(workflow);
for (const bad of [
  workflow.replace("name: Ward Flow required", "name: Optional"),
  workflow.replace("if: always()", "if: success()"),
  workflow.replace("contents: read", "contents: write"),
  workflow.replace("npm run check:ward-expected-reds", "echo no unit checks"),
  workflow.replace(
    "needs: [static, unit, browser, secret-scan, build]",
    "needs: [static, browser, secret-scan, build]",
  ),
  workflow.replace("needs: [static, unit, browser, secret-scan, build]", "needs: [static, unit, browser]"),
  workflow.replace(' && test "$SECRET_SCAN_RESULT" = success', ""),
  workflow.replace(' && test "$BUILD_RESULT" = success', ""),
  workflow.replace("  push:\n    branches: [main]\n", ""),
  workflow.replace(/\| sha256sum -c -/u, "| cat"),
  workflow.replace("--gitleaks-ignore-path .gitleaksignore", ""),
  workflow.replace(
    "        run: node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack",
    '        env:\n          WARD_GATE_BUILD: "1"\n        run: node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack',
  ),
  workflow.replace("shard: [1, 2, 3, 4, 5]", "shard: [1, 2, 3, 4]"),
  workflow.replaceAll("fail-fast: false", "fail-fast: true"),
  workflow.replace("group: [1, 2, 3]", "group: [1, 2]"),
  workflow.replace("node scripts/ward-ci-public/changed-checks.mjs", "echo skipped"),
  workflow.replace("node node_modules/next/dist/bin/next typegen", "echo no route types"),
  workflow.replace("tsc -p tsconfig.json --noEmit", "tsc -p tsconfig.typecheck.json --noEmit"),
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
// Dynamic scope: narrower only for positively recognised files, never for anything else.
const scope = (...files) => {
  const { full, unit, browser } = classifyChanges(files.map((file) => ({ status: "M", file })));
  return { full, unit, browser };
};
const everything = { full: true, unit: true, browser: true };
assert.deepEqual(scope("docs/ward-flow/README.md"), { full: false, unit: false, browser: false });
assert.deepEqual(scope("backend/ward-flow/server.mjs", "docs/ward-flow/README.md"), {
  full: true,
  unit: false,
  browser: false,
});
assert.deepEqual(scope("tests/ward-nav.test.ts", "backend/ward-flow/server.mjs"), {
  full: true,
  unit: true,
  browser: false,
});
assert.deepEqual(scope("tests/ward-patient-search.dom.test.tsx"), { full: true, unit: true, browser: false });
assert.deepEqual(scope("tests/ui-ward-roles.spec.ts"), everything);
assert.deepEqual(scope("tests/ward-nav.test.ts", "src/app/layout.tsx"), everything);
assert.deepEqual(scope("tests/helpers/ward-fixture.ts"), everything);
assert.deepEqual(scope("backend/ward-flow/server.mjs", ".github/workflows/ward-flow.yml"), everything);
assert.deepEqual(scope("tests/ward-expected-reds.json"), everything);
assert.deepEqual(classifyChanges([{ status: "D", file: "tests/ward-nav.test.ts" }]).browser, true);
assert.deepEqual(classifyChanges([]).browser, true);
assert.equal(classifyChanges([]).full, true);
assert.equal(hasDependencyChanges([{ status: "M", file: "docs/ward-flow/README.md" }]), false);
assert.equal(hasDependencyChanges([{ status: "M", file: "backend/ward-flow/package-lock.json" }]), true);
assert.equal(hasDependencyChanges([{ status: "A", file: "package.json" }]), true);
console.log("Ward public CI contracts OK");
