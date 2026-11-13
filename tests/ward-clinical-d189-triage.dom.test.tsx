import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import type { TriageSignedRecord } from "@/components/ward-management/triage/triage-record";
import type { FormApi } from "@/components/ward-management/triage/triage-risk-parts";
import { ReviewBody } from "@/components/ward-management/triage/triage-risk-review";
import { SAFETY_PLAN_SERVICES, serviceText } from "@/components/ward-management/triage/triage-risk-safety";
import { SummaryDocument } from "@/components/ward-management/triage/triage-risk-sheets";
import { blankTriage, type TriageState } from "@/components/ward-management/triage/triage-risk-state";
import { perthMidnight } from "@/components/ward-management/ward-clock";

import { EXAMPLE_PERSON } from "./helpers/triage-example";

// The Triage package of the held clinical PR (D-189 item 9, Josh 13 Nov 2026), on screen: A9-29 and
// A9-20(b) on the patient card, A9-22(b) on Review details, and F-80 (D-189 item 5) in the summary.
// Synthetic data only.

const triages: { current: TriageSignedRecord[] } = { current: [] };

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/PT-SYN-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => ({ triages: triages.current, dayZero: new Date("2026-11-07T00:00:00Z") }),
}));
vi.mock("@/components/ward-management/ward-role-gate", () => ({
  useRoleGate: () => () => ({ allowed: true, buttonProps: {}, note: null }),
}));
vi.mock("@/components/ward-management/shell/ward-access", () => ({
  useCanOpenHref: () => () => true,
}));

const { PatientTriageCard } = await import("@/components/ward-management/triage/patient-triage-card");

const signedBy = (by: TriageSignedRecord["by"]): TriageSignedRecord => ({
  patientId: "PT-SYN-1",
  at: 10 * 60,
  by,
  urgency: "C",
  outcome: "Accepted",
  legal: "vol",
  review: "72h",
  riskFlags: [],
});

describe("the patient card's triage row (A9-29, A9-20(b))", () => {
  it("offers Triage while none is signed", () => {
    triages.current = [];
    render(<PatientTriageCard patientId="PT-SYN-1" />);
    expect(screen.getByTestId("patient-triage-start")).toHaveTextContent(/^Triage$/u);
  });

  it("names the desk that signed and offers Start another triage once one is signed", () => {
    triages.current = [signedBy("ed")];
    render(<PatientTriageCard patientId="PT-SYN-1" />);
    expect(screen.getByTestId("patient-triage-signed")).toHaveTextContent(/ by Sr M\. Gallagher$/u);
    expect(screen.getByTestId("patient-triage-start")).toHaveTextContent(/^Start another triage$/u);
  });
});

// 09/11/2026 11:00 on the Perth clock: the reviewed time below is before it.
const NOW = perthMidnight(2026, 10, 9).getTime() + 11 * 60 * 60_000;

function formFor(state: TriageState): FormApi {
  return {
    state,
    update: vi.fn(),
    set: vi.fn(),
    setText: vi.fn(),
    say: vi.fn(),
    isPhone: false,
    openSummary: vi.fn(),
    now: NOW,
    jump: vi.fn(),
    reviewer: "K. Vance RN",
  };
}

/** Every needed Review details answer given; Aboriginal status and Interpreter as passed. */
function reviewed(atsi: string | null, interp: string | null): TriageState {
  const blank = blankTriage(EXAMPLE_PERSON);
  return {
    ...blank,
    how: "person",
    where: "clinic",
    present: "yes",
    purpose: "Assessment",
    episode: "ED",
    atsi,
    interp,
    text: { ...blank.text, revTime: "09/11/2026 10:42" },
  };
}

describe("A9-22(b): Review details fold only when nothing is left to check", () => {
  const fields = () => document.getElementById("triage-review-fields")!;
  const line = () => within(screen.getByTestId("triage-review-line"));

  it("stays open, with no Done to fold it, while Aboriginal status or Interpreter is unanswered", () => {
    render(<ReviewBody form={formFor(reviewed(null, "no"))} editing={false} onEditing={vi.fn()} />);
    expect(fields()).not.toHaveAttribute("hidden");
    expect(line().queryByRole("button", { name: "Done" })).toBeNull();
    expect(line().queryByRole("button", { name: "Change" })).toBeNull();
  });

  it("stays open while Interpreter is unanswered", () => {
    render(<ReviewBody form={formFor(reviewed("n", null))} editing={false} onEditing={vi.fn()} />);
    expect(fields()).not.toHaveAttribute("hidden");
  });

  it("folds, with Change, once both are answered", () => {
    render(<ReviewBody form={formFor(reviewed("ns", "no"))} editing={false} onEditing={vi.fn()} />);
    expect(fields()).toHaveAttribute("hidden");
    expect(line().getByRole("button", { name: "Change" })).toHaveAttribute("aria-expanded", "false");
  });
});

describe("F-80 (D-189 item 5): crisis numbers render as copy-only text", () => {
  it("shows a crisis number with its Not checked mark and no call link", () => {
    const lifeline = SAFETY_PLAN_SERVICES.find((service) => service.name === "Lifeline")!;
    const blank = blankTriage(EXAMPLE_PERSON);
    const state: TriageState = {
      ...blank,
      text: {
        ...blank.text,
        rp: `Plan: Home with mother tonight.\nCrisis: Step 5, services: ${serviceText(lifeline)}.`,
      },
    };
    const { container } = render(
      <SummaryDocument form={formFor(state)} signed={{ at: "09/11/2026 11:00", by: "K. Vance RN" }} />,
    );
    expect(container).toHaveTextContent(`${lifeline.phone} (Not checked)`);
    expect(container.querySelector("a[href^='tel:'], a[href^='callto:'], a[href^='sms:']")).toBeNull();
    expect(container).toHaveTextContent("Signed 09/11/2026 11:00 by K. Vance RN");
  });
});
