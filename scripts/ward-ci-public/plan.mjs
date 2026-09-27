import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const sha = /^[0-9a-f]{40}$/i;
const docsOnly = (file) => file === "README.md" || /^docs\/ward-flow\/.*\.md$/u.test(file);

export function classifyChanges(entries) {
  if (!entries.length) return { full: true, reason: "empty diff" };
  if (entries.some(({ status }) => status !== "M" && status !== "A")) {
    return { full: true, reason: "deleted or renamed file" };
  }
  if (entries.every(({ file }) => docsOnly(file))) return { full: false, reason: "Ward documentation only" };
  return { full: true, reason: "source, test, tooling, configuration or unknown change" };
}

export function parseNameStatus(output) {
  return output
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const [status, file, ...extra] = line.split("\t");
      if (!status || !file || extra.length || file.includes("\\")) throw new Error(`Invalid git diff entry: ${line}`);
      return { status, file };
    });
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/ward-ci-public/plan.mjs")) {
  const base = process.env.WARD_BASE_SHA;
  let plan;
  if (!base) {
    plan = { full: true, reason: "no PR base (merge group or manual run)" };
  } else if (!sha.test(base)) {
    plan = { full: true, reason: "invalid PR base" };
  } else {
    try {
      const output = execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`], {
        encoding: "utf8",
        timeout: 30_000,
      });
      plan = classifyChanges(parseNameStatus(output));
    } catch (error) {
      plan = { full: true, reason: `history unavailable (${error.code ?? error.status ?? "error"})` };
    }
  }
  console.log(`Ward CI scope: ${plan.full ? "full" : "docs"} — ${plan.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${plan.full}\n`);
}
