import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESK_GUIDES } from "@/components/ward-management/help/ward-help-guide";

// P8: the desk guide in Help must stay in step with docs/ward-flow/desk-guides/*.md.
const DOC_FOR_ROLE: Record<keyof typeof DESK_GUIDES, string> = {
  coordinator: "flow-coordinator.md",
  ward: "ward.md",
  ed: "emergency-department.md",
  officer: "transport-officer.md",
  community: "community-team.md",
  bed_manager: "site-bed-manager.md",
  executive: "executive.md",
  admin: "access-admin.md",
};

// Known, deliberate differences between the short Help job name and the doc's job name.
const RENAMED: Record<string, string> = {
  "ward:Leave, away and discharge": "Away and discharge",
  "community:Answer a referral": "Answer a referral to your team",
};

function docJobs(file: string): string[] {
  const text = readFileSync(join(process.cwd(), "docs/ward-flow/desk-guides", file), "utf8");
  return [...text.matchAll(/^\d+\. \*\*(.+?)\.\*\*/gm)].map((m) => m[1]);
}

describe("desk guide parity (Help vs docs/ward-flow/desk-guides)", () => {
  it("maps every Help desk guide to a doc", () => {
    expect(Object.keys(DOC_FOR_ROLE).sort()).toEqual(Object.keys(DESK_GUIDES).sort());
  });

  for (const [role, guide] of Object.entries(DESK_GUIDES)) {
    it(`${role}: every Help job is a job in ${DOC_FOR_ROLE[role as keyof typeof DESK_GUIDES]}, in order`, () => {
      const jobs = docJobs(DOC_FOR_ROLE[role as keyof typeof DESK_GUIDES]);
      const wanted = guide.jobs.map((j) => RENAMED[`${role}:${j.job}`] ?? j.job);
      for (const job of wanted) expect(jobs).toContain(job);
      const positions = wanted.map((job) => jobs.indexOf(job));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
  }
});
