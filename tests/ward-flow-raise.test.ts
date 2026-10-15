import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";

/**
 * Fix list 1.5: screens raise events by name (`useWardRaise(role)`), not by building event objects
 * with a desk role and the time at each call. Raw `dispatch({` calls may only go down, file by file.
 * When a screen moves over, lower or remove its line here.
 */
const RAW_DISPATCH_BASELINE: Record<string, number> = {
  "src/components/ward-management/alerts/alerts-screen.tsx": 7,
  "src/components/ward-management/alerts/global-alert-panels.tsx": 1,
  "src/components/ward-management/capacity/capacity-phone-wards.tsx": 1,
  "src/components/ward-management/capacity/capacity-screen.tsx": 2,
  "src/components/ward-management/capacity/planned-admissions-panel.tsx": 4,
  "src/components/ward-management/capacity/step-down-board.tsx": 1,
  "src/components/ward-management/community/community-screen.tsx": 1,
  "src/components/ward-management/coordinator/shortlist-panel.tsx": 9,
  "src/components/ward-management/discharges/discharge-board.tsx": 3,
  "src/components/ward-management/discharges/discharge-care-journey.tsx": 1,
  "src/components/ward-management/discharges/discharge-follow-up.tsx": 1,
  "src/components/ward-management/governance-registers.tsx": 2,
  "src/components/ward-management/handover/handover-page.tsx": 1,
  "src/components/ward-management/hub/hub-screen.tsx": 2,
  "src/components/ward-management/movements/movement-drawer.tsx": 2,
  "src/components/ward-management/movements/support-notification-checklist.tsx": 1,
  "src/components/ward-management/network/network-overview.tsx": 1,
  "src/components/ward-management/officer/officer-screen.tsx": 1,
  "src/components/ward-management/patients/patient-now-screen.tsx": 10,
  "src/components/ward-management/patients/patient-transit-operations.tsx": 16,
  "src/components/ward-management/referrals/arrival-time-modal.tsx": 1,
  "src/components/ward-management/referrals/referral-match.tsx": 9,
  "src/components/ward-management/referrals/upload-forms-modal.tsx": 1,
  "src/components/ward-management/referrals/ward-referral-drawer.tsx": 2,
  "src/components/ward-management/referrals/ward-referral-inbox.tsx": 3,
  "src/components/ward-management/shell/ward-bar.tsx": 1,
  "src/components/ward-management/shell/ward-broadcast-banner.tsx": 2,
  "src/components/ward-management/ward-demo-controls.tsx": 3,
  "src/components/ward-management/ward-flow-provider.tsx": 5,
  "src/components/ward-management/ward-global-search.tsx": 1,
  "src/components/ward-management/ward-tasks-drawer.tsx": 8,
  "src/components/ward-management/ward/ward-arrivals-corridor.tsx": 3,
  "src/components/ward-management/ward/ward-screen.tsx": 7,
};

function screenFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("screens raise events by name", () => {
  it("adds no raw dispatch calls to any screen", () => {
    const over = screenFiles("src").flatMap((path) => {
      const count = readFileSync(path, "utf8").match(/dispatch\(\{/g)?.length ?? 0;
      const allowed = RAW_DISPATCH_BASELINE[path] ?? 0;
      return count > allowed ? [`${path}: ${count} raw dispatch calls, ${allowed} allowed`] : [];
    });
    expect(over, "use useWardRaise(role) from ward-flow-raise.ts instead").toEqual([]);
  });

  it("fills in the desk and the time, and keeps every other field", () => {
    const dispatch = vi.fn<(event: WardFlowEvent) => void>();
    const raise = wardRaise(dispatch, "ed", 642);
    raise("WITHDRAW_REFERRAL", { movementId: "synthetic-movement", actingPlaceId: "synthetic-ed" });
    raise("RESET_SCENARIO");
    expect(dispatch.mock.calls).toEqual([
      [
        {
          type: "WITHDRAW_REFERRAL",
          role: "ed",
          now: 642,
          movementId: "synthetic-movement",
          actingPlaceId: "synthetic-ed",
        },
      ],
      [{ type: "RESET_SCENARIO", role: "ed", now: 642 }],
    ]);
  });
});
