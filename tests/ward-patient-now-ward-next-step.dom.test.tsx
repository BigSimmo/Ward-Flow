import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-001",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { patientNextStep, stayProgress } from "@/components/ward-management/patients/patient-now-ward";
import { dischargeReadiness, recentStayEvents } from "@/components/ward-management/patients/patient-now-ward-recent";
import type { PatientStatusContext } from "@/components/ward-management/patients/patient-status-card";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh's approved list for the ward patient's Now tab (3 Nov 2026): the one next step leads, stay
 * progress and discharge readiness read recorded fields only, and nothing is scored. Synthetic data.
 */
const seed = seedWardFlowState();
const occupied = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.patientId &&
    a.awayAtEmergencyDepartmentSince === null &&
    !seed.leaveBeds.some((bed) => bed.admissionId === a.id),
)!;
const noop = () => undefined;

function ctxFor(admission: Admission, extra: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    admission,
    hasBedHold: false,
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
    onDischargeDate: noop,
    ...extra,
  };
}

const stay = (overrides: Partial<Admission>): Admission => ({
  ...occupied,
  arrivedAt: NOW_ANCHOR - 6 * MINUTES_PER_DAY,
  expectedDischargeAt: null,
  dischargeConfirmedAt: null,
  ...overrides,
});

describe("next step, stay progress and readiness from the recorded stay", () => {
  it("asks for a discharge date, then its confirmation, then says nothing is due", () => {
    const none = patientNextStep("ward", ctxFor(stay({})), { voluntary: false });
    expect(none?.title).toBe("Set a discharge date");
    expect(none?.action?.event).toBe("UPDATE_EXPECTED_DISCHARGE");

    const expected = NOW_ANCHOR + 3 * MINUTES_PER_DAY;
    const unconfirmed = patientNextStep("ward", ctxFor(stay({ expectedDischargeAt: expected })), {
      voluntary: false,
      confirmHref: "/ward-flow/ward/U-1?tab=out",
    });
    expect(unconfirmed?.title).toBe("Confirm discharge date");
    expect(unconfirmed?.action?.href).toBe("/ward-flow/ward/U-1?tab=out");

    const confirmed = patientNextStep(
      "ward",
      ctxFor(stay({ expectedDischargeAt: expected, dischargeConfirmedAt: NOW_ANCHOR - 60 })),
      { voluntary: false },
    );
    expect(confirmed?.title).toBe("Nothing due now");
    expect(confirmed?.action).toBeUndefined();
  });

  it("reads the stay as Day 7 of a planned 10, and past the date in words", () => {
    const planned = stayProgress(stay({ expectedDischargeAt: NOW_ANCHOR + 3 * MINUTES_PER_DAY }), NOW_ANCHOR);
    expect(planned?.headline).toBe("Day 7 of a planned 10");
    expect(planned?.note).toBe("3 days to the expected date");

    const late = stayProgress(stay({ expectedDischargeAt: NOW_ANCHOR - 2 * MINUTES_PER_DAY }), NOW_ANCHOR);
    expect(late?.past).toBe(true);
    expect(late?.note).toBe("2 days past the expected date");

    expect(stayProgress(stay({}), NOW_ANCHOR)?.headline).toBe("Day 7");
  });

  it("counts days past the expected date by calendar day (time audit D2)", () => {
    const dayStart = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    // 22:00 yesterday read at 01:00 today: yesterday, never "today".
    const lateYesterday = stayProgress(stay({ expectedDischargeAt: dayStart - 2 * 60 }), dayStart + 60);
    expect(lateYesterday?.note).toBe("1 day past the expected date");
    // 01:00 today read at 10:42: earlier today.
    const earlierToday = stayProgress(stay({ expectedDischargeAt: dayStart + 60 }), NOW_ANCHOR);
    expect(earlierToday?.note).toBe("Past the expected time today");
  });

  it("shows readiness as recorded ticks, never a score", () => {
    const rows = dischargeReadiness(stay({}), { ...seed.patients[0]!, catchmentCommunityTeam: undefined }, new Date(0));
    expect(rows.map((row) => row.key)).toEqual(["date", "team", "contact"]);
    expect(rows.every((row) => !/\d+\s*(%|of\s+\d)/u.test(`${row.label} ${row.detail}`))).toBe(true);
    expect(rows[0]).toMatchObject({ done: false, label: "Date not confirmed", detail: "No discharge date set" });
  });

  it("lists only the last 24 hours, newest first", () => {
    const events = recentStayEvents({
      admission: stay({
        arrivedAt: NOW_ANCHOR - 2 * MINUTES_PER_DAY,
        expectedDischargeAt: NOW_ANCHOR + MINUTES_PER_DAY,
        dischargeDateSetAt: NOW_ANCHOR - 30,
        dischargeConfirmedAt: NOW_ANCHOR - 10,
      }),
      now: NOW_ANCHOR,
      dayZero: new Date(0),
    });
    expect(events.map((event) => event.text)).toEqual([
      "Discharge date confirmed",
      expect.stringMatching(/^Discharge date (set for|moved to) /u),
    ]);
  });
});

describe("the ward patient's Now tab", () => {
  it("leads with the next step card, keeps readiness as ticks and drops Legal now", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={occupied.patientId!} />
      </WardFlowProvider>,
    );
    const next = screen.getByTestId("ward-patient-next-step");
    const status = screen.getByTestId("ward-patient-status-card");
    expect(next.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One button at most: the single thing due now.
    expect(
      within(next).queryAllByRole("button").length + within(next).queryAllByRole("link").length,
    ).toBeLessThanOrEqual(1);

    const readiness = screen.getByTestId("ward-patient-discharge-readiness");
    for (const key of ["date", "team", "contact"]) {
      const row = within(readiness).getByTestId(`ward-patient-ready-${key}`);
      const done = row.getAttribute("data-done") === "true";
      expect(row.querySelector(`[data-wf-glyph="${done ? "success" : "neutral"}"]`)).not.toBeNull();
    }
    expect(readiness).not.toHaveTextContent(/%|score/iu);

    expect(screen.queryByTestId("ward-patient-legal-now")).not.toBeInTheDocument();
    expect(within(status).getByTestId("ward-patient-change-card")).toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-last-day")).toBeInTheDocument();
  });

  it("opens History from Last 24 hours", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId={occupied.patientId!} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-patient-last-day-history"));
    expect(screen.getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true");
  });
});
