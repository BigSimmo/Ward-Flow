// Feature item 15 (D-134): interpreter, Aboriginal liaison and advocacy service lines at arrival.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdAdmissionChecklist } from "@/components/ward-management/ed/ed-admission-checklist";
import { admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  supportNotificationChecklist,
  supportNotificationInboxItems,
} from "@/components/ward-management/ward-support-notifications";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const base = seed.movements.find((movement) => movement.id === "WF-005")!;

function movement(overrides: Partial<Movement> = {}): Movement {
  return { ...base, legalStatus: "Voluntary", ...overrides };
}

const keys = (m: Movement, context: Parameters<typeof admissionChecklist>[3] = {}) =>
  admissionChecklist(m, [], undefined, context).map((item) => item.key);

const line = (m: Movement, key: string, context: Parameters<typeof admissionChecklist>[3] = {}) =>
  admissionChecklist(m, [], undefined, context).find((item) => item.key === key);

const FIVE = ["medical_clearance", "legal_form", "transport", "contraband_search", "medication_chart"];

describe("each line appears only when its condition is recorded", () => {
  it("shows none of the three for a voluntary patient with nothing recorded", () => {
    expect(keys(movement())).toEqual(FIVE);
    expect(
      keys(movement(), {
        patient: {
          interpreterLanguage: "English — no interpreter required",
          aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
        },
      }),
    ).toEqual(FIVE);
    expect(keys(movement(), { patient: { aboriginalOrTorresStraitIslanderStatus: "Not stated" } })).toEqual(FIVE);
  });

  it("offers Interpreter booked only when an interpreter need is recorded, outstanding by default", () => {
    const context = { patient: { interpreterLanguage: "Italian — interpreter required" } };
    expect(keys(movement(), context)).toContain("interpreter_booked");
    expect(line(movement(), "interpreter_booked", context)).toMatchObject({
      label: "Interpreter booked",
      state: "outstanding",
    });
    expect(line(movement({ interpreterBooked: true }), "interpreter_booked", context)?.state).toBe("done");
  });

  it("offers Aboriginal liaison for Aboriginal, Torres Strait Islander or both, never assumed", () => {
    for (const status of [
      "Aboriginal, not Torres Strait Islander",
      "Torres Strait Islander, not Aboriginal",
      "Aboriginal and Torres Strait Islander",
    ]) {
      const context = { patient: { aboriginalOrTorresStraitIslanderStatus: status } };
      expect(line(movement(), "aboriginal_liaison_offered", context)).toMatchObject({
        label: "Aboriginal liaison offered",
        state: "outstanding",
        detail: "Not recorded",
      });
    }
  });

  it("keeps the liaison line away from the interpreter line", () => {
    const order = keys(movement(), {
      patient: {
        interpreterLanguage: "Tagalog — interpreter required",
        aboriginalOrTorresStraitIslanderStatus: "Torres Strait Islander, not Aboriginal",
      },
    });
    expect(Math.abs(order.indexOf("interpreter_booked") - order.indexOf("aboriginal_liaison_offered"))).toBeGreaterThan(
      1,
    );
  });

  it("offers Mental Health Advocacy Service told for a detained move only", () => {
    expect(keys(movement({ legalStatus: "Referred for psychiatric examination" }))).not.toContain("mhas_told");
    for (const legalStatus of ["Detained awaiting examination", "Involuntary inpatient"] as const) {
      expect(line(movement({ legalStatus }), "mhas_told")).toMatchObject({
        label: "Mental Health Advocacy Service told",
        state: "outstanding",
        supportNotification: { occasion: "admission", subjectId: base.id },
      });
    }
  });
});

