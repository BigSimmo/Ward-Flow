/**
 * Chooses the unit test timings that balance this run's unit shards ("Ward Flow scope plan" in
 * .github/workflows/ward-flow.yml, D-166).
 *
 * The coverage job on every main push measures what each test file cost and uploads it as the
 * `ward-unit-durations` artifact. This step takes the newest unexpired one from a main push run, so
 * the shards stay balanced as tests are added, without anyone copying numbers into
 * scripts/ward-flow/unit-durations.json by hand. When none can be read (an API error, an expired
 * or malformed record), it uses that committed file instead. Either way it writes one file, which
 * the plan job uploads and every shard downloads, so all four shards deal the same split.
 *
 * Timings only decide which shard runs a file and in what order. Every file still runs exactly
 * once, so a stale or missing record can only make a shard slower, never skip a test.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT = "ward-unit-durations";
const COMMITTED = fileURLToPath(new URL("../ward-flow/unit-durations.json", import.meta.url));

/** The seconds record, or null unless every entry is a test path with a finite, non-negative time. */
export function validSeconds(record) {
  const seconds = record?.seconds;
  if (!seconds || typeof seconds !== "object" || Array.isArray(seconds)) return null;
  const entries = Object.entries(seconds);
  if (entries.length === 0) return null;
  for (const [file, value] of entries)
    if (!/^tests\/[\w./-]+$/u.test(file) || typeof value !== "number" || !Number.isFinite(value) || value < 0)
      return null;
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

/** The newest unexpired artifact made by a main push run, from a list-artifacts API payload. */
export function newestMainArtifact(payload) {
  const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
  return (
    artifacts
      .filter(
        (artifact) =>
          artifact?.name === ARTIFACT &&
          artifact.expired === false &&
          artifact.workflow_run?.head_branch === "main" &&
          // A fork's own "main" is not this repository's main.
          artifact.workflow_run.head_repository_id === artifact.workflow_run.repository_id &&
          Number.isInteger(artifact.workflow_run?.id),
      )
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] ?? null
  );
}

function fromLatestMain({ repo, exec }) {
  const listing = JSON.parse(exec("gh", ["api", `repos/${repo}/actions/artifacts?name=${ARTIFACT}&per_page=20`]));
  const artifact = newestMainArtifact(listing);
  if (!artifact) throw new Error("no unexpired main record");
  const directory = mkdtempSync(path.join(tmpdir(), "ward-unit-durations-"));
  exec("gh", [
    "run",
    "download",
    String(artifact.workflow_run.id),
    "--repo",
    repo,
    "--name",
    ARTIFACT,
    "--dir",
    directory,
  ]);
  const file = readdirSync(directory).find((name) => name.endsWith(".json"));
  if (!file) throw new Error("the record held no JSON file");
  const seconds = validSeconds(JSON.parse(readFileSync(path.join(directory, file), "utf8")));
  if (!seconds) throw new Error("the record is malformed");
  return {
    seconds,
    source: `main run ${artifact.workflow_run.id} at ${String(artifact.workflow_run.head_sha).slice(0, 8)} (${artifact.created_at})`,
  };
}

export function chooseUnitDurations({
  repo = process.env.GITHUB_REPOSITORY,
  exec = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 60_000 }),
  committed = COMMITTED,
} = {}) {
  try {
    if (!repo) throw new Error("no repository named");
    return fromLatestMain({ repo, exec });
  } catch (error) {
    const seconds = validSeconds(JSON.parse(readFileSync(committed, "utf8")));
    if (!seconds) throw new Error("scripts/ward-flow/unit-durations.json is malformed", { cause: error });
    return { seconds, source: `the committed scripts/ward-flow/unit-durations.json (${error.message})` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (!output) {
    console.error("usage: node scripts/ward-ci-public/unit-durations-latest.mjs --output <json path>");
    process.exit(2);
  }
  const { seconds, source } = chooseUnitDurations();
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ source, seconds })}\n`);
  console.log(`Unit shard timings: ${Object.keys(seconds).length} files from ${source}.`);
}
