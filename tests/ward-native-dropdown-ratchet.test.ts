import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Q36 (Josh, "yes to all", 3 Nov 2026) and DESIGN-SYSTEM.md "Choosing one of a few": every browser
 * drop-down is replaced by a kit choice, a kit Menu of radio choices or the ListPicker. The kit
 * `Select` in `wf/form.tsx` is still the browser's own drop-down, so it counts too.
 *
 * The sweep runs page by page, so this guard is a one-way ratchet. A file not listed below may not
 * gain a drop-down, and a listed file may not gain more than it has. Removing drop-downs never
 * needs this file edited, so parallel page PRs do not conflict here. Lower or delete a line only
 * when you are already editing it. Audit thread, 4 Nov 2026 (main cdbd78ff: 198 in 78 files).
 */
const KNOWN_DROPDOWNS: Readonly<Record<string, number>> = {
  "src/components/ward-management/alerts/alert-detail.tsx": 2,
  "src/components/ward-management/alerts/alerts-queue-groups.tsx": 1,
  "src/components/ward-management/board/ward-board-detail-panel.tsx": 3,
  "src/components/ward-management/board/ward-board-grid-column.tsx": 3,
  "src/components/ward-management/board/ward-board-ward-diagnosis.tsx": 1,
  "src/components/ward-management/capacity/capacity-road-time.tsx": 1,
  "src/components/ward-management/capacity/capacity-scenario-dialog.tsx": 1,
  "src/components/ward-management/capacity/planned-admissions-panel.tsx": 11,
  "src/components/ward-management/capacity/step-down-board.tsx": 2,
  "src/components/ward-management/capacity/ward-closure-panel.tsx": 2,
  "src/components/ward-management/community/community-index.tsx": 1,
  "src/components/ward-management/community/community-screen-back-tab.tsx": 1,
  "src/components/ward-management/community/community-screen-phone.tsx": 1,
  "src/components/ward-management/community/community-screen-transport-dialogs.tsx": 1,
  "src/components/ward-management/community/community-screen-waiting-tab.tsx": 1,
  "src/components/ward-management/community/team-2026/midland-phone.tsx": 2,
  "src/components/ward-management/community/team-2026/team-caseload.tsx": 1,
  "src/components/ward-management/community/team-2026/team-referrals.tsx": 2,
  "src/components/ward-management/coordinator/call-sheet.tsx": 1,
  "src/components/ward-management/coordinator/home-release-sheet.tsx": 1,
  "src/components/ward-management/coordinator/shortlist-panel.tsx": 13,
  "src/components/ward-management/discharges/discharge-board.tsx": 1,
  "src/components/ward-management/discharges/discharge-care-journey.tsx": 5,
  "src/components/ward-management/discharges/discharge-dependencies-panel.tsx": 4,
  "src/components/ward-management/discharges/discharge-follow-up.tsx": 1,
  "src/components/ward-management/ed/ed-screen-referred.tsx": 1,
  "src/components/ward-management/ed/ed-screen-row-forms.tsx": 6,
  "src/components/ward-management/forecast/forecast-miss-reason-control.tsx": 1,
  "src/components/ward-management/governance-registers.tsx": 5,
  "src/components/ward-management/legal-forms/legal-forms-sheets.tsx": 3,
  "src/components/ward-management/loop-checks/movement-loop-checks.tsx": 3,
  "src/components/ward-management/loop-checks/ward-closure-loop-checks.tsx": 2,
  "src/components/ward-management/movements/movement-drawer.tsx": 1,
  "src/components/ward-management/movements/movement-horizon-gantt.tsx": 1,
  "src/components/ward-management/movements/movement-workflow-actions.tsx": 2,
  "src/components/ward-management/movements/movement-workspace-cockpit.tsx": 9,
  "src/components/ward-management/movements/sent-journey-changes.tsx": 4,
  "src/components/ward-management/officer/officer-job-detail.tsx": 2,
  "src/components/ward-management/out-of-area/home-service-return-panel.tsx": 2,
  "src/components/ward-management/out-of-area/out-of-area-return-plan.tsx": 1,
  "src/components/ward-management/patients/patient-transit-operations.tsx": 5,
  "src/components/ward-management/patients/patient-ward-change-card.tsx": 1,
  "src/components/ward-management/referrals/arrival-time-modal.tsx": 2,
  "src/components/ward-management/referrals/pull-accepted-referral.tsx": 4,
  "src/components/ward-management/referrals/referral-commitments-panel.tsx": 3,
  "src/components/ward-management/referrals/referral-match-not-a-bed.tsx": 2,
  "src/components/ward-management/referrals/referral-match-rows.tsx": 2,
  "src/components/ward-management/referrals/referral-match.tsx": 5,
  "src/components/ward-management/referrals/referral-owner-and-calls-panel.tsx": 3,
  "src/components/ward-management/referrals/upload-forms-modal.tsx": 1,
  "src/components/ward-management/referrals/ward-referral-drawer-catchment.tsx": 2,
  "src/components/ward-management/referrals/ward-referral-drawer-patient-step.tsx": 2,
  "src/components/ward-management/referrals/ward-referral-drawer-placement-step.tsx": 1,
  "src/components/ward-management/referrals/ward-referral-drawer-referral-step.tsx": 6,
  "src/components/ward-management/referrals/ward-referral-inbox.tsx": 2,
  "src/components/ward-management/reports/patient-chronology-screen.tsx": 1,
  "src/components/ward-management/restrictive-practice/seclusion-screen.tsx": 3,
  "src/components/ward-management/search/patient-search.tsx": 8,
  "src/components/ward-management/settings/access-settings.tsx": 7,
  "src/components/ward-management/shell/ward-my-wards.tsx": 1,
  "src/components/ward-management/statistics/statistics-compare-screen.tsx": 1,
  "src/components/ward-management/transport-exception-dialog.tsx": 1,
  "src/components/ward-management/transport/transport-booking-form.tsx": 2,
  "src/components/ward-management/ward-management-modes.tsx": 1,
  "src/components/ward-management/ward-shared-role-gate.tsx": 2,
  "src/components/ward-management/ward-tasks-drawer.tsx": 2,
  "src/components/ward-management/ward/ward-accepted-referral-placement-form.tsx": 4,
  "src/components/ward-management/ward/ward-answer-view.tsx": 1,
  "src/components/ward-management/ward/ward-arrivals-corridor.tsx": 1,
  "src/components/ward-management/ward/ward-bed-blocker-editor.tsx": 1,
  "src/components/ward-management/ward/ward-bed-dossier-drawer.tsx": 2,
  "src/components/ward-management/ward/ward-bed-dossier-phone.tsx": 1,
  "src/components/ward-management/ward/ward-drawer-discharge-date.tsx": 1,
  "src/components/ward-management/ward/ward-observation-control.tsx": 3,
  "src/components/ward-management/wards/ward-index.tsx": 3,
  "src/components/ward-redesign/ed-board/ed-arrival-time-modal.tsx": 2,
  "src/components/ward-redesign/pop-alerts/alerts-drawer.tsx": 2,
  "src/components/wf/form.tsx": 1,
};