describe("recording", () => {
  it("records interpreter and liaison with RECORD_ARRIVAL_CHECK, only when they apply", () => {
    const interpreterMove = seed.movements.find((candidate) => candidate.id === "WF-016")!;
    const booked = wardFlowReducer(seed, {
      type: "RECORD_ARRIVAL_CHECK",
      role: "ed",
      now: NOW,
      movementId: interpreterMove.id,
      check: "interpreter_booked",
      done: true,
    });
    expect(booked.rejections).toHaveLength(seed.rejections.length);
    expect(booked.movements.find((candidate) => candidate.id === interpreterMove.id)?.interpreterBooked).toBe(true);
    // WF-016's record holds no Aboriginal or Torres Strait Islander identity.
    const refused = wardFlowReducer(seed, {
      type: "RECORD_ARRIVAL_CHECK",
      role: "ed",
      now: NOW,
      movementId: interpreterMove.id,
      check: "aboriginal_liaison_offered",
      done: true,
    });
    expect(refused.rejections.at(-1)?.reason).toMatch(/No Aboriginal or Torres Strait Islander identity/);
    const liaison = wardFlowReducer(seed, {
      type: "RECORD_ARRIVAL_CHECK",
      role: "ed",
      now: NOW,
      movementId: "WF-015",
      check: "aboriginal_liaison_offered",
      done: true,
    });
    expect(liaison.movements.find((candidate) => candidate.id === "WF-015")?.aboriginalLiaisonOffered).toBe(true);
  });

  function arrive(state: WardFlowState, id: string): WardFlowState {
    return {
      ...state,
      movements: state.movements.map((candidate) =>
        candidate.id === id
          ? ({ ...candidate, stage: "arrived", closure: { outcome: "arrived", at: NOW } } as Movement)
          : candidate,
      ),
    };
  }

  it("an ED tick before arrival is the same record the support checklist and alert read", () => {
    const recorded = wardFlowReducer(seed, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ed",
      now: NOW,
      occasion: "admission",
      movementId: "WF-005",
      party: "mhas",
      outcome: "told",
      who: "Advocate on duty",
    });
    expect(recorded.supportNotifications?.at(-1)).toMatchObject({ subjectId: "WF-005", party: "mhas" });
    // ED records nothing else.
    const carer = wardFlowReducer(seed, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ed",
      now: NOW,
      occasion: "admission",
      movementId: "WF-005",
      party: "carer",
      outcome: "told",
      who: "Carer",
    });
    expect(carer.rejections.at(-1)?.reason).toMatch(/only the advocacy service notice/);

    const arrived = arrive(recorded, "WF-005");
    expect(supportNotificationChecklist(arrived.supportNotifications, "admission", "WF-005").mhas?.outcome).toBe(
      "told",
    );
    const task = supportNotificationInboxItems(arrived, NOW).find((item) => item.movementId === "WF-005");
    expect(task?.detail).toMatch(/^Carer, PSP not recorded/);
  });

  it("a ward record after arrival shows as told on the arrival checklist", () => {
    const arrived = arrive(seed, "WF-005");
    const recorded = wardFlowReducer(arrived, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ward",
      now: NOW,
      occasion: "admission",
      movementId: "WF-005",
      party: "mhas",
      outcome: "told",
      who: "Advocate on duty",
    });
    const moved = recorded.movements.find((candidate) => candidate.id === "WF-005")!;
    expect(line(moved, "mhas_told", { supportNotifications: recorded.supportNotifications, now: NOW })).toMatchObject({
      state: "done",
    });
  });
});

function Live({ id }: { id: string }) {
  const { movements, referrals } = useWardFlowSelect("movements", "referrals");
  return <EdAdmissionChecklist movement={movements.find((candidate) => candidate.id === id)!} referrals={referrals} />;
}

describe("the ED arrival checklist card", () => {
  it("ticks MHAS told through the shared support record, nothing ticked by default", async () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <Live id="WF-005" />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-ed-admission-checklist");
    const row = within(card.querySelector('[data-item="mhas_told"]') as HTMLElement);
    expect(row.getByText("Mental Health Advocacy Service told")).toBeTruthy();
    expect(row.getByText("Outstanding")).toBeTruthy();
    fireEvent.click(row.getByRole("button", { name: "Record told: Mental Health Advocacy Service" }));
    fireEvent.change(row.getByLabelText("Who was told"), { target: { value: "Advocate on duty" } });
    await act(async () => {
      fireEvent.click(row.getByRole("button", { name: "Save" }));
    });
    const after = within(card.querySelector('[data-item="mhas_told"]') as HTMLElement);
    expect(after.getByText("Done")).toBeTruthy();
    expect(after.getByText(/Told Advocate on duty/)).toBeTruthy();
  });

  it("shows the interpreter line for a seeded arrival that needs one, unticked", () => {
    render(
      <WardFlowProvider initialNow={NOW}>
        <Live id="WF-016" />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-ed-admission-checklist");
    const row = within(card.querySelector('[data-item="interpreter_booked"]') as HTMLElement);
    expect(row.getByText("Outstanding")).toBeTruthy();
    expect(row.getByRole("button", { name: "Record done: interpreter booked" })).toBeTruthy();
    expect(card.querySelector('[data-item="mhas_told"]')).toBeNull();
    expect(card.querySelector('[data-item="aboriginal_liaison_offered"]')).toBeNull();
  });
});
