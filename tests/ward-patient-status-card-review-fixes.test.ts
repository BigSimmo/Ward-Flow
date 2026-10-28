import { describe, expect, it } from "vitest";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { senderPresentationLookup } from "@/components/ward-management/ward-sender-presentation";

/**
 * PR #147 review fixes on the gate board status card. Each case is one the first build got wrong:
 * declined wards counted twice, a refused forward step shown as ready, and a closed movement's
 * form shown as the legal status in force.
 */
const seed = seedWardFlowState();
const base = seed.movements[0];
const noop = () => {};

function ctx(movement: Movement, extra: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    movement,
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    ...extra,
  };
}

function bedCell(movement: Movement) {
  return buildPatientStatus("find", ctx(movement)).cells.find((cell) => cell.key === "bed")!;
}

describe("gate board status card review fixes", () => {
  it("does not infer no request from grant-only masked destinations and keeps permitted clearance and transport facts", () => {
    const movement = { ...base, referredUnitIds: [], declines: [] };
    const lookup = senderPresentationLookup(
      { version: 1, referrals: [], movements: [{ id: movement.id, kind: "restricted", restriction: "grant" }] },
      true,
    );
    const context = ctx(movement, { onOpenPlacement: () => {} });
    const ordinary = buildPatientStatus("find", context);
    const protectedStatus = buildPatientStatus("find", context, lookup.movementFor(movement));
    expect(protectedStatus.cells.find((cell) => cell.key === "bed")?.value).toBe("Progress unavailable in this view");
    expect(protectedStatus.cells.find((cell) => cell.key === "bed")?.action).toBeUndefined();
    for (const key of ["clearance", "transport"]) {
      expect(protectedStatus.cells.find((cell) => cell.key === key)).toEqual(
        ordinary.cells.find((cell) => cell.key === key),
      );
    }
    const receiving = senderPresentationLookup(
      { version: 1, referrals: [], movements: [{ id: movement.id, kind: "restricted", restriction: "receiving" }] },
      true,
    );
    const held = ctx(movement, { acceptedUnitName: "Synthetic own ward", hasBedHold: false });
    expect(buildPatientStatus("held", held, receiving.movementFor(movement))).toEqual(buildPatientStatus("held", held));
  });
  it("counts live requests only once: one ward left after a decline is still awaiting an answer", () => {
    const movement: Movement = {
      ...base,
      referredUnitIds: ["unit-b"],
      declines: [{ ...base.declines[0], unitId: "unit-a", at: NOW_ANCHOR - 10 } as Movement["declines"][number]],
    };
    expect(bedCell(movement).value).toBe("1 awaiting answer");
    expect(bedCell(movement).sub).toBe("1 declined");
  });

  it("says none found only when no request is live and a ward has declined", () => {
    const declined: Movement = {
      ...base,
      referredUnitIds: [],
      declines: [{ ...base.declines[0], unitId: "unit-a", at: NOW_ANCHOR - 10 } as Movement["declines"][number]],
    };
    expect(bedCell(declined).value).toBe("None found");
    expect(bedCell({ ...base, referredUnitIds: [], declines: [] }).value).toBe("No ward asked");
  });

  it("shows Cannot move with the engine's reason when the next forward step would be refused", () => {
    const movement: Movement = {
      ...base,
      medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
    };
    const ready = buildPatientStatus("held", ctx(movement));
    const refused = buildPatientStatus("held", ctx(movement, { handoverRefusal: "This ward no longer suits." }));
    expect(refused.verdict).toBe("Cannot move");
    expect(refused.meta).toBe("This ward no longer suits.");
    expect(refused.tone).toBe("danger");
    expect(ready.verdict).not.toBe("Cannot move");
  });

  it("offers Log booking only at the stages the engine accepts a booking", () => {
    const booking = (stage: Movement["stage"], mode: "held" | "transit") =>
      buildPatientStatus(mode, ctx({ ...base, stage, transport: undefined, transportNeed: undefined })).cells.find(
        (cell) => cell.key === (mode === "held" ? "transport" : "collected"),
      )?.action?.kind;
    // UX review 24 Oct 2026: before the bed is pulled, Log booking is greyed with its reason. The
    // Bed cell holds the step needed first, so this cell no longer repeats it.
    expect(booking("accepted_awaiting_bed", "held")).toBe("unavailable");
    expect(booking("pulled", "held")).toBe("button");
    expect(booking("handover_ready", "transit")).toBe("button");
    expect(booking("moving", "transit")).toBe("unavailable");
    const waiting = buildPatientStatus(
      "held",
      ctx({ ...base, stage: "accepted_awaiting_bed", transport: undefined, transportNeed: undefined }),
    ).cells.find((cell) => cell.key === "transport");
    expect(waiting?.sub).toBe("Needs the bed pulled");
    expect(waiting?.action).toEqual({ kind: "unavailable", label: "Log booking", reason: "Needs the bed pulled" });
  });

  it("links the Bed and Transport values to the ward and the movement (decision 2)", () => {
    const held = buildPatientStatus(
      "held",
      ctx(base, {
        acceptedUnitName: "Synthetic ward",
        bedHref: "/ward-flow/ward/U-1",
        transportHref: `/ward-flow/movements/${base.id}`,
      }),
    );
    expect(held.cells.find((cell) => cell.key === "bed")?.href).toBe("/ward-flow/ward/U-1");
    expect(held.cells.find((cell) => cell.key === "transport")?.href).toBe(`/ward-flow/movements/${base.id}`);
  });

  it("names each missing person step's Record button by its step", () => {
    const absent = buildPatientStatus(
      "awol",
      ctx(base, {
        leaveBed: {
          absentWithoutLeave: { since: NOW_ANCHOR - 30, steps: [] },
        } as unknown as PatientStatusContext["leaveBed"],
      }),
    );
    const names = absent.rows?.map((row) => (row.action?.kind === "button" ? row.action.ariaLabel : undefined));
    expect(names).toContain("Record Ward and grounds searched");
    expect(new Set(names).size).toBe(names?.length);
  });

  it("keeps the return order step when either the movement or the patient record is involuntary", () => {
    const stepsFor = (patientLegal: string) =>
      buildPatientStatus(
        "awol",
        ctx(
          { ...base, legalStatus: "Voluntary", legalForm: undefined, closure: undefined },
          {
            patient: { legalStatus: patientLegal } as PatientStatusContext["patient"],
            leaveBed: {
              absentWithoutLeave: { since: NOW_ANCHOR - 30, steps: [] },
            } as unknown as PatientStatusContext["leaveBed"],
          },
        ),
      ).rows?.map((row) => row.key);
    expect(stepsFor("Involuntary patient (recorded)")).toContain("return_order_made");
    expect(stepsFor("Voluntary")).not.toContain("return_order_made");
  });

  it("keeps an arrived stay's form in force on leave, and drops a movement that did not proceed", () => {
    const legalOnLeave = (outcome: "arrived" | "did_not_proceed") =>
      buildPatientStatus(
        "leave",
        ctx(
          {
            ...base,
            legalStatus: "Involuntary inpatient",
            legalForm: { code: "1A" } as Movement["legalForm"],
            closure: { at: NOW_ANCHOR - 60, outcome } as Movement["closure"],
          },
          {
            patient: { legalStatus: "Voluntary patient" } as PatientStatusContext["patient"],
            leaveBed: { expectedReturn: NOW_ANCHOR + 60 } as PatientStatusContext["leaveBed"],
          },
        ),
      ).cells.find((cell) => cell.key === "legal")?.value;
    expect(legalOnLeave("arrived")).toBe("Involuntary inpatient, Form 1A");
    expect(legalOnLeave("did_not_proceed")).toBe("Voluntary patient");
  });

  it("still offers Record CTO after an ended Form 5A, which a new order keeps as Closed (D-40)", () => {
    const legalAction = (patient: PatientStatusContext["patient"]) =>
      buildPatientStatus("idle", ctx(base, { patient })).cells.find((cell) => cell.key === "legal")?.action;
    expect(legalAction({} as PatientStatusContext["patient"])?.kind).toBe("button");
    const ended = legalAction({
      communityTreatmentOrder: {
        form: "5A",
        recordedAt: NOW_ANCHOR - 120,
        recordedBy: "Community",
        endedAt: NOW_ANCHOR - 60,
      },
    } as PatientStatusContext["patient"]);
    expect(ended).toMatchObject({ kind: "button", label: "Record CTO" });
  });

  it("keeps an active CTO and its Record ended beside an accepted referral (Qodo, 13 Oct 2026)", () => {
    const patient = {
      communityTreatmentOrder: { form: "5A", recordedAt: NOW_ANCHOR - 120, recordedBy: "Community" },
    } as PatientStatusContext["patient"];
    const acceptedReferral = { unitName: "Synthetic Ward", boardHref: "/ward" };
    const status = buildPatientStatus("cto", ctx(base, { patient, acceptedReferral }));
    const cto = status.cells.find((cell) => cell.key === "cto");
    expect(cto?.value).toBe("Form 5A in force");
    expect(cto?.action).toMatchObject({ kind: "button", label: "Record ended" });
    expect(status.cells.find((cell) => cell.key === "bed")?.value).toBe("Accepted on Synthetic Ward");
    expect(status.meta).toBe("Accepted at Synthetic Ward. Next: pull the bed");
    // Idle keeps the accepted-referral card.
    expect(buildPatientStatus("idle", ctx(base, { acceptedReferral })).verdict).toBe("Accepted, no bed pulled");
  });
});
