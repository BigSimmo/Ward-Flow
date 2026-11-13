// Fix round C1 (Audit 16 A16-11, root causes 2.3, 5.2 and 6.2; Josh approved 13 Nov 2026).
// - A person whose only open record is a referral reads as referred, never "Not active", and the
//   card claims only what was checked.
// - The referral's ATS line and its triaged time carry different names.
// - A next community contact or care plan review whose day has passed says so.
// - Reminders and the call log say they are kept on this device only.
// Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const extras = vi.hoisted(() => ({ nextContact: "4 Nov 2026, clinic" as string | undefined }));
vi.mock("@/components/ward-management/patients/patient-record-extras", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/patients/patient-record-extras")>();
  return {
    ...actual,
    recordExtrasFor: (id: string | undefined) =>
      id === "PT-C1-COMMUNITY"
        ? {
            community: [
              {
                status: "active",
                team: "Synthetic community team",
                program: "Case management",
                since: "2026-01-01",
                caseManager: { name: "Synthetic clinician", role: "Case manager" },
                nextContact: extras.nextContact,
                documentIds: [],
              },
            ],
          }
        : actual.recordExtrasFor(id),
  };
});

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { patientStateTag } from "@/components/ward-management/patients/patient-glance";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { PatientCarePlansCard } from "@/components/ward-management/patients/patient-care-plans-card";
import { PatientTab } from "@/components/ward-management/referrals/referral-panel-tabs";
import { referralTimeline } from "@/components/ward-management/referrals/referral-board-parts";
import { ToolRemindMe } from "@/components/ward-management/tools/ward-tool-remind-me";
import { ToolCallLog } from "@/components/ward-management/tools/ward-tool-call-log";
import { AlertsRemindersGroup } from "@/components/ward-management/alerts/alerts-reminders-group";
import { addReminder, DEVICE_ONLY_LABEL } from "@/components/ward-management/tools/ward-tool-remind-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Patient } from "@/components/ward-management/ward-patients";
import { CARE_PLAN_TYPES } from "@/components/ward-management/ward-patient-care-plans";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// 10:42 Perth on Fri 13 Nov 2026 at instant 0.
const DAY_ZERO = new Date(Date.UTC(2026, 10, 13, 2, 42));

function context(overrides: Partial<PatientStatusContext>): PatientStatusContext {
  return {
    hasBedHold: false,
    now: 0,
    dayZero: DAY_ZERO,
    onOpenPlacement: vi.fn(),
    onClearance: vi.fn(),
    onBookTransport: vi.fn(),
    onArrivalTime: vi.fn(),
    onRecordReturn: vi.fn(),
    onMarkAbsent: vi.fn(),
    onAbsenceStep: vi.fn(),
    onRecordCto: vi.fn(),
    onEndCto: vi.fn(),
    ...overrides,
  } as PatientStatusContext;
}

const patient = { id: "PT-C1-REFERRAL", catchmentCommunityTeam: "Synthetic team" } as unknown as Patient;
const openReferral = { sentTo: "Sent to 1 ward", owner: "Ward", raisedAt: -20 };

describe("a person whose only open record is a referral (A16-11)", () => {
  it("is not tagged Not active", () => {
    expect(patientStateTag({ mode: "idle", communityActive: false }).tag).toBe("Not active");
    expect(patientStateTag({ mode: "idle", communityActive: false, openWork: "bed" })).toEqual({
      tag: "In placement",
      tone: "info",
    });
    expect(patientStateTag({ mode: "idle", communityActive: false, openWork: "community" }).tag).toBe("Referred");
    expect(patientStateTag({ mode: "cto", communityActive: true, openWork: "bed" }).tag).toBe("In placement");
    expect(patientStateTag({ mode: "idle", communityActive: true, openWork: "community" }).tag).toBe(
      "Community active",
    );
  });

  it("shows the referral on the card and never says there is no open referral", () => {
    const status = buildPatientStatus("idle", context({ patient, openReferral }));
    expect(status.verdict).toBe("Referred, awaiting answer");
    expect(status.meta).not.toMatch(/No open referral/u);
    const cell = status.cells.find((item) => item.key === "referral");
    expect(cell).toMatchObject({ label: "Referral", value: "Sent to 1 ward", owner: "Ward" });
    expect(cell?.sub).toMatch(/^Awaiting answer\. Raised /u);
  });

  it("keeps an order in force on the card beside an open referral", () => {
    const onCto = {
      ...patient,
      communityTreatmentOrder: { form: "5A", recordedAt: -60, recordedBy: "Community team" },
    } as unknown as Patient;
    const status = buildPatientStatus("cto", context({ patient: onCto, openReferral }));
    expect(status.verdict).toBe("Referred, on a CTO");
    expect(status.meta).not.toMatch(/No open referral/u);
    expect(status.cells.map((cell) => cell.key)).toEqual(["referral", "cto"]);
  });

  it("shows a booked planned admission as open work", () => {
    const status = buildPatientStatus(
      "idle",
      context({ patient, plannedAdmission: { unitName: "Synthetic ward", expectedArrivalAt: 600 } }),
    );
    expect(status.verdict).toBe("Planned admission booked");
    expect(status.meta).not.toMatch(/No open referral/u);
    expect(status.cells[0]).toMatchObject({ key: "planned", value: "Booked on Synthetic ward" });
  });

  it("still says Not currently active when nothing is open", () => {
    const status = buildPatientStatus("idle", context({ patient }));
    expect(status.verdict).toBe("Not currently active");
  });
});