const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Block comments and line comments go first, so a comment that names `<select>` is not counted. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");
}

function countDropdowns(source: string): number {
  return (stripComments(source).match(/<(select|Select)(?=[\s>/])/g) ?? []).length;
}

function scanDropdowns(): { scannedFiles: number; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  let scannedFiles = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith(".tsx")) {
        scannedFiles += 1;
        const count = countDropdowns(readFileSync(path, "utf8"));
        if (count > 0) counts.set(relative(REPOSITORY_ROOT, path).split("\\").join("/"), count);
      }
    }
  };
  walk(join(REPOSITORY_ROOT, "src"));
  return { scannedFiles, counts };
}

describe("Q36 browser drop-down ratchet", () => {
  it("counts raw and kit drop-downs but not comments, SelectProps or other tags", () => {
    const sample = [
      "// a <select> in a line comment",
      "/* <Select> in a block comment */",
      "type P = SelectProps;",
      "<Select id={id}>",
      "<select",
      '  aria-label="Ward"',
      ">",
      "<SelectionList />",
      '<a href="https://example.org/<select">',
    ].join("\n");
    expect(countDropdowns(sample)).toBe(2);
  });

  it("adds no browser drop-down beyond the known list", () => {
    const { scannedFiles, counts } = scanDropdowns();
    expect(scannedFiles).toBeGreaterThan(500);
    const grown = [...counts]
      .filter(([file, count]) => count > (KNOWN_DROPDOWNS[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (allowed ${KNOWN_DROPDOWNS[file] ?? 0})`);
    expect(grown, "Use a kit choice, kit Menu radio choices or ListPicker instead (Q36)").toEqual([]);
  });
});
