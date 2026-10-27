import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { classifyChanges, hasDependencyChanges, parseNameStatus } from "./plan.mjs";

const workflow = readFileSync(new URL("../../.github/workflows/ward-flow.yml", import.meta.url), "utf8").replace(
  /\r\n/gu,
  "\n",
);
function requireWorkflow(source) {
  // Dependency-free, bounded YAML subset: duplicate fields and comments cannot
  // supply executable evidence. Exact commands prevent shell failure suppression.
  source = source
    .split("\n")
    .filter((line) => !/^\s*#/u.test(line))
    .join("\n");
  const jobs = new Map();
  for (const match of source.matchAll(
    /^ {2}([a-z][a-z0-9_-]*):\n([\s\S]*?)(?=^ {2}[a-z][a-z0-9_-]*:\n|(?![\s\S]))/gmu,
  )) {
    assert.ok(!jobs.has(match[1]), `duplicate job ${match[1]}`);
    const keys = [...match[2].matchAll(/^ {4}([a-z][a-z0-9_-]*):/gmu)].map((field) => field[1]);
    assert.equal(new Set(keys).size, keys.length, `duplicate job field ${match[1]}`);
    jobs.set(match[1], match[2]);
  }
  const expression = (value) => "${{ " + value + " }}";
  const steps = (job) => {
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
  };
  const step = (job, name) => {
    const found = steps(job).filter(({ fields }) => fields.get("name") === name);
    assert.equal(found.length, 1, `${job}: exactly one ${name}`);
    return found[0];
  };
  const exact = (job, name, command, condition) => {
    const { fields } = step(job, name);
    assert.equal(fields.get("run"), command, `${job}: ${name} executable command`);
    assert.equal(fields.get("if"), condition, `${job}: ${name} routing`);
  };
  const installed = expression("!cancelled() && steps.install.outcome == 'success'");
  const frontend = expression(
    "!cancelled() && steps.install.outcome == 'success' && needs.plan.outputs.frontend_static == 'true'",
  );
  assert.match(source, /^on:\n {2}pull_request:\n {4}branches: \[main\]$/mu);
  assert.match(source, /^ {2}push:\n {4}branches: \[main\]$/mu);
  assert.match(source, /^permissions:\n {2}contents: read$/mu);
  assert.match(
    source,
    // A PR's newer push cancels its older run; main pushes share one queue whose running check is never
    // cancelled (a newer merge only replaces a waiting one); scheduled and manual runs stay separate.
    /^concurrency:\n {2}group: ward-flow-\$\{\{ github.event_name == 'pull_request' && format\('pr-\{0\}', github.event.pull_request.number\) \|\| github.event_name == 'push' && 'main' \|\| format\('\{0\}-\{1\}', github.event_name, github.run_id\) \}\}\n {2}cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}$/mu,
  );
  assert.doesNotMatch(source, /^\s*(?:shell|defaults):/mu);
  for (const pattern of [
    /pull_request_target:/u,
    /continue-on-error:/u,
    /secrets\./u,
    /contents: write/u,
    /(?:pull-requests|actions): write/u,
    /WARD_PUBLIC_STANDALONE:/u,
    /actions\/cache@/u,
    /node-version: /u,
  ])
    assert.doesNotMatch(source, pattern);
  for (const match of source.matchAll(/^\s*(?:- )?uses: ([^\n]+)/gmu))
    assert.match(match[1], /^[\w./-]+@[0-9a-f]{40}$/u);
  for (const match of source.matchAll(/persist-credentials: ([^\n]+)/gu)) assert.equal(match[1], "false");
  assert.equal([...source.matchAll(/run: node scripts\/ward-ci-public\/plan\.mjs/g)].length, 1);
  exact("plan", "Plan Ward scope", "node scripts/ward-ci-public/plan.mjs");
  assert.equal(step("plan", "Plan Ward scope").fields.get("id"), "plan");
  exact("plan", "Verify the scope plan against the diff", "node scripts/ward-ci-public/verify-plan.mjs");
  for (const output of [
    "full",
    "unit",
    "browser",
    "policy",
    "backend",
    "build",
    "frontend_static",
    "dependency_review",
    "owner_index",
    "rules_index",
    "organisation",
    "doc_contracts",
  ]) {
    assert.ok(jobs.get("plan").includes(`      ${output}: ${expression(`steps.plan.outputs.${output}`)}\n`));
    assert.ok(
      step("plan", "Verify the scope plan against the diff").text.includes(
        `          WARD_PLAN_${output.toUpperCase()}: ${expression(`steps.plan.outputs.${output}`)}\n`,
      ),
    );
  }
  assert.match(jobs.get("static"), /^ {4}needs: plan$/mu);
  assert.match(jobs.get("static"), /^ {4}if: \$\{\{ !cancelled\(\) && needs.plan.result == 'success' \}\}$/mu);
  for (const [job, scope, reusable] of [
    ["unit", "unit", true],
    ["browser-build", "browser", true],
    ["browser", "browser", true],
    ["build", "build", true],
    ["coverage", "unit", true],
    ["backend", "backend", false],
    ["release-gate", "browser", false],
  ]) {
    const route = expression(
      `!cancelled() && needs.plan.outputs.${scope} == 'true'${reusable ? " && needs.reuse.outputs.verified != 'true'" : ""}${job === "browser" ? " && needs.browser-build.result == 'success'" : ""}`,
    );
    assert.ok(jobs.get(job)?.includes(`    if: ${route}\n`), `${job} job scope`);
    assert.match(jobs.get(job), /^ {4}needs: (?:plan|\[[^\n]*\bplan\b[^\n]*\])$/mu);
    exact(job, "Install locked dependencies", "node scripts/install-locked-dependencies.mjs");
    assert.equal(step(job, "Install locked dependencies").fields.get("id"), "install");
  }
  assert.equal(step("static", "Install locked dependencies").fields.get("id"), "install");
  exact(
    "static",
    "Install locked dependencies",
    "node scripts/install-locked-dependencies.mjs",
    expression("!cancelled() && needs.plan.outputs.full == 'true'"),
  );
  for (const [name, command, condition] of [
    ["Check CI contracts", "node scripts/ward-ci-public/check-contracts.mjs"],
    [
      "Check synthetic fixture identifiers and disclaimer source",
      "node scripts/ward-flow/check-clinical-governance-gate.mjs",
    ],
    ["Check document links and anchors", "npm run docs:check-links"],
    ["Check reference-pack integrity", "node scripts/ward-flow/maintain-docs-and-organisation.mjs --pack-only --check"],
    ["Check maintained document commands", "npm run docs:check-scripts"],
    ["Check doc facts and retired terms", "node scripts/doc-facts.mjs"],
    ["Check changed files", "node scripts/ward-ci-public/changed-checks.mjs", installed],
    [
      "Run the tests related to this PR's changes",
      'node scripts/ward-flow/related-tests.mjs --base "$WARD_BASE_SHA" --head HEAD --root .',
      expression(
        "!cancelled() && steps.install.outcome == 'success' && github.event_name == 'pull_request' && needs.plan.outputs.unit == 'true'",
      ),
    ],
    [
      "Lint the whole tree",
      "node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src tests scripts backend playwright eslint.config.mjs next.config.ts playwright.config.ts vitest.config.mts --max-warnings 0 --no-error-on-unmatched-pattern",
      frontend,
    ],
    ["Check for new unused code", "npm run check:knip", frontend],
    ["Check Ward reference data", "npm run check:ward-reference", frontend],
    ["Check Ward legal wording", "npm run check:ward-legal-language", frontend],
    [
      "Check maintained policy contracts",
      "node scripts/ward-ci-public/check-policy-contracts.mjs",
      expression("!cancelled() && needs.plan.outputs.policy == 'true' && steps.install.outcome == 'success'"),
    ],
  ])
    exact("static", name, command, condition);
  // Generated documentation contracts run only when the PR touches their inputs (see plan.mjs docContractInput).
  const docContracts = expression("needs.plan.outputs.doc_contracts == 'true'");
  for (const [name, command] of [
    ["Check Ward screen map", "node scripts/ward-flow/screen-map.mjs --check"],
    ["Check drawing manifest", "node scripts/ward-flow/mockup-manifest.mjs --check"],
    ["Check screen verification index", "node scripts/ward-flow/screen-verification.mjs --check"],
    ["Check scripts inventory", "npm run docs:check-inventory"],
    ["Check architecture index coverage", "npm run docs:check-index"],
  ])
    exact("static", name, command, docContracts);
  exact(
    "static",
    "Check generated site map",
    "npm run sitemap:check",
    expression("!cancelled() && steps.install.outcome == 'success' && needs.plan.outputs.doc_contracts == 'true'"),
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
    exact("static", name, command, expression(`needs.plan.outputs.${output} == 'true'`));
  const review = step("static", "Review dependency changes");
  assert.match(review.fields.get("uses") ?? "", /^actions\/dependency-review-action@[0-9a-f]{40}$/u);
  assert.equal(review.fields.get("run"), undefined);
  assert.equal(
    review.fields.get("if"),
    expression("github.event_name == 'pull_request' && needs.plan.outputs.dependency_review == 'true'"),
  );
  const typecheck = step("static", "Typecheck source and route types");
  assert.equal(typecheck.fields.get("if"), frontend);
  assert.equal(
    typecheck.text.split("        run: |\n")[1]?.trim(),
    "node node_modules/next/dist/bin/next typegen\n          node --max-old-space-size=8192 node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false",
  );
  exact(
    "backend",
    "Install locked Ward backend dependencies",
    "node scripts/install-locked-dependencies.mjs --root backend/ward-flow",
    installed,
  );
  exact(
    "backend",
    "Run Ward backend tests",
    "npm run build:engine && npm run typecheck && npm run test:coverage",
    expression("!cancelled() && steps.backend-install.outcome == 'success'"),
  );
  assert.equal(step("backend", "Run Ward backend tests").fields.get("working-directory"), "backend/ward-flow");
  assert.match(jobs.get("backend"), /image: postgres:16@sha256:[0-9a-f]{64}\n/u);
  assert.match(
    step("backend", "Run Ward backend tests").text,
    /WARD_TEST_DATABASE_URL: postgresql:\/\/postgres@127.0.0.1:5432\/wardflow_test\n/u,
  );
  exact(
    "backend",
    "Run the shared-mode browser journey",
    "node tests/support/ward-shared-mode-run.mjs",
    expression("!cancelled() && steps.shared-chromium.outcome == 'success'"),
  );
  exact("unit", "Run reconciled unit suite shard", "npm run check:ward-expected-reds -- --print-signatures", installed);
  exact("browser-build", "Prepare the isolated browser build", "npm run test:e2e:ward-journeys");
  assert.match(jobs.get("browser-build"), /WARD_BROWSER_PREPARE_DIR: \$\{\{ runner.temp \}\}\/ward-browser-build/u);
  const prepared = step("browser-build", "Upload the verified browser build");
  assert.equal(prepared.fields.get("uses"), "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9");
  assert.match(prepared.text, /if-no-files-found: error/u);
  for (const job of ["browser", "release-gate"]) {
    assert.match(jobs.get(job), /needs: \[[^\n]*browser-build[^\n]*\]/u);
    const download = step(job, "Download the verified browser build");
    assert.equal(download.fields.get("uses"), "actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333");
    assert.match(jobs.get(job), /WARD_BROWSER_ARTIFACT_DIR:/u);
  }
  exact(
    "browser",
    "Run Ward browser journeys",
    "npm run test:e2e:ward-journeys",
    expression("!cancelled() && steps.chromium.outcome == 'success'"),
  );
  exact("browser", "Install Chromium", "node scripts/ward-ci-public/install-chromium.mjs", installed);
  assert.equal(step("browser", "Install Chromium").fields.get("timeout-minutes"), "8");
  assert.equal(step("browser", "Install Chromium").fields.get("id"), "chromium");
  exact(
    "release-gate",
    "Install Chromium and WebKit",
    "node scripts/ward-ci-public/install-chromium.mjs chromium webkit",
    installed,
  );
  assert.equal(step("release-gate", "Install Chromium and WebKit").fields.get("id"), "browsers");
  exact(
    "release-gate",
    "Run the release-gate journeys",
    "npm run test:e2e:release-gate",
    expression("!cancelled() && steps.browsers.outcome == 'success'"),
  );
  // Desktop and phone run as parallel legs: together exactly both device projects, neither dropped
  // by fail-fast, and each leg's runner narrowed only through WARD_RELEASE_GATE_PROJECT.
  assert.match(
    jobs.get("release-gate"),
    /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}project: \[release-gate-desktop, release-gate-phone\]\n/mu,
  );
  assert.ok(
    step("release-gate", "Run the release-gate journeys").text.includes(
      `          WARD_RELEASE_GATE_PROJECT: ${expression("matrix.project")}\n`,
    ),
  );
  assert.ok(
    jobs
      .get("release-gate")
      .includes(`ward-release-gate-failures-${expression("github.run_id")}-${expression("matrix.project")}`),
  );
  exact(
    "build",
    "Build for production (Railway build command)",
    "node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack",
    installed,
  );
  exact("build", "Check the phone script budget", "node scripts/check-script-budget.mjs", installed);
  exact(
    "build",
    "Scan the built client bundle for secrets",
    "npm run check:client-bundle-secrets -- --require-bundle",
    installed,
  );
  exact(
    "build",
    "Merge the latest main before measuring",
    "node scripts/ward-ci-public/merge-latest-main.mjs",
    expression("github.event_name == 'pull_request'"),
  );
  {
    const build = jobs.get("build");
    const merge = build.indexOf("name: Merge the latest main before measuring");
    assert.ok(
      merge >= 0 && merge < build.indexOf("name: Check the phone script budget"),
      "build: main is merged before the phone script budget is measured",
    );
  }
  assert.doesNotMatch(jobs.get("build"), /WARD_GATE_BUILD/u);
  exact("coverage", "Check complete executable coverage inventory", "npm run check:coverage-inventory", installed);
  assert.doesNotMatch(jobs.get("coverage"), /WARD_COVERAGE_BLOB_DIR/u);
  exact("coverage", "Merge shard coverage and enforce thresholds", "|", installed);
  assert.equal(
    step("coverage", "Merge shard coverage and enforce thresholds").text.split("        run: |\n")[1]?.trim(),
    'for shard in $(seq 1 "$WARD_SHARD_COUNT"); do\n            ls "$WARD_SHARD_BLOBS"/blob-shard-"$shard"-of-"$WARD_SHARD_COUNT"-batch-*.json\n          done\n          node node_modules/vitest/vitest.mjs run --merge-reports="$WARD_SHARD_BLOBS" --coverage',
  );
  assert.match(
    jobs.get("coverage"),
    /node node_modules\/vitest\/vitest.mjs run --merge-reports="\$WARD_SHARD_BLOBS" --coverage\n/u,
  );
  assert.match(jobs.get("coverage"), /WARD_SHARD_COUNT: "8"/u);
  assert.match(jobs.get("unit"), /WARD_COVERAGE_BLOB_DIR: \$\{\{ runner.temp \}\}\/ward-coverage-blobs/u);
  assert.match(jobs.get("unit"), /if-no-files-found: error/u);
  for (const [job, key, variable, count] of [
    ["unit", "shard", "WARD_GATE_SHARD", 8],
    ["browser", "group", "WARD_JOURNEY_GROUP", 3],
  ]) {
    assert.match(jobs.get(job), /fail-fast: false/u);
    const values = new RegExp(`${key}: \\[([\\d, ]+)\\]`).exec(jobs.get(job))?.[1].split(",").map(Number);
    assert.deepEqual(
      values,
      Array.from({ length: count }, (_, i) => i + 1),
    );
    assert.ok(jobs.get(job).includes(`${variable}: ${expression(`matrix.${key}`)}/${count}`));
  }
  for (const name of ["static", "secret-scan", "backend", "release-gate"])
    assert.doesNotMatch(jobs.get(name), /needs.reuse/u);
  assert.match(
    jobs.get("reuse"),
    /^ {4}if: \$\{\{ github.event_name == 'push' && github.ref == 'refs\/heads\/main' \}\}$/mu,
  );
  exact(
    "reuse",
    "Check for an identical tree already verified on its pull request",
    "node scripts/ward-ci-public/main-reuse.mjs",
  );
  assert.match(jobs.get("secret-scan"), /GITLEAKS_SHA256: [0-9a-f]{64}\n/u);
  assert.match(jobs.get("secret-scan"), /echo "\$\{GITLEAKS_SHA256\}  \$\{archive\}" \| sha256sum -c -/u);
  const scan = step("secret-scan", "Scan git history for secrets");
  assert.equal(scan.fields.get("if"), undefined);
  assert.equal(
    scan.text.split("        run: |\n")[1]?.trim(),
    '"$RUNNER_TEMP/gitleaks" git . --redact --no-banner --exit-code 1 --gitleaks-ignore-path .gitleaksignore --log-opts="--full-history HEAD"',
  );
  assert.match(jobs.get("required"), /^ {4}name: Ward Flow required$/mu);
  assert.match(jobs.get("required"), /^ {4}if: always\(\)$/mu);
  assert.match(
    jobs.get("required"),
    /^ {4}needs: \[plan, reuse, static, backend, unit, browser-build, browser, release-gate, secret-scan, build, coverage\]$/mu,
  );
  assert.match(
    step("static", "Check doc facts and retired terms").text,
    /^ {10}WARD_BASE_SHA: \$\{\{ github.event.pull_request.base.sha \|\| github.event.merge_group.base_sha \}\}$/mu,
  );
  for (const [job, body] of jobs) {
    for (const entry of steps(job)) {
      if (entry.fields.get("uses")?.startsWith("actions/checkout@"))
        assert.match(entry.text, /^ {10}persist-credentials: false$/mu);
      if (entry.fields.get("uses")?.startsWith("actions/cache/save@")) {
        assert.ok(
          entry.fields.get("if")?.includes("github.ref == 'refs/heads/main'"),
          `${job}: cache saves require main`,
        );
        assert.ok(entry.fields.get("if")?.includes("!cancelled()"), `${job}: cache saves reject cancellation`);
      }
    }
    if (body.includes("actions/setup-node@")) {
      assert.match(body, /node-version-file: \.nvmrc/u);
      exact(job, "Record the Node and npm toolchain", "node --version && npm --version");
    }
  }
  for (const job of ["browser", "release-gate"]) {
    const name = job === "browser" ? "Run Ward browser journeys" : "Run the release-gate journeys";
    assert.ok(
      step(job, name).text.includes(
        `          WARD_BROWSER_ARTIFACT_DIR: ${expression("needs.browser-build.result == 'success' && format('{0}/ward-browser-build', runner.temp) || ''")}\n`,
      ),
    );
    assert.ok(
      step(job, "Download the verified browser build").text.includes(
        "          path: " + expression("runner.temp") + "/ward-browser-build\n",
      ),
    );
    assert.equal(
      step(job, "Download the verified browser build").fields.get("if"),
      expression("!cancelled() && needs.browser-build.result == 'success' && steps.install.outcome == 'success'"),
    );
  }
  const verdict = step("required", "Require every Ward Flow job to succeed");
  assert.equal(verdict.fields.get("if"), undefined);
  for (const [key, value] of Object.entries({
    REUSE_VERIFIED: "needs.reuse.outputs.verified",
    PLAN_RESULT: "needs.plan.result",
    REUSE_RESULT: "needs.reuse.result",
    STATIC_RESULT: "needs.static.result",
    BACKEND_RESULT: "needs.backend.result",
    UNIT_RESULT: "needs.unit.result",
    BROWSER_RESULT: "needs.browser.result",
    BROWSER_BUILD_RESULT: "needs.browser-build.result",
    SECRET_SCAN_RESULT: "needs.secret-scan.result",
    BUILD_RESULT: "needs.build.result",
    COVERAGE_RESULT: "needs.coverage.result",
    RELEASE_GATE_RESULT: "needs.release-gate.result",
    BACKEND_SCOPE: "needs.plan.outputs.backend",
    UNIT_SCOPE: "needs.plan.outputs.unit",
    BROWSER_SCOPE: "needs.plan.outputs.browser",
    BUILD_SCOPE: "needs.plan.outputs.build",
  })) {
    assert.deepEqual(
      verdict.text.split("\n").filter((line) => line.startsWith(`          ${key}:`)),
      [`          ${key}: ${expression(value)}`],
    );
  }
  assert.equal(
    verdict.text.split("        run: |\n")[1]?.trim(),
    `set -euo pipefail
          require_scope() {
            if [ "$1" = true ]; then test "$2" = success;
            elif [ "$1" = false ]; then test "$2" = skipped;
            else return 1; fi
          }
          test "$PLAN_RESULT" = success
          test "$STATIC_RESULT" = success
          test "$SECRET_SCAN_RESULT" = success
          require_scope "$BACKEND_SCOPE" "$BACKEND_RESULT"
          require_scope "$BROWSER_SCOPE" "$RELEASE_GATE_RESULT"
          if [ "$REUSE_VERIFIED" = true ]; then
            test "$GITHUB_EVENT_NAME" = push
            test "$GITHUB_REF" = refs/heads/main
            test "$REUSE_RESULT" = success
            test "$UNIT_RESULT" = skipped
            test "$BROWSER_BUILD_RESULT" = skipped
            test "$BROWSER_RESULT" = skipped
            test "$BUILD_RESULT" = skipped
            test "$COVERAGE_RESULT" = skipped
          else
            require_scope "$UNIT_SCOPE" "$UNIT_RESULT"
            require_scope "$UNIT_SCOPE" "$COVERAGE_RESULT"
            require_scope "$BROWSER_SCOPE" "$BROWSER_BUILD_RESULT"
            require_scope "$BROWSER_SCOPE" "$BROWSER_RESULT"
            require_scope "$BUILD_SCOPE" "$BUILD_RESULT"
          fi`,
  );
}
requireWorkflow(workflow);
// Exercise the actual aggregate shell across every scope combination and every
// failure/cancellation/missing-result branch, including the trusted reuse route.
const verdictShell = /^ {8}run: \|\n([\s\S]*)$/mu.exec(workflow.slice(workflow.indexOf("  required:\n")))?.[1];
assert.ok(verdictShell);
// On Windows a bare "bash" can resolve to WSL's System32\bash.exe, which does not run this shell
// against the given environment. Prefer Git Bash there; Linux and macOS keep the bash on PATH.
function resolveBash() {
  if (process.platform !== "win32") return "bash";
  const env = process.env;
  const candidates = [
    env.ProgramFiles && path.win32.join(env.ProgramFiles, "Git", "bin", "bash.exe"),
    env["ProgramFiles(x86)"] && path.win32.join(env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ];
  const gitExecPath = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
  // <git>/mingw64/libexec/git-core -> <git>/bin/bash.exe
  if (gitExecPath.status === 0 && gitExecPath.stdout.trim())
    candidates.push(path.win32.resolve(gitExecPath.stdout.trim(), "..", "..", "..", "bin", "bash.exe"));
  const system32 = path.win32.join(env.SystemRoot || "C:\\Windows", "System32").toLowerCase();
  const found = candidates.find(
    (candidate) =>
      candidate && existsSync(candidate) && !path.win32.resolve(candidate).toLowerCase().startsWith(system32),
  );
  if (found) return found;
  throw new Error(
    "check-contracts needs Git Bash on Windows (%ProgramFiles%\\Git\\bin\\bash.exe); it refuses the WSL System32\\bash.exe.",
  );
}
const bash = resolveBash();
const baseEnv = {
  PATH: process.env.PATH ?? "",
  ...(process.platform === "win32" && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
};
const runVerdict = (env) =>
  spawnSync(bash, ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", verdictShell], {
    env: { ...baseEnv, ...env },
  }).status;
let verdictCases = 0;
for (let bits = 0; bits < 16; bits++)
  for (const reuse of [false, true]) {
    const enabled = (bit) => Boolean(bits & (1 << bit));
    const values = {
      PLAN_RESULT: "success",
      STATIC_RESULT: "success",
      SECRET_SCAN_RESULT: "success",
      REUSE_RESULT: reuse ? "success" : "skipped",
      REUSE_VERIFIED: String(reuse),
      GITHUB_EVENT_NAME: reuse ? "push" : "pull_request",
      GITHUB_REF: reuse ? "refs/heads/main" : "refs/pull/1/merge",
      BACKEND_SCOPE: String(enabled(0)),
      UNIT_SCOPE: String(enabled(1)),
      BROWSER_SCOPE: String(enabled(2)),
      BUILD_SCOPE: String(enabled(3)),
      BACKEND_RESULT: enabled(0) ? "success" : "skipped",
      UNIT_RESULT: !reuse && enabled(1) ? "success" : "skipped",
      COVERAGE_RESULT: !reuse && enabled(1) ? "success" : "skipped",
      BROWSER_RESULT: !reuse && enabled(2) ? "success" : "skipped",
      BROWSER_BUILD_RESULT: !reuse && enabled(2) ? "success" : "skipped",
      BUILD_RESULT: !reuse && enabled(3) ? "success" : "skipped",
      RELEASE_GATE_RESULT: enabled(2) ? "success" : "skipped",
    };
    assert.equal(runVerdict(values), 0);
    verdictCases++;
    for (const key of [
      "PLAN_RESULT",
      "STATIC_RESULT",
      "SECRET_SCAN_RESULT",
      "BACKEND_RESULT",
      "UNIT_RESULT",
      "COVERAGE_RESULT",
      "BROWSER_RESULT",
      "BROWSER_BUILD_RESULT",
      "BUILD_RESULT",
      "RELEASE_GATE_RESULT",
      ...(reuse ? ["REUSE_RESULT"] : []),
    ])
      for (const result of ["failure", "cancelled", "", values[key] === "success" ? "skipped" : "success"]) {
        assert.notEqual(runVerdict({ ...values, [key]: result }), 0, `${key}=${result} must block`);
        verdictCases++;
      }
    for (const key of ["BACKEND_SCOPE", "UNIT_SCOPE", "BROWSER_SCOPE", "BUILD_SCOPE"]) {
      // Scope values bypassed by reuse are checked by the independent planner.
      if (reuse && key !== "BACKEND_SCOPE" && key !== "BROWSER_SCOPE") continue;
      assert.notEqual(runVerdict({ ...values, [key]: "" }), 0);
      verdictCases++;
    }
    if (reuse)
      for (const [key, value] of [
        ["GITHUB_EVENT_NAME", "pull_request"],
        ["GITHUB_REF", "refs/heads/other"],
      ]) {
        assert.notEqual(runVerdict({ ...values, [key]: value }), 0);
        verdictCases++;
      }
  }
// Every enforcing run command is an exact contract; mutation probes must change
// the input before rejection, preventing obsolete no-op controls from passing.
for (const [before, after] of [
  ["run: node scripts/ward-ci-public/plan.mjs", "run: echo omitted"],
  ["run: node scripts/ward-ci-public/verify-plan.mjs", "run: echo omitted"],
  ["run: node scripts/check-script-budget.mjs", "run: echo omitted"],
  ["run: node scripts/ward-ci-public/merge-latest-main.mjs", "run: echo omitted"],
  [
    "if: ${{ github.event_name == 'pull_request' }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs",
    "if: ${{ false }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs",
  ],
  ["run: node tests/support/ward-shared-mode-run.mjs", "run: echo omitted"],
  ["run: npm run check:coverage-inventory", "run: echo omitted"],
  ["run: npm run test:e2e:release-gate", "run: echo omitted"],
  ["        id: plan\n", "        id: unused-plan\n"],
  ["        id: install\n", "        id: unused-install\n"],
  ["        id: browsers\n", "        id: unused-browsers\n"],
  ['test "$STATIC_RESULT" = success', "true"],
  ["          UNIT_RESULT: ${{ needs.unit.result }}", "          UNIT_RESULT: success"],
  ["contents: read", "contents: write"],
  [
    "        run: |\n          set -euo pipefail",
    "        shell: bash {0}\n        run: |\n          set -euo pipefail",
  ],
  ["uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294", "run: echo skipped"],
  ["if: always()", "if: success()"],
  ["shard: [1, 2, 3, 4, 5, 6, 7, 8]", "shard: [1, 2, 3, 4, 5, 6, 7]"],
  ["group: [1, 2, 3]", "group: [1, 2]"],
  ["| sha256sum -c -", "| cat"],
  ["--gitleaks-ignore-path .gitleaksignore", ""],
  ["branches: [main]", "branches: [other]"],
  ["--max-warnings 0 --no-error-on-unmatched-pattern", "--max-warnings 0 --no-error-on-unmatched-pattern || true"],
]) {
  const changed = workflow.replace(before, after);
  assert.notEqual(changed, workflow, before);
  assert.throws(() => requireWorkflow(changed), before);
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
  unit: true,
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
console.log(
  `Ward public CI contracts OK — executable mutations rejected; ${verdictCases} aggregate verdict cases passed`,
);
