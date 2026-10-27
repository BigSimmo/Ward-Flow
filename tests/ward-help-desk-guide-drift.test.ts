import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESK_GUIDES } from "@/components/ward-management/help/ward-help-guide";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";

/** The one-page desk guide each in-app desk guide follows. */
const DOC_FOR: Record<WardTourRole, string> = {
  coordinator: "flow-coordinator.md",
  bed_manager: "site-bed-manager.md",
  ward: "ward.md",
  ed: "emergency-department.md",
  community: "community-team.md",
  officer: "transport-officer.md",
  executive: "executive.md",
  admin: "access-admin.md",
};

/**
 * Known differences on main today, listed for Josh to clear. Each entry must still differ: once a
 * source is fixed the test fails until the entry is removed, so the list only shrinks.
 */
const KNOWN_TITLES: Partial<Record<WardTourRole, string>> = {
  ward: "Ward (nurse in charge)",
  ed: "ED mental health clinician",
  executive: "Executive (read only)",
};
const KNOWN_MISSING_JOBS: Partial<Record<WardTourRole, readonly string[]>> = {
  ward: ["Leave, away and discharge"],
};

/** Markdown with emphasis, code marks and line breaks removed, lower-cased. */
function plain(markdown: string): string {
  return markdown.replace(/[*_`]/g, "").replace(/\s+/g, " ").toLowerCase();
}

const docs = Object.fromEntries(
  Object.entries(DOC_FOR).map(([role, file]) => [role, readFileSync(`docs/ward-flow/desk-guides/${file}`, "utf8")]),
) as Record<WardTourRole, string>;

describe("help desk guides match docs/ward-flow/desk-guides (P12)", () => {
  for (const role of Object.keys(DOC_FOR) as WardTourRole[]) {
    const guide = DESK_GUIDES[role];
    const doc = plain(docs[role]);
    const file = DOC_FOR[role];

    it(`${role}: the doc names the in-app home "${guide.homeName}"`, () => {
      expect(doc, `${file} does not mention home "${guide.homeName}"`).toContain(plain(guide.homeName));
    });

    it(`${role}: the doc names every in-app job`, () => {
      const missing = guide.jobs.map((job) => job.job).filter((job) => !doc.includes(plain(job)));
      expect(missing, `${file} is missing jobs from DESK_GUIDES.${role}`).toEqual(KNOWN_MISSING_JOBS[role] ?? []);
    });

    it(`${role}: the doc title uses the role's access label`, () => {
      const title = docs[role].split("\n")[0].replace(/^# Desk guide: /, "");
      expect(title, `${file} title vs ACCESS_ROLE_LABELS.${role}`).toBe(KNOWN_TITLES[role] ?? ACCESS_ROLE_LABELS[role]);
    });
  }
});
