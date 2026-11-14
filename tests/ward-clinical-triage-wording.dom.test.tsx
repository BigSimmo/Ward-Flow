import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { patientKeyFor } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { DecisionBody } from "@/components/ward-management/triage/triage-risk-decision";
import { HowToDrawer } from "@/components/ward-management/triage/triage-risk-how";
import { MentalStateBody } from "@/components/ward-management/triage/triage-risk-mse";
import type { FormApi } from "@/components/ward-management/triage/triage-risk-parts";
import { legalLine, recordLegalStatus, wardStayFacts } from "@/components/ward-management/triage/triage-risk-people";
import { PlanBody } from "@/components/ward-management/triage/triage-risk-risk";
import { SummaryDrawer } from "@/components/ward-management/triage/triage-risk-sheets";
import { blankTriage, type TriageState } from "@/components/ward-management/triage/triage-risk-state";
import { TriageScreen } from "@/components/ward-management/triage/triage-risk-form";
import { useTriagePeople } from "@/components/ward-management/triage/use-triage-people";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

import { EXAMPLE_PERSON, exampleTriage, SIGNED_RECORD_WORDS } from "./helpers/triage-example";

// The Triage wording of D-186 (Q10, Q11, Q14), D-187 (TW-198 and the D-186 rows it keeps), A9-22(d)
// and review question 6, drawn on screen. These replace checks that read the Triage source as text
// (source-text ratchet, CQ-10). Wording and display only; no clinical value changes. Synthetic data only.

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/triage/new",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const NOW = NOW_ANCHOR;

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

const world = ({ children }: { children: ReactNode }) => (
  <WardFlowProvider initialNow={NOW_ANCHOR}>
    <ToastProvider>{children}</ToastProvider>
  </WardFlowProvider>
);

/** The banner's people, beside the state they were read from. */
function triagePeople() {
  const { result } = renderHook(() => ({ triage: useTriagePeople(), flow: useWardFlow() }), { wrapper: world });
  return result.current;
}

describe("D-186 Q10 and review R9: the banner reads the stay, else the patient page's legal reading", () => {
  it("reads a ward stay's ward and legal status for a person with no open movement", () => {
    const { triage, flow } = triagePeople();
    const record = { ...flow, plannedAdmissions: flow.plannedAdmissions };
    const onStay = flow.patients.flatMap((patient) => {
      if (patientKeyFor(patient.id, flow)?.startsWith("WF-")) return [];
      const facts = wardStayFacts(patient.id, record, flow.now);
      return facts ? [{ patient, facts }] : [];
    });
    expect(onStay.length).toBeGreaterThan(0);
    for (const { patient, facts } of onStay) {
      const person = triage.byId.get(patient.id)!;
      expect(person.nowAt, patient.id).toBe(facts.origin);
      expect(person.legal, patient.id).toBe(facts.legalStatus === "Not recorded" ? null : facts.legalStatus);
    }
  });

  it("reads the patient page's legal status for a person with an open movement", () => {
    const { triage, flow } = triagePeople();
    const moving = flow.patients.flatMap((patient) => {
      const key = patientKeyFor(patient.id, flow);
      return key?.startsWith("WF-") ? [{ patient, key }] : [];
    });
    expect(moving.length).toBeGreaterThan(0);
    for (const { patient, key } of moving) {
      const status = recordLegalStatus(key, flow, flow.now);
      expect(triage.byId.get(patient.id)!.legal, patient.id).toBe(status === "Not recorded" ? null : status);
    }
  });
});

