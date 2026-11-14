import { describe, expect, it } from "vitest";

import { collectPermissionMatrix, disagreements } from "../scripts/ward-flow/permission-matrix";

/**
 * L11 test gap (mechanics and clock audit, 14 Nov 2026): the permission matrix counted only "This
 * change is not part of your role." as a refusal, so actions a service coordinator can never take,
 * whatever record it names, read as "allowed" and were not pinned. They now read as refused at the
 * screen and the backend, so a new screen cannot offer one unnoticed. Offline, synthetic seed.
 */
const matrix = collectPermissionMatrix();
const cell = (action: string, desk: string) => matrix.cells[action]![desk]!;

describe("L11: fixed place refusals are pinned in the permission matrix", () => {
  it.each(["SET_CONFIGURATION", "RECORD_OUTAGE_WINDOW", "SET_SITE_FEATURE_SWITCH", "RECORD_SITE_HANDOVER_SIGN_OFF"])(
    "a service coordinator is refused %s at the screen and the backend",
    (action) => {
      expect(cell(action, "coordinator_service")).toMatchObject({ screen: "deny", backend: "deny" });
      // The statewide coordinator still may: the refusal is the place, not the role.
      expect(cell(action, "coordinator")).toMatchObject({ screen: "allow", backend: "allow" });
    },
  );

  it("a refusal only for a bare command is not counted when the desk's own place answers it", () => {
    // A site bed manager signs off its own site; a service coordinator takes back one ward's sign-off.
    expect(cell("RECORD_SITE_HANDOVER_SIGN_OFF", "bed_manager").backend).toBe("allow");
    expect(cell("UNDO_HANDOVER_SIGN_OFF", "coordinator_service").backend).toBe("allow");
  });

  it("leaves no layer disagreeing", () => {
    expect(disagreements(matrix)).toEqual([]);
  });
});
