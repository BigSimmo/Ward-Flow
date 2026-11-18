import { describe, expect, it } from "vitest";

import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import { holdUpRecorder } from "@/components/ward-management/patients/patient-status-card";
import { reopenedByRole } from "@/components/ward-management/ward/ward-bed-dossier-drawer";

/** 16 Nov walk: who reopened a bed and who recorded a hold-up, read from the session's event log. */
const entry = (over: Partial<EventLogEntry>): EventLogEntry => ({
  sequence: 1,
  type: "SET_BED_CLOSED",
  role: "ward",
  now: 600,
  accepted: true,
  ...over,
});

describe("reopenedByRole", () => {
  it("names the one desk whose accepted bed step on this ward landed at the reopen time", () => {
    expect(reopenedByRole([entry({ unitId: "u1" })], "u1", 600)).toBe("ward");
  });

  it("names nobody when no step, a refused step or two desks match", () => {
    expect(reopenedByRole([], "u1", 600)).toBeUndefined();
    expect(reopenedByRole([entry({ unitId: "u1", accepted: false })], "u1", 600)).toBeUndefined();
    expect(reopenedByRole([entry({ unitId: "u2" })], "u1", 600)).toBeUndefined();
    expect(
      reopenedByRole([entry({ unitId: "u1" }), entry({ unitId: "u1", role: "coordinator" })], "u1", 600),
    ).toBeUndefined();
  });
});

describe("holdUpRecorder", () => {
  const blocker = entry({ type: "RECORD_MOVEMENT_BLOCKER", movementId: "m1", role: "coordinator", now: 640 });

  it("names the desk and time when the hold-up record is the newest step on the movement", () => {
    expect(holdUpRecorder([blocker], "m1")).toEqual({ label: "Bed coordinator", at: 640 });
  });

  it("names nobody once a later step on the movement may have rewritten it", () => {
    const later = entry({ type: "TRANSPORT_ACCEPTED", movementId: "m1", now: 650 });
    expect(holdUpRecorder([blocker, later], "m1")).toBeUndefined();
    expect(holdUpRecorder([blocker], "m2")).toBeUndefined();
    expect(holdUpRecorder([blocker], undefined)).toBeUndefined();
  });
});
