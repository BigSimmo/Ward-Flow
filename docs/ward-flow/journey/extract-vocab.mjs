import fs from "node:fs";
import path from "node:path";

// Resolved from this file, never from a checkout path: this tooling has to work in whichever
// worktree it is run from, and an absolute path silently reads ANOTHER worktree's source.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const dir = path.resolve(here, "../../../src/components/ward-management") + "/";
const files = [
  "ward-model.ts",
  "ward-change-reasons.ts",
  "ward-admissions.ts",
  "ward-bed-availability.ts",
  "ward-patients.ts",
  "ward-eligibility.ts",
];

const out = {};
for (const f of files) {
  let s;
  try {
    s = fs.readFileSync(dir + f, "utf8");
  } catch {
    continue;
  }
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const re = /export const ([A-Z_][A-Z_0-9]*) = \[([\s\S]*?)\] as const;/g;
  let m;
  while ((m = re.exec(s))) {
    const body = m[2];
    if (body.includes("{")) continue;
    const members = [...body.matchAll(/"([^"]*)"|'([^']*)'|\b(\d+)\b/g)].map((x) => x[1] ?? x[2] ?? x[3]);
    if (members.length) out[m[1]] = { file: f, members };
  }
}

// label maps: exported Record<...> objects that give a rendered phrase per member
const labelMaps = {};
for (const f of files) {
  let s;
  try {
    s = fs.readFileSync(dir + f, "utf8");
  } catch {
    continue;
  }
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const re = /export const ([a-zA-Z_][a-zA-Z_0-9]*Labels?)\s*:\s*Record<[^>]*>\s*=\s*\{([\s\S]*?)\n\};/g;
  let m;
  while ((m = re.exec(s))) {
    const pairs = [...m[2].matchAll(/^\s*([a-zA-Z_0-9"'-]+)\s*:\s*"([^"]*)"/gm)].map((x) => [
      x[1].replace(/^["']|["']$/g, ""),
      x[2],
    ]);
    if (pairs.length) labelMaps[m[1]] = Object.fromEntries(pairs);
  }
}

fs.writeFileSync(
  // Beside this script, not at a remembered path. Writing outside the checkout meant the repo
  // copy read whatever a previous run happened to leave behind somewhere else.
  path.join(here, "vocabularies.json"),
  JSON.stringify({ vocabularies: out, labels: labelMaps }, null, 1),
);

console.log("vocabularies:", Object.keys(out).length, " label maps:", Object.keys(labelMaps).length);
for (const k of ["GENDER_PLACEMENT_REASONS", "OVERRIDE_REASONS", "ELIGIBILITY_GATES", "URGENT_MARK_REASONS"]) {
  console.log(k + ":", JSON.stringify(out[k]?.members));
}
console.log("label maps found:", Object.keys(labelMaps).join(", "));
