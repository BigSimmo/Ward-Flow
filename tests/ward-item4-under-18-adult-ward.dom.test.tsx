// Feature item 4 (Josh, 11 Nov 2026): the under 18 on an adult ward notice on the bed record.
// Synthetic seed only.
import { createRef } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WF_PHONE_QUERY } from "@/components/wf";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  UNDER_18_ADULT_WARD_NOTICE,
  under18AdultWardNotice,
} from "@/components/ward-management/ward-under-18-adult-ward";

const NOTICE =
  "Under 18 on an adult ward. Check the Mental Health Act 2014 requirements for a child on an adult ward, including notifying the Chief Psychiatrist.";
const DAY = new Date("2026-11-11T02:00:00Z");
const adultWard = { cohort: "Adult" as const };
const youthWard = { cohort: "Youth" as const };

describe("when the notice applies (pure)", () => {
  it("uses Josh's wording exactly, with no section number or time limit", () => {
    expect(UNDER_18_ADULT_WARD_NOTICE).toBe(NOTICE);
    expect(UNDER_18_ADULT_WARD_NOTICE).not.toMatch(/\bs(ection)?\s?\d|\d+\s?(hours?|days?|h)\b/i);
  });

  it("shows for a person under 18 on an adult ward, loud until a time is recorded", () => {
    expect(under18AdultWardNotice({ dateOfBirth: "2009-09-20" }, adultWard, {}, DAY)).toEqual({ tone: "loud" });
    expect(under18AdultWardNotice({ dateOfBirth: "2009-09-20" }, { cohort: "Older adult" }, {}, DAY)?.tone).toBe(
      "loud",
    );
  });

  it("does not show at 18 or over, on the 18th birthday itself", () => {
    expect(under18AdultWardNotice({ dateOfBirth: "2008-11-11" }, adultWard, {}, DAY)).toBeNull();
    expect(under18AdultWardNotice({ dateOfBirth: "1990-01-01" }, adultWard, {}, DAY)).toBeNull();
    expect(under18AdultWardNotice({ dateOfBirth: "2008-11-12" }, adultWard, {}, DAY)?.tone).toBe("loud");
  });

  it("does not show on a youth ward, or with no usable date of birth", () => {
    expect(under18AdultWardNotice({ dateOfBirth: "2009-09-20" }, youthWard, {}, DAY)).toBeNull();
    expect(under18AdultWardNotice({ dateOfBirth: "" }, adultWard, {}, DAY)).toBeNull();
    expect(under18AdultWardNotice(undefined, adultWard, {}, DAY)).toBeNull();
  });

  it("goes quiet, but stays, once a notified time is recorded", () => {
    const admission = { chiefPsychiatristNotice: { notifiedAt: 500, at: 510, by: "ward" as const } };
    expect(under18AdultWardNotice({ dateOfBirth: "2009-09-20" }, adultWard, admission, DAY)).toEqual({
      tone: "quiet",
      notifiedAt: 500,
    });
  });
});

const seed = seedWardFlowState();
const stay = seed.admissions.find((admission) => admission.id === "AD-SCGA-09")!;
const unit = seed.units.find((candidate) => candidate.id === stay.unitId)!;

describe("the recorded time", () => {
  it("is seeded on a synthetic seventeen year old on an adult ward, with nothing recorded", () => {
    expect(unit.cohort).toBe("Adult");
    const patient = seed.patients.find((candidate) => candidate.id === stay.patientId);
    expect(under18AdultWardNotice(patient, unit, stay, DAY)).toEqual({ tone: "loud" });
    expect(stay.chiefPsychiatristNotice).toBeUndefined();
  });

  it("records the typed time; a ward may record only for its own stay, never later than now", () => {
    const base = { type: "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED", now: NOW_ANCHOR, admissionId: stay.id } as const;
    const recorded = wardFlowReducer(seed, {
      ...base,
      role: "ward",
      actingUnitId: unit.id,
      notifiedAt: NOW_ANCHOR - 30,
    });
    expect(recorded.admissions.find((admission) => admission.id === stay.id)?.chiefPsychiatristNotice).toEqual({
      notifiedAt: NOW_ANCHOR - 30,
      at: NOW_ANCHOR,
      by: "ward",
    });
    const otherWard = wardFlowReducer(seed, { ...base, role: "ward", actingUnitId: "rph-adult-secure", notifiedAt: 1 });
    expect(otherWard.rejections.at(-1)?.reason).toMatch(/acting as unit/);
    const later = wardFlowReducer(seed, { ...base, role: "coordinator", notifiedAt: NOW_ANCHOR + 5 });
    expect(later.rejections.at(-1)?.reason).toBe("The notified time is later than now");
    const ed = wardFlowReducer(seed, { ...base, role: "ed", notifiedAt: NOW_ANCHOR });
    expect(ed.admissions.find((admission) => admission.id === stay.id)?.chiefPsychiatristNotice).toBeUndefined();
  });
});

