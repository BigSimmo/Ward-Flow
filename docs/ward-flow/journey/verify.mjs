/** Generate and verify only in a disposable tree. Never run mutation proofs against a checkout. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const options = process.argv.slice(2);
if (options.length > 1 || options.some((option) => !["--check", "--write", "--prove"].includes(option)))
  throw new Error("Usage: node docs/ward-flow/journey/verify.mjs [--check | --write | --prove]");
const mode = options[0] ?? "--check";
const outputs = [
  "vocabularies.json",
  "stages.json",
  "ward-journey-explorer.html",
  "ward-patient-journey.bpmn",
  "MAP-INVENTORY.md",
];
// Measurement and incremental change reports retain their historical identity; a build is not a new coverage run.
const excluded = new Set([...outputs, "WHAT-CHANGED.md", "map-snapshot.json", "refusal-coverage.json"]);
function fingerprint() {
  const hash = crypto.createHash("sha256");
  const walk = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else {
        if (directory === here && excluded.has(entry.name)) continue;
        hash.update(path.relative(root, file));
        hash.update(fs.readFileSync(file));
      }
    }
  };
  walk(path.join(root, "src"));
  walk(here);
  const entries = JSON.parse(fs.readFileSync(path.join(here, "event-dispositions.json"), "utf8"));
  for (const test of [...new Set(entries.flatMap((entry) => entry.model?.tests ?? []))].sort()) {
    if (typeof test !== "string" || !/^tests\/[A-Za-z0-9_./-]+\.tsx?$/.test(test) || test.split("/").includes(".."))
      throw new Error(`Unsafe model test reference: ${test}`);
    hash.update(test);
    hash.update(fs.readFileSync(path.join(root, test)));
  }
  return hash.digest("hex");
}
function canonical(name, value) {
  if (name.endsWith(".json")) return JSON.stringify(JSON.parse(value));
  if (name.endsWith(".html")) {
    // Provenance records when/where a reader was made. It is not semantic drift; the source digest is.
    return value.replace(/"made":\{[^}]*\}/, '"made":{}');
  }
  return value.replaceAll("\r\n", "\n").trimEnd();
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "ward-journey-verify-"));
const before = fingerprint();
try {
  fs.cpSync(path.join(root, "src"), path.join(temporary, "src"), { recursive: true });
  const isolated = path.join(temporary, "docs/ward-flow/journey");
  fs.mkdirSync(path.dirname(isolated), { recursive: true });
  fs.cpSync(here, isolated, { recursive: true });
  // The model's test citations are checked without copying dependencies or executing tests.
  const dispositions = JSON.parse(fs.readFileSync(path.join(here, "event-dispositions.json"), "utf8"));
  for (const test of new Set(dispositions.flatMap((entry) => entry.model?.tests ?? []))) {
    if (typeof test !== "string" || !/^tests\/[A-Za-z0-9_./-]+\.tsx?$/.test(test) || test.split("/").includes(".."))
      throw new Error(`Unsafe model test reference: ${test}`);
    fs.mkdirSync(path.dirname(path.join(temporary, test)), { recursive: true });
    fs.copyFileSync(path.join(root, test), path.join(temporary, test));
  }
  const env = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}` };
  // Preserve actual checkout provenance without copying private Git configuration into the fixture.
  for (const [key, args] of [
    ["WARD_JOURNEY_COMMIT", ["rev-parse", "HEAD"]],
    ["WARD_JOURNEY_BRANCH", ["branch", "--show-current"]],
  ]) {
    try {
      env[key] = execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
    } catch {
      env[key] = "";
    }
  }
  try {
    const dirty = execFileSync(
      "git",
      ["-C", root, "status", "--porcelain", "--", "src/components/ward-management", "docs/ward-flow/journey"],
      { encoding: "utf8" },
    ).trim();
    env.WARD_JOURNEY_DIRTY_COUNT = String(dirty ? dirty.split("\n").length : 0);
  } catch {
    env.WARD_JOURNEY_DIRTY_COUNT = "0";
  }
  const run = (script, args = []) =>
    execFileSync(process.execPath, [path.join(isolated, script), ...args], {
      cwd: temporary,
      env,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  run("build.mjs");
  if (mode === "--prove") {
    console.log(run("build.mjs", ["--prove"]).trim());
    console.log(run("prove-source-contracts.mjs").trim());
  }
  if (fingerprint() !== before)
    throw new Error(
      "Journey/source inputs changed during verification; no outputs adopted. Run again against settled owned inputs.",
    );
  if (mode === "--check") {
    const stale = outputs.filter(
      (name) =>
        !fs.existsSync(path.join(here, name)) ||
        canonical(name, fs.readFileSync(path.join(here, name), "utf8")) !==
          canonical(name, fs.readFileSync(path.join(isolated, name), "utf8")),
    );
    if (stale.length)
      throw new Error(
        `Stale journey output: ${stale.join(", ")}. Regenerate with node docs/ward-flow/journey/verify.mjs --write`,
      );
  }
  if (mode === "--write") for (const name of outputs) fs.copyFileSync(path.join(isolated, name), path.join(here, name));
  console.log(
    `Journey ${mode.slice(2)} passed: ${outputs.length} reader outputs; source/input fingerprint ${before}; original source inputs untouched.`,
  );
} catch (error) {
  if (error.stderr) console.error(String(error.stderr));
  if (error.stdout) console.error(String(error.stdout));
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5 });
}
