/**
 * Fetches main's own phone script measurements for one main commit, so an over-budget pull request
 * does not have to build main a second time to see whose growth it is (`budget-gate.mjs`).
 *
 * Main's push run of "Ward Flow CI" saves its measurements as the `script-budget-measured`
 * artifact. That run builds main whenever main is over budget, because its build cannot be reused
 * without a strict budget pass, so the artifact exists in exactly the case that used to cost every
 * PR an extra production build. When no artifact matches (main was within budget and reused its
 * PR's build, the artifact expired, or the API refused), this exits non-zero and the gate falls
 * back to building main as before.
 *
 * Usage: node main-measured.mjs <main sha> <output file>. Needs GITHUB_TOKEN with `actions: read`
 * and GITHUB_REPOSITORY. Reads only; writes only the output file.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ARTIFACT = "script-budget-measured";
const SHA = /^[0-9a-f]{40}$/u;

/** A measurement file is usable only when every value is a finite size in KB. */
export function validMeasurement(text) {
  try {
    const { measured } = JSON.parse(text);
    if (!measured || typeof measured !== "object" || Array.isArray(measured)) return false;
    const values = Object.values(measured);
    return values.length > 0 && values.every((kb) => typeof kb === "number" && Number.isFinite(kb) && kb > 0);
  } catch {
    return false;
  }
}

/**
 * @param {{ sha: string, repo: string, token: string, fetchImpl?: typeof fetch,
 *   unzip?: (zip: string) => string }} options
 * @returns {Promise<string | undefined>} the measurement file's text, or undefined
 */
export async function fetchMainMeasured({ sha, repo, token, fetchImpl = fetch, unzip = unzipMeasured }) {
  if (!SHA.test(sha)) return undefined;
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" };
  const get = async (path) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers });
    if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
    return response.json();
  };
  const { workflow_runs: runs = [] } = await get(
    `/actions/workflows/ward-flow.yml/runs?head_sha=${sha}&event=push&branch=main&per_page=20`,
  );
  for (const run of runs) {
    if (run.head_sha !== sha || run.event !== "push" || run.head_branch !== "main") continue;
    const { artifacts = [] } = await get(`/actions/runs/${run.id}/artifacts?name=${ARTIFACT}&per_page=10`);
    const artifact = artifacts.find((item) => item.name === ARTIFACT && !item.expired);
    if (!artifact) continue;
    const response = await fetchImpl(artifact.archive_download_url, { headers });
    if (!response.ok) throw new Error(`artifact ${artifact.id}: ${response.status}`);
    const dir = mkdtempSync(join(tmpdir(), "ward-main-measured-"));
    try {
      const zip = join(dir, "artifact.zip");
      writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
      const text = unzip(zip);
      if (validMeasurement(text)) return text;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  return undefined;
}

function unzipMeasured(zip) {
  return execFileSync("unzip", ["-p", zip, "measured.json"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [sha, out] = process.argv.slice(2);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  if (!sha || !out || !token || !repo) {
    console.log("Main's saved measurements are not available here; building main instead.");
    process.exitCode = 1;
  } else {
    fetchMainMeasured({ sha, repo, token })
      .then((text) => {
        if (!text) {
          console.log(`No saved measurements for main ${sha.slice(0, 7)}; building main instead.`);
          process.exitCode = 1;
          return;
        }
        writeFileSync(out, text);
        console.log(`Using main ${sha.slice(0, 7)}'s own saved measurements: no second build needed.`);
      })
      .catch((error) => {
        console.log(`Main's saved measurements could not be read (${error.message}); building main instead.`);
        process.exitCode = 1;
      });
  }
}
