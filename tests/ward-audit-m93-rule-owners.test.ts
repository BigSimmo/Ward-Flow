// M93: one owner for each rule. For every move in the M26 catalogue
// (docs/ward-flow/journey/machines.json), docs/ward-flow/code-map/rule-owners.md names the one engine
// file that decides it. The guards below fail if that page goes stale, if a screen (.tsx) starts
// handling a workflow move itself, if a file outside ward-eligibility.ts declares one of its
// deciding functions, or if a new screen compares a legal status with "Voluntary" directly.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WM = "src/components/ward-management";
const machines = JSON.parse(readFileSync(join(ROOT, "docs/ward-flow/journey/machines.json"), "utf8")) as {
  machines: { id: string; transitions: { action?: string }[] }[];
};
const page = readFileSync(join(ROOT, "docs/ward-flow/code-map/rule-owners.md"), "utf8");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/u.test(name)) out.push(relative(ROOT, path).split("\\").join("/"));
  }
  return out;
}
const files = sourceFiles(join(ROOT, "src"));
const text = new Map(files.map((file) => [file, readFileSync(join(ROOT, file), "utf8")]));

/** Table rows as trimmed cells (the formatter pads Markdown tables). */
const cellsOf = (markdown: string) =>
  markdown
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );

const moves = machines.machines.flatMap((machine) =>
  [...new Set(machine.transitions.flatMap((t) => String(t.action ?? "").match(/[A-Z][A-Z_]{3,}/gu) ?? []))].map(
    (action) => ({ machine: machine.id, action }),
  ),
);

/** Files that route or label an event but decide nothing (see the page's opening paragraph). */
const DESCRIBERS = new Set(
  [
    "ward-flow-reducer.ts",
    "ward-flow-subject-id.ts",
    "ward-audit.ts",
    "governance-event-facts.tsx",
    "ed/ed-screen-model.ts",
  ].map((f) => `${WM}/${f}`),
);

// Screens that compare a legal status with "Voluntary" themselves (10 Nov 2026). May only shrink.
const KNOWN_LEGAL_STATUS_COPIES = [
  "coordinator/shortlist-panel.tsx",
  "delays/delays-board-rows.tsx",
  "ed/ed-preview.tsx",
  "ed/ed-screen-desktop.tsx",
  "ed/ed-screen-person-sheet.tsx",
  "movements/movement-workflow-actions.tsx",
  "movements/movements-stage-row.tsx",
  "patients/patient-documents-tab.tsx",
  "patients/patient-now-cards.tsx",
  "referrals/ward-referral-drawer-referral-step.tsx",
  "search/patient-search.tsx",
].map((f) => `${WM}/${f}`);
KNOWN_LEGAL_STATUS_COPIES.push(
  "src/components/ward-redesign/ed-board/ed-screen-desktop.tsx",
  "src/components/ward-redesign/legal-copies/ed-screen-person-sheet.tsx",
);
const code = (source: string) =>
  source
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/u.test(line))
    .join("\n");

describe("M93 each workflow rule has one owner", () => {
  it("reads the catalogue", () => {
    expect(machines.machines.length).toBeGreaterThanOrEqual(10);
    expect(moves.length).toBeGreaterThan(40);
  });

  it("the code map names an owner for every move, and that file handles the move", () => {
    const problems: string[] = [];
    for (const { machine, action } of moves) {
      const row = cellsOf(page).find((cells) => cells[0] === machine && cells[1] === `\`${action}\``);
      const owners = [...(row?.[2] ?? "").matchAll(/`([^`]+)`/gu)].map((m) => `${WM}/${m[1]}`);
      if (owners.length === 0) {
        problems.push(`${machine} ${action}: no owner named`);
        continue;
      }
      for (const owner of owners) {
        if (owner.endsWith(".tsx")) problems.push(`${machine} ${action}: owner ${owner} is a screen`);
        if (!text.get(owner)?.includes(`"${action}"`))
          problems.push(`${machine} ${action}: ${owner} does not handle it`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("no screen or other file handles a workflow move outside its owner and the describers", () => {
    const owned = new Map<string, Set<string>>();
    for (const cells of cellsOf(page)) {
      const action = /^`([A-Z_]+)`$/u.exec(cells[1] ?? "")?.[1];
      if (!action) continue;
      const set = owned.get(action) ?? new Set<string>();
      for (const o of (cells[2] ?? "").matchAll(/`([^`]+)`/gu)) set.add(`${WM}/${o[1]}`);
      owned.set(action, set);
    }
    const strays: string[] = [];
    for (const [file, source] of text) {
      if (DESCRIBERS.has(file)) continue;
      for (const { action } of moves) {
        if (new RegExp(`case "${action}"\\s*:`, "u").test(source) && !owned.get(action)?.has(file)) {
          strays.push(`${file} handles ${action}`);
        }
      }
    }
    expect([...new Set(strays)]).toEqual([]);
  });

  it("only ward-eligibility.ts declares the eligibility deciders", () => {
    const deciders = [
      "eligibility",
      "referralEligibility",
      "sexDesignationAccepts",
      "involuntaryBedNeededForLegalStatus",
      "requiresAuthorisedDestination",
      "genderEligibility",
    ];
    const copies: string[] = [];
    for (const [file, source] of text) {
      if (file === `${WM}/ward-eligibility.ts`) continue;
      for (const name of deciders) {
        if (new RegExp(`\\b(?:function\\s+${name}\\s*\\(|export\\s+const\\s+${name}\\s*=)`, "u").test(source)) {
          copies.push(`${file} declares ${name}`);
        }
      }
    }
    expect(copies).toEqual([]);
  });

  it('no new screen compares a legal status with "Voluntary" itself', () => {
    const found = [...text]
      .filter(([file, source]) => file.endsWith(".tsx") && /[!=]==\s*"Voluntary"/u.test(code(source)))
      .map(([file]) => file)
      .sort();
    expect(found.filter((file) => !KNOWN_LEGAL_STATUS_COPIES.includes(file))).toEqual([]);
    expect(
      KNOWN_LEGAL_STATUS_COPIES.filter((file) => !found.includes(file)),
      "remove fixed files from the list",
    ).toEqual([]);
  });
});