describe("the seeded Act 3 referral's own page (A16-11)", () => {
  it("reads as in placement with the referral shown, never Not active", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen patientId="PT-060" />
      </WardFlowProvider>,
    );
    expect(await screen.findAllByText("Referred, awaiting answer")).not.toHaveLength(0);
    expect(screen.queryByText(/No open referral/u)).toBeNull();
    const stray = screen.queryByText("Not active");
    expect(stray).toBeNull();
    expect(screen.getAllByText("In placement").length).toBeGreaterThan(0);
  });
});

describe("next community contact (root cause 2.3)", () => {
  const community = { id: "PT-C1-COMMUNITY" } as unknown as Patient;
  const cell = () =>
    buildPatientStatus("idle", context({ patient: community })).cells.find((item) => item.key === "catchment")!;

  it("is not shown as all good once its day has passed", () => {
    extras.nextContact = "4 Nov 2026, clinic";
    expect(cell()).toMatchObject({ value: "4 Nov 2026", tone: "warning", time: "Date passed" });
  });

  it("is shown as booked when today or later, and neutral when not readable or not booked", () => {
    extras.nextContact = "20 Nov 2026, clinic";
    expect(cell()).toMatchObject({ tone: "success" });
    expect(cell().time).toBeUndefined();
    extras.nextContact = undefined;
    expect(cell()).toMatchObject({ value: "Not booked", tone: "neutral" });
  });
});

describe("care plan review date (root cause 2.3)", () => {
  function renderPlan(reviewOn: string) {
    const withPlan = {
      ...seedWardFlowState().patients[0]!,
      carePlans: [
        {
          id: "CP-C1",
          type: CARE_PLAN_TYPES[0],
          agreedBy: "Synthetic team",
          agreedOn: "2026-10-01",
          reviewOn,
          helps: [],
          status: "Current",
          recordedAt: -600,
          recordedBy: "coordinator",
        },
      ],
    } as unknown as Patient;
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientCarePlansCard
          patient={withPlan}
          role="coordinator"
          now={NOW_ANCHOR}
          todayIso="2026-11-13"
          nowClock="10:42"
          hasCarer={false}
          gate={() => ({ allowed: true })}
          run={vi.fn()}
        />
      </WardFlowProvider>,
    );
  }

  it("says the review date has passed, in the tribunal date's pattern", () => {
    renderPlan("2026-11-01");
    expect(within(screen.getByTestId("ward-patient-care-plan-current")).getByText("Review date passed")).toBeVisible();
  });

  it("says nothing extra while the review date is ahead", () => {
    renderPlan("2026-12-01");
    expect(screen.queryByText("Review date passed")).toBeNull();
  });
});

describe("two triage lines, two names (A16-11)", () => {
  const referral = seedWardFlowState().referrals.find((item) => item.id === "RF-005")!;

  it("names the referral's ATS line as the ATS category", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientTab
          referral={{ ...referral, atsCategory: undefined }}
          now={NOW_ANCHOR}
          personName="Synthetic"
          readOnly
        />
      </WardFlowProvider>,
    );
    const tab = screen.getByTestId("ward-referral-patient-tab");
    expect(within(tab).getByText("ATS category")).toBeVisible();
    expect(within(tab).queryByText("Triage", { exact: true })).toBeNull();
  });

  it("names the timeline's triaged time as the referring service's", () => {
    expect(referral.triagedAt).toBeDefined();
    const texts = referralTimeline(referral, seedWardFlowState().units).map((entry) => entry.text);
    expect(texts).toContain("Triaged at the referring service");
    expect(texts).not.toContain("Triaged");
  });
});

describe("reminders and the call log say where they are kept (root cause 5.2)", () => {
  it("labels Remind me on this device only", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolRemindMe onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("remind-device-only")).toHaveTextContent(DEVICE_ONLY_LABEL);
    expect(DEVICE_ONLY_LABEL).toBe("On this device only");
  });

  it("labels Call and log on this device only", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolCallLog />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("call-log-device-only")).toHaveTextContent(DEVICE_ONLY_LABEL);
  });

  it("labels due reminders in Alerts on this device only", () => {
    addReminder({
      kind: "ward",
      targetId: "ward-c1",
      targetLabel: "Synthetic ward",
      reason: "Call back",
      dueAt: 0,
      dayZero: 0,
    });
    render(<AlertsRemindersGroup now={10} />);
    expect(screen.getByTestId("ward-alerts-reminders")).toHaveTextContent(/on this device only/u);
  });
});