function Probe() {
  const { admissions } = useWardFlow();
  const notice = admissions.find((row) => row.id === stay.id)?.chiefPsychiatristNotice;
  return <output data-testid="notified">{notice ? String(notice.notifiedAt) : "none"}</output>;
}

function renderDrawer(admissionId: string, drawerUnit = unit) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Probe />
      <WardBedDossierDrawer
        selectedBed={9}
        bedItem={{
          bedNumber: 9,
          bedLabel: "Bed 09",
          status: "occupied",
          statusText: "Inpatient",
          admissionId,
          patientAlias: "Synthetic person",
        }}
        unit={drawerUnit}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        onMove={() => {}}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  setDeskRole("coordinator");
  vi.unstubAllGlobals();
});

describe("the notice on the bed record", () => {
  it("shows for the seeded under 18 patient, field empty, nothing pre-selected, nothing blocked", () => {
    renderDrawer(stay.id);
    const notice = screen.getByTestId("ward-under-18-notice");
    expect(notice.getAttribute("data-tone")).toBe("loud");
    expect(within(notice).getByText(NOTICE)).toBeTruthy();
    const field = within(notice).getByLabelText("Chief Psychiatrist notified at") as HTMLInputElement;
    expect(field.value).toBe("");
    expect(notice.querySelectorAll("input:checked, [aria-checked='true'], [aria-pressed='true']")).toHaveLength(0);
    // The bed's own steps are all still offered and none waits on the notice.
    const leave = screen.getByRole("button", { name: "Record that they have left" }) as HTMLButtonElement;
    expect(leave.disabled).toBe(false);
  });

  it("entering a time makes it quiet but still visible", async () => {
    renderDrawer(stay.id);
    const notice = screen.getByTestId("ward-under-18-notice");
    const field = within(notice).getByLabelText("Chief Psychiatrist notified at");
    fireEvent.change(field, { target: { value: "0930" } });
    await act(async () => {
      fireEvent.click(within(notice).getByRole("button", { name: "Save" }));
    });
    expect(screen.getByTestId("notified").textContent).not.toBe("none");
    const quiet = screen.getByTestId("ward-under-18-notice");
    expect(quiet.getAttribute("data-tone")).toBe("quiet");
    expect(within(quiet).getByText(NOTICE)).toBeTruthy();
    expect(within(quiet).getByTestId("ward-under-18-notified").textContent).toMatch(
      /^Chief Psychiatrist notified at .*09:30/,
    );
  });

  it("saves nothing when the time is left empty", () => {
    renderDrawer(stay.id);
    const notice = screen.getByTestId("ward-under-18-notice");
    fireEvent.click(within(notice).getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("notified").textContent).toBe("none");
    expect(within(notice).getByRole("alert").textContent).toMatch(/Type the time/);
  });

  it("does not show for an adult on the same ward, or for the same person on a youth ward", () => {
    const adult = seed.admissions.find(
      (admission) => admission.unitId === unit.id && admission.state === "occupied" && admission.id !== stay.id,
    )!;
    const { unmount } = renderDrawer(adult.id);
    expect(screen.queryByTestId("ward-under-18-notice")).toBeNull();
    unmount();
    renderDrawer(stay.id, { ...unit, cohort: "Youth" });
    expect(screen.queryByTestId("ward-under-18-notice")).toBeNull();
  });

  it("shows on the phone bed sheet too, under the four facts", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderDrawer(stay.id);
    const notice = screen.getByTestId("ward-under-18-notice");
    expect(within(notice).getByText(NOTICE)).toBeTruthy();
    expect((within(notice).getByLabelText("Chief Psychiatrist notified at") as HTMLInputElement).value).toBe("");
  });
});