describe('D-186 Q11: "Chosen today" on the form, "On record" on the chip', () => {
  it("labels the banner figure as today's choice, never a bare Legal", () => {
    const { triage } = triagePeople();
    const person = triage.people.find((candidate) => candidate.legal)!;
    render(<TriageScreen patientId={person.id} />, { wrapper: world });
    expect(screen.getAllByText("Legal, chosen today").length).toBeGreaterThan(0);
    // No figure on the page is labelled a bare "Legal" (the closed drawers draw nothing).
    expect(screen.queryByText("Legal", { exact: true })).toBeNull();
    expect(screen.getAllByText(person.legalTag).length).toBeGreaterThan(0);
  });

  it("reads Legal on record, not recorded and not checked, for a person with no status on record", () => {
    const { triage } = triagePeople();
    const person = triage.people.find((candidate) => !candidate.legal);
    expect(person, "a seed person with no legal status on record").toBeDefined();
    render(<TriageScreen patientId={person!.id} />, { wrapper: world });
    expect(screen.getAllByText("Legal on record").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recorded. Not legally checked.").length).toBeGreaterThan(0);
  });

  it("prints the page foot's one entry", () => {
    const { triage } = triagePeople();
    render(<TriageScreen patientId={triage.people[0]!.id} />, { wrapper: world });
    expect(screen.getByText(/One entry prints as SMHMR900 and SMHMR905\.$/u)).toBeInTheDocument();
  });

  function drawer(tab: string, state: TriageState) {
    render(
      <SummaryDrawer
        form={formFor(state)}
        open
        tab={tab}
        onTab={vi.fn()}
        onClose={vi.fn()}
        reqs={[]}
        jump={vi.fn()}
        signButton={null}
      />,
    );
    return within(screen.getByTestId("triage-summary-sheet"));
  }

  it("reads the record's status as on record in Patient and referral", () => {
    const sheet = drawer("patient", blankTriage(EXAMPLE_PERSON));
    expect(sheet.getByText(legalLine(EXAMPLE_PERSON))).toBeInTheDocument();
  });

  it("reads Not recorded in Patient and referral when the record holds no status", () => {
    const sheet = drawer("patient", blankTriage({ ...EXAMPLE_PERSON, legal: null }));
    expect(sheet.getByText("Not recorded. Not legally checked.")).toBeInTheDocument();
  });

  it('reads an earlier triage\'s status "as chosen"', () => {
    const sheet = drawer("prev", blankTriage(EXAMPLE_PERSON));
    const row = within(sheet.getByTestId("triage-previous-list"));
    expect(row.getByText(new RegExp(`${EXAMPLE_PERSON.last!.legal} \\(as chosen\\)`, "u"))).toBeInTheDocument();
    expect(sheet.queryByText(/as chosen then/u)).toBeNull();
  });
});

describe("D-186 Q14: How to names every field signing saves", () => {
  it("lists them on What gets saved, and no longer says only the review date and flags", () => {
    render(<HowToDrawer open onClose={vi.fn()} onStartNew={vi.fn()} onGoTo={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "What gets saved" }));
    const sheet = screen.getByTestId("triage-how-sheet");
    const text = (sheet.textContent ?? "").replace(/\s+/gu, " ").toLowerCase();
    for (const words of Object.values(SIGNED_RECORD_WORDS))
      if (words !== "patient record") expect(text, words).toContain(words);
    expect(text).toContain("problems, actions, venue and referral type");
    expect(text).not.toContain("review date and the risk flags marked present go on");
  });
});

describe("A9-22(d): the mental state box says how a line counts", () => {
  it("asks for the domain's name and a colon", () => {
    render(<MentalStateBody form={formFor({ ...blankTriage(EXAMPLE_PERSON), mseMode: "box" })} />);
    expect(
      screen.getByText("One line per domain. Start each line with the domain's name and a colon, as in Speech:"),
    ).toBeInTheDocument();
  });
});

describe("Review question 6: the follow-up and review windows carry the see-by window's mark", () => {
  it("marks Follow-up and its hint Window not signed", () => {
    // Referred on shows Follow-up; the example marks current risk, so the follow-up hint shows too.
    render(<DecisionBody form={formFor({ ...exampleTriage(), outcome: "Referred on", followUp: null })} />);
    expect(screen.getByTestId("triage-follow-up-unsigned")).toHaveTextContent(/^Window not signed\.$/u);
    expect(screen.getByTestId("triage-hint-unsigned")).toHaveTextContent(/^Window not signed\.$/u);
  });

  it("marks Review risk by Window not signed", () => {
    render(<PlanBody form={formFor(exampleTriage())} />);
    expect(screen.getByTestId("triage-review-unsigned")).toHaveTextContent(/^Window not signed\.$/u);
  });
});
