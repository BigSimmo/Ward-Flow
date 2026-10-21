import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { classifyChanges, hasDependencyChanges, parseNameStatus } from "./plan.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/ward-flow.yml", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n",
);
function requireWorkflow(source) {
  // This workflow intentionally uses a bounded YAML subset: jobs at two spaces,
  // steps at six, scalar step fields at eight, literal run blocks at ten.
  // Comment lines cannot count as executable steps or shell commands.
  source = source
    .split("\n")
    .filter((line) => !/^\s*#/u.test(line))
    .join("\n");
  assert.match(source, /^on:\n {2}pull_request:\n {4}branches: \[main\]$/mu);
  assert.match(
    source,
    /^concurrency:\n {2}group: ward-flow-\$\{\{ github.event_name == 'pull_request' && format\('pr-\{0\}', github.event.pull_request.number\) \|\| format\('\{0\}-\{1\}', github.event_name, github.run_id\) \}\}\n {2}cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}$/mu,
  );
  const jobs = new Map();
  for (const match of source.matchAll(
    /^ {2}([a-z][a-z0-9_-]*):\n([\s\S]*?)(?=^ {2}[a-z][a-z0-9_-]*:\n|(?![\s\S]))/gmu,
  )) {
    assert.ok(!jobs.has(match[1]), `duplicate job ${match[1]}`);
    const keys = [...match[2].matchAll(/^ {4}([a-z][a-z0-9_-]*):/gmu)].map((field) => field[1]);
    assert.equal(new Set(keys).size, keys.length, `duplicate job field in ${match[1]}`);
    jobs.set(match[1], match[2]);
  }
  function steps(job) {
    assert.ok(jobs.has(job), `missing job ${job}`);
    return jobs
      .get(job)
      .split(/^ {6}- /mu)
      .slice(1)
      .map((text) => {
        const fields = new Map();
        for (const match of `        ${text}`.matchAll(/^ {8}([a-z][a-z0-9_-]*): ([^\n]*)(?:\n|$)/gmu)) {
          assert.ok(!fields.has(match[1]), `duplicate step field ${match[1]}`);
          fields.set(match[1], match[2]);
        }
        return { fields, text };
      });
  }
  const step = (job, name) => {
    const found = steps(job).filter(({ fields }) => fields.get("name") === name);
    assert.equal(found.length, 1, `${job}: exactly one ${name} step is required`);
    return found[0];
  };
  const exactStep = (job, name, run, condition) => {
    const { fields } = step(job, name);
    assert.equal(fields.get("run"), run, `${job}: ${name} executable command`);
    assert.equal(fields.get("if"), condition, `${job}: ${name} routing`);
  };
  const expression = (text) => "${{ " + text + " }}";
  for (const job of ["static", "unit", "browser", "release-gate", "build", "coverage"])
    exactStep(job, "Plan Ward scope", "node scripts/ward-ci-public/plan.mjs");
  exactStep("static", "Verify the scope plan against the diff", "node scripts/ward-ci-public/verify-plan.mjs");
  for (const job of ["static", "unit", "browser", "release-gate", "build", "coverage"]) {
    assert.equal(step(job, "Plan Ward scope").fields.get("id"), "plan", `${job} planner id`);
    assert.equal(step(job, "Install locked dependencies").fields.get("id"), "install", `${job} install id`);
  }
  assert.equal(step("browser", "Install Chromium").fields.get("id"), "chromium");
  assert.equal(step("release-gate", "Install Chromium and WebKit").fields.get("id"), "browsers");
  exactStep(
    "release-gate",
    "Install Chromium and WebKit",
    "node node_modules/playwright/cli.js install --with-deps chromium webkit",
    expression("!cancelled() && steps.install.outcome == 'success'"),
  );
  const verifier = step("static", "Verify the scope plan against the diff");
  for (const output of [
    "full",
    "unit",
    "browser",
    "policy",
    "dependency_review",
    "owner_index",
    "rules_index",
    "organisation",
  ])
    assert.ok(
      verifier.text.includes(
        `          WARD_PLAN_${output.toUpperCase()}: ${expression(`steps.plan.outputs.${output}`)}\n`,
      ),
      `verifier binding ${output}`,
    );
  for (const job of ["static", "secret-scan"]) assert.doesNotMatch(jobs.get(job), /^ {4}(?:if|needs):/mu);
  assert.match(jobs.get("required"), /^ {4}name: Ward Flow required$/mu);
  assert.match(jobs.get("required"), /^ {4}if: always\(\)$/mu);
  assert.match(
    jobs.get("required"),
    /^ {4}needs: \[reuse, static, unit, browser, release-gate, secret-scan, build, coverage\]$/mu,
  );
  const full = expression("!cancelled() && steps.plan.outputs.full == 'true'");
  exactStep("static", "Install locked dependencies", "npm ci --ignore-scripts", full);
  exactStep(
    "build",
    "Install locked dependencies",
    "npm ci --ignore-scripts",
    expression("!cancelled() && steps.plan.outputs.full == 'true' && steps.plan.outputs.policy != 'true'"),
  );
  for (const [job, scope] of [
    ["unit", "unit"],
    ["browser", "browser"],
    ["release-gate", "browser"],
    ["coverage", "unit"],
  ])
    exactStep(
      job,
      "Install locked dependencies",
      "npm ci --ignore-scripts",
      expression(`!cancelled() && steps.plan.outputs.${scope} == 'true'`),
    );
  exactStep(
    "static",
    "Check maintained policy contracts",
    "node scripts/ward-ci-public/check-policy-contracts.mjs",
    expression("!cancelled() && steps.plan.outputs.policy == 'true' && steps.install.outcome == 'success'"),
  );
  for (const [name, command] of [
    ["Check Ward reference data", "npm run check:ward-reference"],
    ["Check Ward legal wording", "npm run check:ward-legal-language"],
  ])
    exactStep(
      "static",
      name,
      command,
      expression("!cancelled() && steps.install.outcome == 'success' && steps.plan.outputs.policy != 'true'"),
    );
  exactStep(
    "static",
    "Check reference-pack integrity",
    "node scripts/ward-flow/maintain-docs-and-organisation.mjs --pack-only --check",
  );
  for (const [name, command] of [
    ["Check Ward screen map", "node scripts/ward-flow/screen-map.mjs --check"],
    ["Check drawing manifest", "node scripts/ward-flow/mockup-manifest.mjs --check"],
    ["Check screen verification index", "node scripts/ward-flow/screen-verification.mjs --check"],
    ["Check scripts inventory", "npm run docs:check-inventory"],
    ["Check architecture index coverage", "npm run docs:check-index"],
  ])
    exactStep("static", name, command);
  exactStep(
    "static",
    "Check generated site map",
    "npm run sitemap:check",
    expression("!cancelled() && steps.install.outcome == 'success'"),
  );
  for (const [name, command, output] of [
    ["Check owner rulings index", "node scripts/ward-flow/owner-rulings-index.mjs --check", "owner_index"],
    ["Check lessons rules index", "node scripts/ward-flow/rules-index.mjs --check", "rules_index"],
    [
      "Check file organisation",
      "node scripts/ward-flow/organisation.mjs --check --source working-tree",
      "organisation",
    ],
  ])
    exactStep("static", name, command, expression(`steps.plan.outputs.${output} == 'true'`));
  exactStep(
    "coverage",
    "Check complete executable coverage inventory",
    "npm run check:coverage-inventory",
    expression("!cancelled() && steps.install.outcome == 'success'"),
  );
  exactStep(
    "browser",
    "Check the API CSRF proxy boundary",
    "node scripts/run-playwright.mjs --project=chromium api-csrf-proxy.spec.ts",
    expression("!cancelled() && steps.chromium.outcome == 'success' && matrix.group == 1"),
  );
  assert.doesNotMatch(jobs.get("release-gate"), /^ {4}(?:if|needs):/mu);
  exactStep(
    "release-gate",
    "Run the release-gate journeys",
    "npm run test:e2e:release-gate",
    expression("!cancelled() && steps.browsers.outcome == 'success'"),
  );
  const scan = step("secret-scan", "Scan git history for secrets");
  assert.equal(scan.fields.get("run"), "|");
  assert.equal(scan.fields.get("if"), undefined);
  assert.equal(
    scan.text.split("        run: |\n")[1]?.trim(),
    '\"$RUNNER_TEMP/gitleaks\" git . --redact --no-banner --exit-code 1 --gitleaks-ignore-path .gitleaksignore --log-opts=\"--full-history HEAD\"',
  );
  const verdict = step("required", "Require every Ward Flow job to succeed");
  assert.equal(verdict.fields.get("if"), undefined);
  assert.match(verdict.text, /^ {10}RELEASE_GATE_RESULT: \$\{\{ needs.release-gate.result \}\}$/mu);
  for (const [key, job] of [
    ["STATIC_RESULT", "static"],
    ["UNIT_RESULT", "unit"],
    ["BROWSER_RESULT", "browser"],
    ["SECRET_SCAN_RESULT", "secret-scan"],
    ["BUILD_RESULT", "build"],
    ["COVERAGE_RESULT", "coverage"],
    ["RELEASE_GATE_RESULT", "release-gate"],
  ]) {
    const lines = verdict.text.split("\n").filter((line) => line.startsWith(`          ${key}:`));
    assert.deepEqual(
      lines,
      [`          ${key}: ${expression(`needs.${job}.result`)}`],
      `required result binding ${key}`,
    );
  }
  const ordinary =
    'test "$STATIC_RESULT" = success && test "$UNIT_RESULT" = success && test "$BROWSER_RESULT" = success && test "$SECRET_SCAN_RESULT" = success && test "$BUILD_RESULT" = success && test "$COVERAGE_RESULT" = success && test "$RELEASE_GATE_RESULT" = success';
  const reused =
    'test "$STATIC_RESULT" = success && test "$SECRET_SCAN_RESULT" = success && test "$UNIT_RESULT" = skipped && test "$BROWSER_RESULT" = skipped && test "$BUILD_RESULT" = skipped && test "$COVERAGE_RESULT" = skipped && test "$RELEASE_GATE_RESULT" = success';
  assert.equal(
    verdict.text.split("        run: |\n")[1]?.trim(),
    `if [ "$REUSE_VERIFIED" != true ]; then\n            ${ordinary}\n          else\n            ${reused}\n          fi`,
  );

  for (const pattern of [
    /^on:\s*\n\s*pull_request:/mu,
    // Railway deploys main, so main must get its own run.
    /^ {2}push:\s*\n {4}branches: \[main\]/mu,
    /permissions:\s*\n\s*contents: read/u,
    /persist-credentials: false/u,
    /name: Ward Flow required/u,
    /if: always\(\)/u,
    /needs: \[reuse, static, unit, browser, release-gate, secret-scan, build, coverage\]/u,
    /test "\$STATIC_RESULT" = success && test "\$UNIT_RESULT" = success && test "\$BROWSER_RESULT" = success && test "\$SECRET_SCAN_RESULT" = success && test "\$BUILD_RESULT" = success && test "\$COVERAGE_RESULT" = success/u,
    /SECRET_SCAN_RESULT: \$\{\{ needs\.secret-scan\.result \}\}/u,
    /BUILD_RESULT: \$\{\{ needs\.build\.result \}\}/u,
    /COVERAGE_RESULT: \$\{\{ needs\.coverage\.result \}\}/u,
    // Coverage thresholds (vitest.config.mts) are enforced over the whole unit suite: every shard
    // records a blob report and the coverage job merges all of them before judging the thresholds.
    /WARD_COVERAGE_BLOB_DIR: \$\{\{ runner\.temp \}\}\/ward-coverage-blobs/u,
    /if-no-files-found: error/u,
    /^ {10}node node_modules\/vitest\/vitest\.mjs run --merge-reports="\$WARD_SHARD_BLOBS" --coverage$/mu,
    // Main-push reuse: only on a push to main, and the skipped path still requires static checks and
    // the secret scan, with the four reused jobs skipped rather than failed or cancelled.
    /if: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}/u,
    /run: node scripts\/ward-ci-public\/main-reuse\.mjs/u,
    /if \[ "\$REUSE_VERIFIED" != true \]; then\n/u,
    /test "\$STATIC_RESULT" = success && test "\$SECRET_SCAN_RESULT" = success && test "\$UNIT_RESULT" = skipped && test "\$BROWSER_RESULT" = skipped && test "\$BUILD_RESULT" = skipped && test "\$COVERAGE_RESULT" = skipped/u,
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
    // Next build cache: restored on every event, saved only on main, so per-SHA PR entries can
    // never fill the 10 GB Actions cache again.
    /actions\/cache\/restore@[0-9a-f]{40}/u,
    /if: \$\{\{ !cancelled\(\) && github\.ref == 'refs\/heads\/main' && steps\.next-cache\.outcome == 'success'[^\n]*\n\s+uses: actions\/cache\/save@[0-9a-f]{40}/u,
    /WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/\d+/u,
    /npm run check:ward-reference/u,
    /npm run check:ward-expected-reds/u,
    /check:ward-expected-reds -- --print-signatures/u,
    /npm run test:e2e:ward-journeys/u,
    /^ {8}run: npm run docs:check-links$/mu,
    // Facts and retired terms: the PR or merge-queue base must reach the check so new retired-term lines fail.
    /WARD_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.merge_group\.base_sha \}\}\n {8}run: node scripts\/doc-facts\.mjs$/mu,
    /run: node scripts\/ward-flow\/check-clinical-governance-gate\.mjs/u,
    /id: chromium\n\s*timeout-minutes: 8/u,
    /run: node scripts\/ward-ci-public\/install-chromium\.mjs/u,
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
    /actions\/cache@/u,
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
  // One Node version everywhere: every job reads .nvmrc, which matches Railway's Node
  // (docs/hosting.md, RAILPACK_NODE_VERSION). No job may pin its own literal version.
  assert.match(buildJob, /node-version-file: \.nvmrc/u);
  assert.doesNotMatch(source, /node-version: /u);
  // Whole-tree lint on non-PR runs is enforcing: the eslint command is the step's whole `run:`,
  // not wrapped in an `if !` that downgrades failure to a warning.
  assert.match(
    source,
    /- name: Lint the whole tree\n\s*if: [^\n]*\n\s*run: node --max-old-space-size=8192 node_modules\/eslint\/bin\/eslint\.js src tests scripts [^\n]*--max-warnings 0[^\n]*\n/u,
  );
  assert.doesNotMatch(source, /if ! node[^\n]*eslint/u);
  // The coverage job must judge the thresholds: it may never set the shard flag that drops them, and it
  // must expect a blob from every unit shard.
  const jobText = (name) =>
    new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[a-z][a-z0-9_-]*:\\n|(?![\\s\\S]))`, "mu").exec(source)?.[1];
  assert.ok(
    jobText("static")?.includes("run: npm run docs:check-links\n"),
    "docs:check-links must run in the static job",
  );
  const coverageJob = jobText("coverage");
  assert.ok(coverageJob, "the coverage job is required");
  assert.doesNotMatch(coverageJob, /WARD_COVERAGE_BLOB_DIR/u);
  assert.match(coverageJob, /needs: \[reuse, unit\]/u);
  assert.equal(Number(/WARD_SHARD_COUNT: "(\d+)"/u.exec(coverageJob)?.[1]), count);
  // Only the four reusable jobs may be skipped by the reuse proof; static and secret scan always run.
  const reuseGate = "if: ${{ !cancelled() && needs.reuse.outputs.verified != 'true' }}";
  for (const name of ["unit", "browser", "build", "coverage"]) assert.ok(jobText(name)?.includes(reuseGate), name);
  for (const name of ["static", "secret-scan"]) assert.doesNotMatch(jobText(name) ?? "", /needs\.reuse/u);
  const reuseJob = jobText("reuse");
  assert.ok(reuseJob, "the main reuse job is required");
  assert.doesNotMatch(reuseJob, /contents: write|pull-requests: write|actions: write/u);
}

requireWorkflow(workflow);
for (const bad of [
  ...[
    "node scripts/ward-flow/screen-map.mjs --check",
    "node scripts/ward-flow/mockup-manifest.mjs --check",
    "node scripts/ward-flow/screen-verification.mjs --check",
    "npm run docs:check-inventory",
    "npm run docs:check-index",
    "npm run sitemap:check",
  ].map((command) => workflow.replace(`run: ${command}`, "run: echo omitted documentation contract")),
  workflow.replaceAll("        id: plan\n", "        id: unused-plan\n"),
  workflow.replaceAll("        id: install\n", "        id: unused-install\n"),
  workflow.replace("        id: browsers\n", "        id: unused-browsers\n"),
  workflow.replace("run: node node_modules/playwright/cli.js install --with-deps chromium webkit", "run: echo omitted"),

  workflow.replace(
    "run: node scripts/ward-flow/maintain-docs-and-organisation.mjs --pack-only --check",
    "run: echo omitted",
  ),
  workflow.replace("run: npm run check:coverage-inventory", "run: echo omitted"),
  workflow.replace(
    "run: node scripts/run-playwright.mjs --project=chromium api-csrf-proxy.spec.ts",
    "run: echo omitted",
  ),
  workflow.replace("browser, release-gate, secret-scan", "browser, secret-scan"),
  workflow.replace(' && test "$RELEASE_GATE_RESULT" = success', ""),
  workflow.replace(
    "          RELEASE_GATE_RESULT: ${{ needs.release-gate.result }}",
    "          RELEASE_GATE_RESULT: success",
  ),
  workflow.replace("    name: Ward Flow release gate\n", "    name: Ward Flow release gate\n    if: false\n"),
  workflow.replace("          UNIT_RESULT: ${{ needs.unit.result }}", "          UNIT_RESULT: success"),
  workflow.replaceAll("run: node scripts/ward-ci-public/plan.mjs", "run: echo omitted"),
  workflow.replace("run: node scripts/ward-ci-public/verify-plan.mjs", "run: echo omitted"),
  workflow.replaceAll("steps.plan.outputs.full == 'true'", "steps.plan.outputs.full != 'true'"),
  workflow.replaceAll("steps.plan.outputs.policy == 'true'", "steps.plan.outputs.policy != 'true'"),
  workflow.replace(/concurrency:\n(?: {2}[^\n]*\n)+/u, ""),
  workflow.replace('test "$RELEASE_GATE_RESULT" = success\n', 'test "$RELEASE_GATE_RESULT" = success || true\n'),
  workflow.replace("  pull_request:\n    branches: [main]", "  pull_request:\n    branches: [nonexistent-branch]"),
  workflow.replace(
    '          "$RUNNER_TEMP/gitleaks" git . --redact',
    '          # "$RUNNER_TEMP/gitleaks" git . --redact',
  ),

  workflow.replace("name: Ward Flow required", "name: Optional"),
  workflow.replace("timeout-minutes: 8", "timeout-minutes: 30"),
  workflow.replace("run: node scripts/ward-ci-public/install-chromium.mjs", "run: npx playwright install chromium"),
  workflow.replace("run: node scripts/ward-flow/check-clinical-governance-gate.mjs", "run: echo skipped"),
  workflow.replace("if: always()", "if: success()"),
  workflow.replace("contents: read", "contents: write"),
  workflow.replace("npm run check:ward-expected-reds", "echo no unit checks"),
  workflow.replace(
    "needs: [reuse, static, unit, browser, release-gate, secret-scan, build, coverage]",
    "needs: [reuse, static, browser, secret-scan, build]",
  ),
  workflow.replace(
    "needs: [reuse, static, unit, browser, release-gate, secret-scan, build, coverage]",
    "needs: [static, unit, browser]",
  ),
  workflow.replace(' && test "$SECRET_SCAN_RESULT" = success', ""),
  workflow.replace(' && test "$BUILD_RESULT" = success', ""),
  workflow.replace(' && test "$COVERAGE_RESULT" = success', ""),
  workflow.replace('--merge-reports="$WARD_SHARD_BLOBS" --coverage', '--merge-reports="$WARD_SHARD_BLOBS"'),
  workflow.replace('WARD_SHARD_COUNT: "8"', 'WARD_SHARD_COUNT: "7"'),
  workflow.replace(
    "          WARD_SHARD_COUNT:",
    "          WARD_COVERAGE_BLOB_DIR: ${{ runner.temp }}/x\n          WARD_SHARD_COUNT:",
  ),
  workflow.replace("          WARD_COVERAGE_BLOB_DIR: ${{ runner.temp }}/ward-coverage-blobs\n", ""),
  workflow.replace("if-no-files-found: error", "if-no-files-found: warn"),
  workflow.replace(' && test "$UNIT_RESULT" = skipped', ""),
  workflow.replace(
    'test "$STATIC_RESULT" = success && test "$SECRET_SCAN_RESULT" = success && test "$UNIT_RESULT" = skipped',
    'test "$UNIT_RESULT" = skipped',
  ),
  workflow.replace(
    "    name: Ward Flow production build\n    needs: reuse\n    if: ${{ !cancelled() && needs.reuse.outputs.verified != 'true' }}\n",
    "    name: Ward Flow production build\n    needs: reuse\n",
  ),
  workflow.replace(
    "    name: Ward Flow static checks\n",
    "    name: Ward Flow static checks\n    needs: reuse\n    if: ${{ !cancelled() && needs.reuse.outputs.verified != 'true' }}\n",
  ),
  workflow.replace("if: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}", "if: always()"),
  workflow.replace("  push:\n    branches: [main]\n", ""),
  workflow.replace(/\| sha256sum -c -/u, "| cat"),
  workflow.replace("--gitleaks-ignore-path .gitleaksignore", ""),
  workflow.replace(
    "        run: node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack",
    '        env:\n          WARD_GATE_BUILD: "1"\n        run: node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack',
  ),
  workflow.replace("shard: [1, 2, 3, 4, 5, 6, 7, 8]", "shard: [1, 2, 3, 4, 5, 6, 7]"),
  workflow.replaceAll("fail-fast: false", "fail-fast: true"),
  workflow.replace("group: [1, 2, 3]", "group: [1, 2]"),
  workflow.replace("node scripts/ward-ci-public/changed-checks.mjs", "echo skipped"),
  workflow.replace("run: npm run docs:check-links", "run: echo skipped documentation gate"),
  workflow.replace("node node_modules/next/dist/bin/next typegen", "echo no route types"),
  workflow.replace("tsc -p tsconfig.json --noEmit", "tsc -p tsconfig.typecheck.json --noEmit"),
  workflow.replace("node-version-file: .nvmrc", 'node-version: "24.15.0"'),
  workflow.replace(
    "        run: node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js",
    "        run: |\n          if ! node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js",
  ),
])
  assert.throws(() => requireWorkflow(bad));

const verdictShell = /^ {8}run: \|\n([\s\S]*)$/mu.exec(workflow.slice(workflow.indexOf("  required:\n")))?.[1];
assert.ok(verdictShell);
const runVerdict = (values) =>
  spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", verdictShell], { env: values }).status;
for (const reuse of [false, true]) {
  const values = {
    REUSE_VERIFIED: String(reuse),
    STATIC_RESULT: "success",
    SECRET_SCAN_RESULT: "success",
    RELEASE_GATE_RESULT: "success",
    ...Object.fromEntries(
      ["UNIT_RESULT", "BROWSER_RESULT", "BUILD_RESULT", "COVERAGE_RESULT"].map((key) => [
        key,
        reuse ? "skipped" : "success",
      ]),
    ),
  };
  assert.equal(runVerdict(values), 0, `valid ${reuse ? "reuse" : "ordinary/scoped plan"} verdict`);
  for (const key of Object.keys(values).filter((key) => key !== "REUSE_VERIFIED"))
    for (const result of ["failure", "cancelled", "", key === "RELEASE_GATE_RESULT" ? "skipped" : "unexpected"])
      assert.notEqual(runVerdict({ ...values, [key]: result }), 0, `${key}=${result} must block`);
}

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
console.log("Ward public CI contracts OK — executable workflow mutations rejected; 58 aggregate verdict cases passed");
