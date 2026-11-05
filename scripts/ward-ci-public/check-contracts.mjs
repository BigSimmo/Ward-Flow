import { resolveBash } from "./bash.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
  // Marking a draft ready must start the full run (draft fast lane).
  assert.match(
    source,
    /^ {2}pull_request:\n {4}branches: \[main\]\n {4}types: \[opened, synchronize, reopened, ready_for_review\]$/mu,
  );
  assert.match(source, /^permissions:\n {2}contents: read$/mu);
  assert.match(
    source,
    // Each PR and main have one queue. A newer PR push cancels that PR's older run; main runs always
    // finish (a newer main push only replaces a waiting one); scheduled and manual runs stay separate.
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
  // Cheap first (Josh, 4 Nov 2026): the expensive jobs wait for static checks and the production
  // build; a build skipped by scope (not by failure) still lets them run.
  const cheapFirst = new Set(["unit", "browser", "release-gate"]);
  const cheapGate =
    " && needs.static.result == 'success' && (needs.build.result == 'success' || (needs.build.result == 'skipped' && (needs.plan.outputs.build != 'true' || needs.reuse.outputs.build_verified == 'true')))";
  for (const job of cheapFirst)
    assert.match(jobs.get(job), /^ {4}needs: \[[^\n]*\bstatic, build\]$/mu, `${job}: waits for cheap checks`);
  for (const [job, scope, reuseGate] of [
    ["unit", "unit", "unit"],
    ["browser-build", "browser", null],
    ["browser", "browser", "browser"],
    ["build", "build", "build"],
    ["coverage", "unit", "coverage"],
    ["backend", "backend", "backend"],
    ["release-gate", "browser", "release"],
  ]) {
    const reuseGuard =
      job === "browser-build"
        ? " && (needs.reuse.outputs.browser_verified != 'true' || needs.reuse.outputs.release_verified != 'true')"
        : ` && needs.reuse.outputs.${reuseGate}_verified != 'true'`;
    const route = expression(
      `!cancelled() && needs.plan.result == 'success' && needs.plan.outputs.${scope} == 'true'${reuseGuard}${scope === "browser" ? " && github.event.pull_request.draft != true" : ""}${job === "browser" || job === "release-gate" ? " && needs.browser-build.result == 'success'" : ""}${job === "coverage" ? " && needs.unit.result == 'success'" : ""}${cheapFirst.has(job) ? cheapGate : ""}`,
    );
    assert.ok(jobs.get(job)?.includes(`    if: ${route}\n`), `${job} job scope`);
    assert.match(jobs.get(job), /^ {4}needs: (?:plan|\[[^\n]*\bplan\b[^\n]*\])$/mu);
    exact(job, "Install locked dependencies", "node scripts/install-locked-dependencies.mjs");
    assert.equal(step(job, "Install locked dependencies").fields.get("id"), "install");
  }
  assert.equal(step("static", "Install locked dependencies").fields.get("id"), "install");
  // Installed packages come from a cache saved on main only, straight after an attested install; the
  // installer reuses an exact hit only when its own post-install stamp still matches (see
  // install-locked-dependencies.mjs). Every install restores the same exact key with no fallback.
  for (const [job] of jobs) {
    if (!steps(job).some(({ fields }) => fields.get("name") === "Install locked dependencies")) continue;
    const names = steps(job).map(({ fields }) => fields.get("name"));
    const restore = step(job, "Restore installed packages");
    assert.ok(
      names.indexOf("Restore installed packages") === names.indexOf("Install locked dependencies") - 1,
      `${job}: restore installed packages immediately before installing`,
    );
    assert.equal(restore.fields.get("uses"), "actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
    assert.equal(restore.fields.get("id"), "node-modules");
    assert.match(
      restore.text,
      /^ {10}key: ward-node-modules-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('\.nvmrc', 'package\.json', 'package-lock\.json'\) \}\}$/mu,
    );
    assert.doesNotMatch(restore.text, /restore-keys/u, `${job}: installed packages restore an exact key only`);
    assert.ok(
      step(job, "Install locked dependencies").text.includes(
        `          WARD_INSTALL_RESTORED: ${expression("steps.node-modules.outputs.cache-hit")}\n`,
      ),
    );
  }
  assert.deepEqual(
    [...jobs.keys()].filter((job) =>
      steps(job).some(({ fields }) => fields.get("name") === "Save installed packages on main"),
    ),
    ["build"],
  );
  {
    const names = steps("build").map(({ fields }) => fields.get("name"));
    assert.equal(
      names.indexOf("Save installed packages on main"),
      names.indexOf("Install locked dependencies") + 1,
      "build: installed packages are saved straight after the attested install",
    );
  }
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
      "Lint the whole tree",
      'node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src tests scripts backend playwright eslint.config.mjs next.config.ts playwright.config.ts vitest.config.mts --max-warnings 0 --no-error-on-unmatched-pattern --cache --cache-strategy content --cache-location "$RUNNER_TEMP/ward-eslint-cache/.eslintcache"',
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
  // The unit suite runs every file on every PR in the shards; a second, related-only run is not repeated.
  assert.doesNotMatch(jobs.get("static"), /related-tests\.mjs/u);
  // Lint and Vitest module caches only ever save from main, and lint keys include its config and rules.
  for (const [job, name] of [
    ["static", "Save the lint cache on main"],
    ["unit", "Save the Vitest module cache on main"],
  ]) {
    const save = step(job, name);
    assert.equal(save.fields.get("uses"), "actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9");
    assert.match(
      save.fields.get("if") ?? "",
      /github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/u,
    );
  }
  assert.match(
    step("static", "Restore the lint cache").text,
    /key: ward-eslint-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('package-lock\.json', 'eslint\.config\.mjs', 'eslint-rules\/\*\*'\) \}\}-/u,
  );
  assert.match(
    step("unit", "Restore the Vitest module cache").text,
    /lookup-only: \$\{\{ github\.ref == 'refs\/heads\/main'/u,
  );
  // Only the plan's explicit "false" leaves the legal-figure sweep out, and the plan writes "false"
  // only for a pull request diff that reaches none of it; main reuse needs the confirm step's evidence.
  assert.match(
    step("unit", "Run reconciled unit suite shard").text,
    /WARD_GATE_SKIP_LEGAL_SWEEP: \$\{\{ needs\.plan\.outputs\.legal_sweep == 'false' && '1' \|\| '0' \}\}\n/u,
  );
  assert.equal(
    step("unit", "Confirm the legal-figure sweep ran").fields.get("if"),
    "${{ !cancelled() && steps.shard.outcome == 'success' && needs.plan.outputs.legal_sweep != 'false' }}",
  );
  assert.match(jobs.get("plan"), /WARD_PLAN_LEGAL_SWEEP: \$\{\{ steps\.plan\.outputs\.legal_sweep \}\}\n/u);
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
    "Install the release device browser",
    "node scripts/ward-ci-public/install-chromium.mjs ${{ matrix.browser }}",
    installed,
  );
  assert.equal(step("release-gate", "Install the release device browser").fields.get("id"), "browsers");
  exact(
    "release-gate",
    "Run the release-gate journeys",
    "npm run test:e2e:release-gate",
    expression("!cancelled() && steps.browsers.outcome == 'success'"),
  );
  exact(
    "release-gate",
    "Run the second release-gate suite",
    "npm run test:e2e:release-gate",
    expression("!cancelled() && steps.browsers.outcome == 'success'"),
  );
  exact(
    "release-gate",
    "Run the third release-gate suite",
    "npm run test:e2e:release-gate",
    expression("!cancelled() && steps.browsers.outcome == 'success'"),
  );
  // Desktop and phone each split the gate into three parts (which partition the release-gate files),
  // run as two jobs of three suites: together exactly both device projects times all three parts,
  // each suite once, none dropped by fail-fast, and each suite's runner narrowed only through
  // WARD_RELEASE_GATE_PROJECT and WARD_RELEASE_GATE_PART.
  const gateMatrix = jobs
    .get("release-gate")
    .match(
      /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}include:\n((?: {10}- [^\n]*\n(?: {12}[^\n]*\n)*)+) {4}steps:\n/mu,
    );
  assert.ok(gateMatrix, "release-gate: fail-fast false include matrix");
  const gateEntries = gateMatrix[1]
    .split(/^ {10}- /mu)
    .slice(1)
    .map((entry) => {
      const fields = Object.fromEntries(
        [...`  ${entry}`.matchAll(/^ {2,12}([a-z_]+): ([^\n]*)$/gmu)].map((match) => [match[1], match[2]]),
      );
      assert.deepEqual(Object.keys(fields).sort(), [
        "browser",
        "pair",
        "part",
        "project",
        "second_part",
        "second_project",
        "third_part",
        "third_project",
      ]);
      assert.equal(fields.browser, fields.project === "release-gate-phone" ? "webkit" : "chromium");
      return fields;
    });
  assert.equal(gateEntries.length, 2, "release-gate: two jobs of three suites");
  assert.equal(new Set(gateEntries.map(({ pair }) => pair)).size, 2, "release-gate: distinct job names");
  const gateSuites = gateEntries
    .flatMap(({ project, part, second_project, second_part, third_project, third_part }) => [
      `${project}/${part}`,
      `${second_project}/${second_part}`,
      `${third_project}/${third_part}`,
    ])
    .sort();
  assert.deepEqual(
    gateSuites,
    ["release-gate-desktop", "release-gate-phone"]
      .flatMap((project) => ["journeys", "referrals", "checks"].map((part) => `${project}/${part}`))
      .sort(),
    "release-gate: every device project and part exactly once",
  );
  assert.match(jobs.get("release-gate"), /^ {4}name: Ward Flow release gate \$\{\{ matrix\.pair \}\}$/mu);
  assert.ok(
    step("release-gate", "Run the release-gate journeys").text.includes(
      `          WARD_RELEASE_GATE_PROJECT: ${expression("matrix.project")}\n          WARD_RELEASE_GATE_PART: ${expression("matrix.part")}\n`,
    ),
  );
  assert.ok(
    step("release-gate", "Run the second release-gate suite").text.includes(
      `          WARD_RELEASE_GATE_PROJECT: ${expression("matrix.second_project")}\n          WARD_RELEASE_GATE_PART: ${expression("matrix.second_part")}\n`,
    ),
  );
  assert.equal(step("release-gate", "Run the second release-gate suite").fields.get("id"), "gate-second");
  assert.ok(
    step("release-gate", "Run the third release-gate suite").text.includes(
      `          WARD_RELEASE_GATE_PROJECT: ${expression("matrix.third_project")}\n          WARD_RELEASE_GATE_PART: ${expression("matrix.third_part")}\n`,
    ),
  );
  assert.equal(step("release-gate", "Run the third release-gate suite").fields.get("id"), "gate-third");
  for (const [stepId, label] of [["gate-third", "third-suite"]]) {
    const reports = step("release-gate", `Upload successful ${label} reports`);
    assert.equal(reports.fields.get("if"), expression(`!cancelled() && steps.${stepId}.outcome == 'success'`));
    assert.match(reports.text, /^ {10}path: test-results\/\*\*\/\*\.json$/mu);
    assert.match(reports.text, /^ {10}if-no-files-found: error$/mu);
    assert.ok(
      reports.text.includes(
        `ward-release-gate-reports-${expression("github.run_id")}-${expression("matrix.third_project")}-${expression("matrix.third_part")}`,
      ),
    );
    const evidence = step("release-gate", `Upload failed ${label} evidence`);
    assert.equal(evidence.fields.get("if"), expression(`!cancelled() && steps.${stepId}.outcome == 'failure'`));
    assert.match(evidence.text, /^ {10}path: test-results\/$/mu);
  }
  assert.ok(
    jobs
      .get("release-gate")
      .includes(
        `ward-release-gate-failures-${expression("github.run_id")}-${expression("matrix.project")}-${expression("matrix.part")}`,
      ),
  );
  const secondReports = step("release-gate", "Upload successful second-suite reports");
  assert.equal(secondReports.fields.get("if"), expression("!cancelled() && steps.gate-second.outcome == 'success'"));
  assert.equal(secondReports.fields.get("uses"), "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9");
  assert.ok(
    secondReports.text.includes(
      `ward-release-gate-reports-${expression("github.run_id")}-${expression("matrix.second_project")}-${expression("matrix.second_part")}`,
    ),
  );
  assert.match(secondReports.text, /^ {10}path: test-results\/\*\*\/\*\.json$/mu);
  assert.match(secondReports.text, /^ {10}if-no-files-found: error$/mu);
  const secondEvidence = step("release-gate", "Upload failed second-suite evidence");
  assert.equal(secondEvidence.fields.get("if"), expression("!cancelled() && steps.gate-second.outcome == 'failure'"));
  assert.match(secondEvidence.text, /^ {10}path: test-results\/$/mu);
  assert.ok(
    secondEvidence.text.includes(
      `ward-release-gate-failures-${expression("github.run_id")}-${expression("matrix.second_project")}-${expression("matrix.second_part")}`,
    ),
  );
  {
    const names = steps("release-gate").map(({ fields }) => fields.get("name"));
    const aside = names.indexOf("Set aside the first suite's results");
    assert.ok(
      names.indexOf("Upload successful release-gate reports") < aside &&
        names.indexOf("Upload failed release-gate evidence") < aside &&
        aside < names.indexOf("Run the second release-gate suite"),
      "release-gate: upload the first suite before setting it aside and running the second",
    );
    const asideSecond = names.indexOf("Set aside the second suite's results");
    assert.ok(
      names.indexOf("Upload successful second-suite reports") < asideSecond &&
        names.indexOf("Upload failed second-suite evidence") < asideSecond &&
        asideSecond < names.indexOf("Run the third release-gate suite"),
      "release-gate: upload the second suite before setting it aside and running the third",
    );
  }
  const successfulReports = step("release-gate", "Upload successful release-gate reports");
  assert.equal(successfulReports.fields.get("if"), expression("!cancelled() && steps.gate.outcome == 'success'"));
  assert.equal(
    successfulReports.fields.get("uses"),
    "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
  );
  assert.ok(
    successfulReports.text.includes(
      `ward-release-gate-reports-${expression("github.run_id")}-${expression("matrix.project")}-${expression("matrix.part")}`,
    ),
  );
  assert.match(successfulReports.text, /^ {10}path: test-results\/\*\*\/\*\.json$/mu);
  assert.match(successfulReports.text, /^ {10}if-no-files-found: error$/mu);
  assert.match(successfulReports.text, /^ {10}retention-days: 3$/mu);
  const failedEvidence = step("release-gate", "Upload failed release-gate evidence");
  assert.equal(failedEvidence.fields.get("if"), expression("!cancelled() && steps.gate.outcome == 'failure'"));
  assert.match(failedEvidence.text, /^ {10}path: test-results\/$/mu);
  exact(
    "build",
    "Build for production (Railway build command)",
    "node --max-old-space-size=8192 node_modules/next/dist/bin/next build --webpack",
    installed,
  );
  exact("build", "Check the phone script budget", "node scripts/ward-ci-public/budget-gate.mjs", installed);
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
  assert.match(jobs.get("coverage"), /WARD_SHARD_COUNT: "4"/u);
  assert.match(jobs.get("unit"), /WARD_COVERAGE_BLOB_DIR: \$\{\{ runner.temp \}\}\/ward-coverage-blobs/u);
  assert.match(jobs.get("unit"), /if-no-files-found: error/u);
  for (const [job, key, variable, count] of [
    ["unit", "shard", "WARD_GATE_SHARD", 4],
    ["browser", "group", "WARD_JOURNEY_GROUP", 2],
  ]) {
    assert.match(jobs.get(job), /fail-fast: false/u);
    const values = new RegExp(`${key}: \\[([\\d, ]+)\\]`).exec(jobs.get(job))?.[1].split(",").map(Number);
    assert.deepEqual(
      values,
      Array.from({ length: count }, (_, i) => i + 1),
    );
    assert.ok(jobs.get(job).includes(`${variable}: ${expression(`matrix.${key}`)}/${count}`));
  }
  // Static checks always run. Every expensive gate consumes its own verified evidence.
  assert.doesNotMatch(jobs.get("static"), /needs.reuse/u);
  assert.ok(!jobs.has("secret-scan"), "the secret scan runs inside the scope plan job");
  assert.match(jobs.get("backend"), /^ {4}needs: \[plan, reuse\]$/mu);
  assert.match(jobs.get("release-gate"), /^ {4}needs: \[plan, reuse, browser-build, static, build\]$/mu);
  assert.match(
    jobs.get("reuse"),
    /^ {4}if: \$\{\{ github.event_name == 'push' && github.ref == 'refs\/heads\/main' \}\}$/mu,
  );
  exact(
    "reuse",
    "Check for an identical tree already verified on its pull request",
    "node scripts/ward-ci-public/main-reuse.mjs",
  );
  // The tree each pull request run tests, read back by main reuse (main-reuse.mjs TESTED_TREE_TITLE)
  // through the plan job's check run annotations, which needs checks: read and nothing more.
  exact(
    "plan",
    "Record the tested tree",
    `echo "::notice title=Ward tested tree::$(git rev-parse 'HEAD^{tree}')"`,
    expression("github.event_name == 'pull_request'"),
  );
  exact(
    "build",
    "Record the built tree",
    `echo "::notice title=Ward built tree::$(git rev-parse 'HEAD^{tree}')"`,
    expression("github.event_name == 'pull_request'"),
  );
  exact(
    "build",
    "Record the measured main",
    `echo "::notice title=Ward budget main::$(git rev-parse refs/remotes/origin/main)"`,
    expression("github.event_name == 'pull_request'"),
  );
  {
    const build = jobs.get("build");
    const merge = build.indexOf("name: Merge the latest main before measuring");
    const record = build.indexOf("name: Record the built tree");
    assert.ok(merge >= 0 && record > merge, "build: the built tree is recorded after main is merged");
  }
  assert.match(
    jobs.get("reuse"),
    /^ {4}permissions:\n {6}contents: read\n {6}pull-requests: read\n {6}actions: read\n {6}checks: read\n {4}outputs:\n/mu,
  );
  assert.ok(
    jobs.get("reuse").includes(`      backend_verified: ${expression("steps.check.outputs.backend_verified")}\n`),
  );
  // The secret scan and the early conflict check run in the scope plan job, so a leaked secret or a
  // pull request that conflicts with main fails before any other job starts.
  assert.ok(jobs.get("plan").includes(`      secret_scan: ${expression("steps.secret-scan.outcome")}\n`));
  assert.match(jobs.get("plan"), /GITLEAKS_SHA256: [0-9a-f]{64}\n/u);
  assert.match(jobs.get("plan"), /echo "\$\{GITLEAKS_SHA256\}  \$\{archive\}" \| sha256sum -c -/u);
  const scan = step("plan", "Scan git history for secrets");
  assert.equal(scan.fields.get("if"), undefined);
  assert.equal(scan.fields.get("id"), "secret-scan");
  exact(
    "plan",
    "Fail early when this pull request conflicts with main",
    "node scripts/ward-ci-public/merge-latest-main.mjs",
    expression("github.event_name == 'pull_request'"),
  );
  {
    const names = steps("plan").map(({ fields }) => fields.get("name") ?? fields.get("uses"));
    assert.equal(names.at(-1), "Fail early when this pull request conflicts with main", "plan: conflict check last");
    assert.ok(
      names.indexOf("Record the tested tree") < names.indexOf("Scan git history for secrets") &&
        names.indexOf("Scan git history for secrets") < names.length - 1,
      "plan: the tested tree and the secret scan read the checked-out merge ref before main is merged",
    );
  }
  assert.equal(
    scan.text.split("        run: |\n")[1]?.trim(),
    '"$RUNNER_TEMP/gitleaks" git . --redact --no-banner --exit-code 1 --gitleaks-ignore-path .gitleaksignore --log-opts="--full-history HEAD"',
  );
  assert.match(jobs.get("required"), /^ {4}name: Ward Flow required$/mu);
  assert.match(jobs.get("required"), /^ {4}if: always\(\)$/mu);
  assert.match(
    jobs.get("required"),
    /^ {4}needs: \[plan, reuse, static, backend, unit, browser-build, browser, release-gate, build, coverage\]$/mu,
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
      exact(
        job,
        "Install and record the pinned npm toolchain",
        'npm install --global --ignore-scripts --no-audit --no-fund "$(node -p "require(\'./package.json\').packageManager")" && node --version && npm --version',
      );
      const entries = steps(job);
      const provision = entries.findIndex(
        (entry) => entry.fields.get("name") === "Install and record the pinned npm toolchain",
      );
      const runtime = entries.findIndex((entry) => entry.fields.get("uses")?.startsWith("actions/setup-node@"));
      const install = entries.findIndex((entry) => entry.fields.get("name") === "Install locked dependencies");
      assert.ok(provision > runtime, `${job}: provision npm after selecting Node`);
      if (install !== -1) assert.ok(install > provision, `${job}: provision pinned npm before installing dependencies`);
    }
  }
  for (const [job, name] of [
    ["browser", "Run Ward browser journeys"],
    ["release-gate", "Run the release-gate journeys"],
    ["release-gate", "Run the second release-gate suite"],
  ]) {
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
    BACKEND_REUSED: "needs.reuse.outputs.backend_verified",
    UNIT_REUSED: "needs.reuse.outputs.unit_verified",
    COVERAGE_REUSED: "needs.reuse.outputs.coverage_verified",
    BROWSER_REUSED: "needs.reuse.outputs.browser_verified",
    RELEASE_REUSED: "needs.reuse.outputs.release_verified",
    BUILD_REUSED: "needs.reuse.outputs.build_verified",
    PLAN_RESULT: "needs.plan.result",
    REUSE_RESULT: "needs.reuse.result",
    STATIC_RESULT: "needs.static.result",
    BACKEND_RESULT: "needs.backend.result",
    UNIT_RESULT: "needs.unit.result",
    BROWSER_RESULT: "needs.browser.result",
    BROWSER_BUILD_RESULT: "needs.browser-build.result",
    SECRET_SCAN_RESULT: "needs.plan.outputs.secret_scan",
    BUILD_RESULT: "needs.build.result",
    COVERAGE_RESULT: "needs.coverage.result",
    RELEASE_GATE_RESULT: "needs.release-gate.result",
    BACKEND_SCOPE: "needs.plan.outputs.backend",
    UNIT_SCOPE: "needs.plan.outputs.unit",
    BROWSER_SCOPE: "needs.plan.outputs.browser",
    BUILD_SCOPE: "needs.plan.outputs.build",
    DRAFT: "github.event.pull_request.draft == true",
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
          require_gate() {
            case "$3" in
              true)
                test "$GITHUB_EVENT_NAME" = push
                test "$GITHUB_REF" = refs/heads/main
                test "$REUSE_RESULT" = success
                test "$1" = true
                test "$2" = skipped
                ;;
              false|"") require_scope "$1" "$2" ;;
              *) return 1 ;;
            esac
          }
          test "$PLAN_RESULT" = success
          test "$STATIC_RESULT" = success
          test "$SECRET_SCAN_RESULT" = success
          if [ "$DRAFT" = true ]; then
            require_scope "$BACKEND_SCOPE" "$BACKEND_RESULT"
            test "$GITHUB_EVENT_NAME" = pull_request
            require_scope "$UNIT_SCOPE" "$UNIT_RESULT"
            require_scope "$UNIT_SCOPE" "$COVERAGE_RESULT"
            require_scope "$BUILD_SCOPE" "$BUILD_RESULT"
            test "$BROWSER_BUILD_RESULT" = skipped
            test "$BROWSER_RESULT" = skipped
            test "$RELEASE_GATE_RESULT" = skipped
            echo "::error title=Draft fast lane::Quick checks passed. Browser, phone and accessibility checks run when this pull request is marked ready; only that run can pass this check."
            exit 1
          fi
          test "$UNIT_REUSED" = "$COVERAGE_REUSED"
          require_gate "$BACKEND_SCOPE" "$BACKEND_RESULT" "$BACKEND_REUSED"
          require_gate "$UNIT_SCOPE" "$UNIT_RESULT" "$UNIT_REUSED"
          require_gate "$UNIT_SCOPE" "$COVERAGE_RESULT" "$COVERAGE_REUSED"
          require_gate "$BROWSER_SCOPE" "$BROWSER_RESULT" "$BROWSER_REUSED"
          require_gate "$BROWSER_SCOPE" "$RELEASE_GATE_RESULT" "$RELEASE_REUSED"
          require_gate "$BUILD_SCOPE" "$BUILD_RESULT" "$BUILD_REUSED"
          if [ "$BROWSER_SCOPE" = true ] && { [ "$BROWSER_REUSED" != true ] || [ "$RELEASE_REUSED" != true ]; }; then
            test "$BROWSER_BUILD_RESULT" = success
          else
            test "$BROWSER_BUILD_RESULT" = skipped
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
for (let bits = 0; bits < 16; bits++) {
  const enabled = (bit) => Boolean(bits & (1 << bit));
  const permitted = (enabled(0) ? 1 : 0) | (enabled(1) ? 2 : 0) | (enabled(2) ? 12 : 0) | (enabled(3) ? 16 : 0);
  for (let mask = 0; mask < 32; mask++) {
    if ((mask & ~permitted) !== 0) continue;
    const reused = (bit) => Boolean(mask & (1 << bit));
    const values = {
      PLAN_RESULT: "success",
      STATIC_RESULT: "success",
      SECRET_SCAN_RESULT: "success",
      REUSE_RESULT: mask ? "success" : "skipped",
      REUSE_VERIFIED: String((mask & 30) === 30),
      BACKEND_REUSED: String(reused(0)),
      UNIT_REUSED: String(reused(1)),
      COVERAGE_REUSED: String(reused(1)),
      BROWSER_REUSED: String(reused(2)),
      RELEASE_REUSED: String(reused(3)),
      BUILD_REUSED: String(reused(4)),
      DRAFT: "false",
      GITHUB_EVENT_NAME: mask ? "push" : "pull_request",
      GITHUB_REF: mask ? "refs/heads/main" : "refs/pull/1/merge",
      BACKEND_SCOPE: String(enabled(0)),
      UNIT_SCOPE: String(enabled(1)),
      BROWSER_SCOPE: String(enabled(2)),
      BUILD_SCOPE: String(enabled(3)),
      BACKEND_RESULT: enabled(0) && !reused(0) ? "success" : "skipped",
      UNIT_RESULT: enabled(1) && !reused(1) ? "success" : "skipped",
      COVERAGE_RESULT: enabled(1) && !reused(1) ? "success" : "skipped",
      BROWSER_RESULT: enabled(2) && !reused(2) ? "success" : "skipped",
      BROWSER_BUILD_RESULT: enabled(2) && (!reused(2) || !reused(3)) ? "success" : "skipped",
      BUILD_RESULT: enabled(3) && !reused(4) ? "success" : "skipped",
      RELEASE_GATE_RESULT: enabled(2) && !reused(3) ? "success" : "skipped",
    };
    assert.equal(runVerdict(values), 0, JSON.stringify({ bits, mask }));
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
      ...(mask ? ["REUSE_RESULT"] : []),
    ])
      for (const result of ["failure", "cancelled", "", values[key] === "success" ? "skipped" : "success"]) {
        assert.notEqual(runVerdict({ ...values, [key]: result }), 0, `${key}=${result} must block`);
        verdictCases++;
      }
    for (const key of ["BACKEND_SCOPE", "UNIT_SCOPE", "BROWSER_SCOPE", "BUILD_SCOPE"]) {
      assert.notEqual(runVerdict({ ...values, [key]: "" }), 0);
      verdictCases++;
    }
    assert.notEqual(runVerdict({ ...values, DRAFT: "true" }), 0, "drafts never pass");
    assert.notEqual(runVerdict({ ...values, UNIT_REUSED: "unknown" }), 0, "unknown evidence refuses");
    assert.notEqual(
      runVerdict({ ...values, COVERAGE_REUSED: values.UNIT_REUSED === "true" ? "false" : "true" }),
      0,
      "unit and coverage evidence must be reused together",
    );
    verdictCases += 3;
    if (mask)
      for (const [key, value] of [
        ["GITHUB_EVENT_NAME", "pull_request"],
        ["GITHUB_REF", "refs/heads/other"],
      ]) {
        assert.notEqual(runVerdict({ ...values, [key]: value }), 0);
        verdictCases++;
      }
  }
}
// Every enforcing run command is an exact contract; mutation probes must change
// the input before rejection, preventing obsolete no-op controls from passing.
for (const [before, after] of [
  ["run: node scripts/ward-ci-public/plan.mjs", "run: echo omitted"],
  ["run: node scripts/ward-ci-public/verify-plan.mjs", "run: echo omitted"],
  ["run: node scripts/ward-ci-public/budget-gate.mjs", "run: echo omitted"],
  ["run: node scripts/ward-ci-public/merge-latest-main.mjs", "run: echo omitted"],
  [
    "if: ${{ github.event_name == 'pull_request' }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs",
    "if: ${{ false }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs",
  ],
  ["run: node tests/support/ward-shared-mode-run.mjs", "run: echo omitted"],
  ["run: npm run check:coverage-inventory", "run: echo omitted"],
  ["run: npm run test:e2e:release-gate", "run: echo omitted"],
  ["          path: test-results/**/*.json", "          path: test-results/"],
  [
    "name: Upload successful release-gate reports\n        if: ${{ !cancelled() && steps.gate.outcome == 'success' }}",
    "name: Upload successful release-gate reports\n        if: ${{ false }}",
  ],
  ["run: npm install --global --ignore-scripts --no-audit --no-fund", "run: echo npm installation omitted"],
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
  ['          if [ "$DRAFT" = true ]; then', '          if [ "$DRAFT" = never ]; then'],
  [
    '            exit 1\n          fi\n          test "$UNIT_REUSED" = "$COVERAGE_REUSED"',
    '            true\n          fi\n          test "$UNIT_REUSED" = "$COVERAGE_REUSED"',
  ],
  ["    types: [opened, synchronize, reopened, ready_for_review]", "    types: [opened, synchronize, reopened]"],
  ["&& github.event.pull_request.draft != true }}", "}}"],
  ["shard: [1, 2, 3, 4]", "shard: [1, 2, 3]"],
  ["group: [1, 2]", "group: [1]"],
  ["            browser: webkit\n", "            browser: chromium\n"],
  ["            second_part: referrals\n", "            second_part: journeys\n"],
  [
    "          - pair: desktop journeys, referrals and checks\n",
    "          - pair: phone journeys, referrals and checks\n",
  ],
  [
    "          WARD_RELEASE_GATE_PART: ${{ matrix.second_part }}",
    "          WARD_RELEASE_GATE_PART: ${{ matrix.part }}",
  ],
  [
    "name: Upload successful second-suite reports\n        if: ${{ !cancelled() && steps.gate-second.outcome == 'success' }}",
    "name: Upload successful second-suite reports\n        if: ${{ false }}",
  ],
  ["  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n", "  cancel-in-progress: true\n"],
  [
    "          WARD_INSTALL_RESTORED: ${{ steps.node-modules.outputs.cache-hit }}",
    "          WARD_INSTALL_RESTORED: true",
  ],
  [
    "          path: node_modules\n          key: ward-node-modules-",
    "          path: node_modules\n          restore-keys: ward-\n          key: ward-node-modules-",
  ],
  ["| sha256sum -c -", "| cat"],
  ["--gitleaks-ignore-path .gitleaksignore", ""],
  ["        id: secret-scan\n", "        id: unused-secret-scan\n"],
  ["SECRET_SCAN_RESULT: ${{ needs.plan.outputs.secret_scan }}", "SECRET_SCAN_RESULT: success"],
  ['          require_gate "$BROWSER_SCOPE" "$RELEASE_GATE_RESULT" "$RELEASE_REUSED"\n', ""],
  ['                test "$REUSE_RESULT" = success\n', ""],
  [
    "if: ${{ github.event_name == 'pull_request' }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs\n  reuse:",
    "if: ${{ false }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs\n  reuse:",
  ],
  ["&& needs.browser-build.result == 'success' && ", "&& "],
  [
    "!cancelled() && needs.plan.result == 'success' && needs.plan.outputs.build",
    "!cancelled() && needs.plan.outputs.build",
  ],
  ["    needs: [plan, reuse, static, build]\n", "    needs: [plan, reuse]\n"],
  ["    needs: [plan, reuse, browser-build, static, build]\n", "    needs: [plan, browser-build]\n"],
  [" && needs.static.result == 'success' && (needs.build.result == 'success'", " && (needs.build.result == 'success'"],
  [
    "(needs.build.result == 'skipped' && (needs.plan.outputs.build != 'true' || needs.reuse.outputs.build_verified == 'true'))",
    "needs.build.result == 'skipped'",
  ],
  [" && needs.unit.result == 'success' }}", " }}"],
  [
    "          - pair: desktop journeys, referrals and checks\n            project: release-gate-desktop\n            browser: chromium\n            part: journeys\n            second_project: release-gate-desktop\n            second_part: referrals\n            third_project: release-gate-desktop\n            third_part: checks\n",
    "",
  ],
  [
    "          WARD_RELEASE_GATE_PART: ${{ matrix.third_part }}",
    "          WARD_RELEASE_GATE_PART: ${{ matrix.second_part }}",
  ],
  [
    "name: Upload successful third-suite reports\n        if: ${{ !cancelled() && steps.gate-third.outcome == 'success' }}",
    "name: Upload successful third-suite reports\n        if: ${{ false }}",
  ],
  ["needs.reuse.outputs.backend_verified != 'true' }}", "true }}"],
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
