import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockBack = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/WF-009",
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: mockBack,
    prefetch: vi.fn(),
  }),
}));

function setCanGoBack(value: boolean | undefined) {
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: value === undefined ? undefined : { canGoBack: value },
  });
}

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { movementById, referrals } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, edById, unitById } from "@/components/ward-management/ward-sites";
import { clock } from "@/components/ward-management/patients/patient-now-records";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

function expectedPatient(id: string) {
  const state = seedWardFlowState();
  return resolveSubjectPatient(
    state.movements.find((movement) => movement.id === id)!,
    state,
  );
}

/**
 * Antigravity built this screen (`docs/ward-flow-task-ledger.md` §7.7 does not name it directly,
 * but it is the route's default renderer at `/mockups/ward-flow/people/[patientId]`) and left it
 * uncommitted; this file proves what it renders now that the ward/site names it states are read
 * from `ward-sites.ts` rather than typed a second time (`tests/ward-flow-data-boundary.test.ts`)
 * and the "every figure is invented" disclosure carries its own marker sentence
 * (`tests/ward-provenance-sentences-carry-their-own-marker.test.ts`).
 *
 * P1-1/P1-2 (owner, 2026-09-17): a `movementId`/`patientId` this screen holds no record for must
 * never fall back to showing WF-009's story, and the legal form and its deadline must come from
 * the live movement — never a hand-written code or a `now + <offset>` clock. Both are proved
 * below, alongside the routing-level fix in `page.tsx` that keeps an unknown id off this screen
 * entirely.
 */
function renderScreen(props: Parameters<typeof PatientNowScreen>[0] = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen {...props} />
    </WardFlowProvider>,
  );
}

async function renderPersonRoute(
  id: string,
  searchParams: Record<string, string | undefined> = {},
): Promise<ReactElement> {
  const { default: WardPersonPage } = await import("@/app/mockups/ward-flow/people/[patientId]/page");
  const element = await WardPersonPage({
    params: Promise.resolve({ patientId: id }),
    searchParams: Promise.resolve(searchParams),
  });
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{element as ReactElement}</WardFlowProvider>);
  return element as ReactElement;
}

function explicitIdentity(id: string) {
  const movement = movementById(id)!;
  const patientId = movement.patientId ?? referrals.find((referral) => referral.id === movement.referralId)?.patientId;
  const patient = wardPatients.find((item) => item.id === patientId);
  return patient ? `${patient.familyName}, ${patient.givenName}` : "Patient not recorded";
}

describe("the patient-now screen", () => {
  it("keeps the summary guidance and movement destination together when switching records", () => {
    const { unmount } = renderScreen({ movementId: "WF-009" });
    let summary = within(screen.getByRole("region", { name: "Patient summary" }));
    expect(summary.getByRole("region", { name: /Next steps/ })).toHaveTextContent(
      "Review next cohort-matching bed releases across network.",
    );
    expect(summary.getByRole("button", { name: "Place them" })).toBeInTheDocument();
    unmount();

    renderScreen({ movementId: "WF-004" });
    summary = within(screen.getByRole("region", { name: "Patient summary" }));
    expect(summary.getByRole("region", { name: /Next steps/ })).toHaveTextContent("Bed Pull Confirmation");
    expect(summary.getByRole("button", { name: "Place them" })).toBeInTheDocument();
  });

  // Owner ruling & user request: remove obsolete movement record / perspective switchers and purge WF ids
  it("removes the obsolete movement record switcher and purges synthetic WF ids from user labels", () => {
    renderScreen();
    expect(screen.queryByRole("group", { name: "Movement record" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Perspective view" })).not.toBeInTheDocument();
    for (const id of ["WF-009", "WF-004"]) {
      expect(screen.queryByRole("button", { name: id })).not.toBeInTheDocument();
      expect(screen.queryByText(new RegExp(`\\(${id}\\)`, "u"))).not.toBeInTheDocument();
    }
  });

  it("does not offer an invalid movement link for a person without a linked movement", () => {
    // PT-005 has no record of any kind since the seed-link work (T1-T3, 25 Sept 2026) gave PT-001 one.
    renderScreen({ patientId: "PT-005" });
    const summary = within(screen.getByRole("region", { name: "Patient summary" }));
    expect(summary.getByText("No next steps recorded.")).toBeInTheDocument();
    expect(summary.queryByRole("link", { name: "Open the movement" })).not.toBeInTheDocument();
  });

  it("distinguishes a patient record without asserting active community care", () => {
    renderScreen({ patientId: "PT-005" });
    const root = screen.getByTestId("ward-person-screen");
    expect(within(root).getByRole("link", { name: "+ Raise Inpatient Referral" })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/referrals/new?patientId=PT-005",
    );
    expect(screen.getByTestId("ward-community-masthead")).toBeInTheDocument();
    expect(screen.getByTestId("ward-community-overview-card")).toBeInTheDocument();
    expect(root).toHaveAttribute("data-bedflow", "inactive");
    expect(within(root).getByText("NOT IN LIVE BEDFLOW")).toBeInTheDocument();
    expect(within(root).queryByText("Sarah Jenkins, RN (CNS)")).not.toBeInTheDocument();
    expect(within(root).getByRole("heading", { name: "Record at a glance" })).toBeInTheDocument();
    fireEvent.click(within(root).getByRole("button", { name: "View patient details" }));
    expect(within(root).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  });

  it("has the page shell for the default movement record (WF-009)", () => {
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("data-ward-design", "v6");
    // Scoped to the identity block — the "Details" tab pane also states the name, present in the
    // DOM but visually hidden, so an unscoped query throws on multiple matches.
    expect(
      within(screen.getByTestId("ward-person-identity")).getByText(explicitIdentity("WF-009")),
    ).toBeInTheDocument();
    expect(within(root).queryByText("Cannot be moved. Two things are missing.")).not.toBeInTheDocument();
    expect(within(root).queryByText("All gates cleared")).not.toBeInTheDocument();
    expect(within(root).queryByText("Ready for transfer")).not.toBeInTheDocument();
    expect(within(root).getByText("Transfer readiness not assessed here")).toBeInTheDocument();
  });

  it("states ward and emergency department names read from the data layer, not typed a second time", () => {
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    // Proves the fix live, not just statically: the exact strings ward-sites.ts owns for these
    // ids are what actually renders, so a rename there would be caught by this test moving with it.
    const movement = movementById("WF-009")!;
    expect(within(root).getAllByText(edById(movement.originEdId)!.name).length).toBeGreaterThan(0);
    if (movement.acceptedUnitId) {
      expect(within(root).getAllByText(unitById(movement.acceptedUnitId)!.name).length).toBeGreaterThan(0);
    }
  });

  it("declares every figure invented, with the marker bound inside the sentence itself", () => {
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    expect(within(root).getByText(/on this screen is invented/i)).toBeInTheDocument();
    expect(within(root).getByText(/nobody here is a real person/i)).toBeInTheDocument();
  });

  it("switches to WF-004 and displays its explicitly linked identity", () => {
    renderScreen({ movementId: "WF-004" });
    const root = screen.getByTestId("ward-person-screen");
    expect(within(root).queryByText("Nothing is holding this movement up.")).not.toBeInTheDocument();
    expect(within(root).getByText("Transfer readiness not assessed here")).toBeInTheDocument();
    expect(within(root).queryByText("Cannot be moved. Two things are missing.")).not.toBeInTheDocument();
    // P1-1: WF-004 is its own person, not WF-009's story replayed under a different button.
    expect(
      within(screen.getByTestId("ward-person-identity")).getByText(explicitIdentity("WF-004")),
    ).toBeInTheDocument();
  });

  it("does not retain a person route's identity when switching to another person's movement", () => {
    // Since the seed-link work (T1-T3, 25 Sept 2026) every movement names a patient, so the switch
    // is to WF-004, which belongs to someone else (PT-046), from PT-005, who has no record at all.
    const original = wardPatients.find((patient) => patient.id === "PT-005")!;
    const movement = movementById("WF-004")!;
    expect(movement.patientId).toBeDefined();
    expect(movement.patientId).not.toBe(original.id);
    const { rerender } = renderScreen({ patientId: original.id });
    const root = screen.getByTestId("ward-person-screen");
    expect(within(root).getAllByText(original.umrn).length).toBeGreaterThan(0);
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-004" />
      </WardFlowProvider>,
    );
    expect(within(root).queryByText(original.umrn)).not.toBeInTheDocument();
    expect(within(root).queryByText(original.dateOfBirth)).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("ward-person-identity")).getByText(explicitIdentity("WF-004")),
    ).toBeInTheDocument();
  });

  it("shows the person's recorded catchment without inventing a movement age band or owner", () => {
    // PT-005 has no record of any kind since the seed-link work (T1-T3, 25 Sept 2026) gave PT-001 one.
    const patient = wardPatients.find((item) => item.id === "PT-005")!;
    renderScreen({ patientId: patient.id });
    fireEvent.click(screen.getByRole("tab", { name: /Details/u }));
    const pane = document.getElementById("pnpane-details")!;
    const fact = (label: string) => within(pane).getByText(label, { selector: "dt" }).nextElementSibling;
    expect(fact("Catchment community team")).toHaveTextContent(patient.catchmentCommunityTeam!);
    expect(fact("Age band")).toHaveTextContent("Not recorded");
    expect(within(pane).queryByText("Health service", { selector: "dt" })).not.toBeInTheDocument();
    expect(fact("Owner")).toHaveTextContent("Not recorded");
  });

  it("does not mark earlier stages complete when a later-stage fixture has no transition history", () => {
    const movement = movementById("WF-004")!;
    expect(movement.stageChanges).toEqual([]);
    expect(movement.stage).not.toBe("referred");
    renderScreen({ movementId: movement.id });
    const journey = screen.getByRole("list", { name: /The seven stages/ });
    expect(journey.querySelector('[data-s="done"]')).toBeNull();
    expect(journey.querySelector('[data-s="recorded"]')).toBeNull();
    expect(journey.querySelector('[data-s="now"]')).toHaveTextContent("since opened");
    expect(journey).not.toHaveTextContent(/ here/);
    expect(within(journey).queryByText("Recorded", { exact: true })).not.toBeInTheDocument();
  });

  it("switches tabs and renders the History panel's presentations", () => {
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    fireEvent.click(within(root).getByRole("tab", { name: /History/u }));
    const historyPane = document.getElementById("pnpane-history");
    expect(historyPane).not.toBeNull();
    expect(historyPane).not.toHaveAttribute("hidden");
    expect(within(historyPane as HTMLElement).getByText("Presentations")).toBeInTheDocument();
  });

  it("every control is a real link or a wired button — none says 'Not wired in this prototype'", () => {
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    expect(within(root).queryByText(/not wired in this prototype/iu)).not.toBeInTheDocument();
  });

  it("uses resolved WF-004 details without the old unrelated fallback identity", () => {
    renderScreen({ movementId: "WF-004" });
    const root = screen.getByTestId("ward-person-screen");
    fireEvent.click(within(root).getByRole("tab", { name: /Details/u }));
    const detailsPane = document.getElementById("pnpane-details") as HTMLElement;
    // Every one of these was a hand-invented fallback shown as if it were this person's own
    // record, sourced from an unrelated `patients[0]` this movement has no link to at all.
    expect(within(detailsPane).queryByText(/No\. 14, Mandurah/i)).not.toBeInTheDocument();
    expect(within(detailsPane).queryByText(/Dr K\. Sunder/i)).not.toBeInTheDocument();
    expect(
      within(detailsPane).queryByText(/Involuntary patient under the Mental Health Act 2014/i),
    ).not.toBeInTheDocument();
    expect(within(detailsPane).queryByText("UM100009")).not.toBeInTheDocument();
    expect(within(detailsPane).queryByText("1988-03-14")).not.toBeInTheDocument();
    expect(within(root).queryByText(/Gender identity is not held separately/i)).not.toBeInTheDocument();
    // The same resolved prototype identity is used in the detail pane and operational lists.
    expect(within(detailsPane).getByText("Record number", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      expectedPatient("WF-004").patient?.umrn ?? "Not recorded",
    );
  });

  it("WF-004 shows the live movement's own legal form and its typed deadline, never a computed one", () => {
    renderScreen({ movementId: "WF-004" });
    const root = screen.getByTestId("ward-person-screen");

    const movement = movementById("WF-004")!;
    expect(movement.legalForm).toBeDefined();
    expect(movement.legalForm!.dueAt).toBeDefined();
    // The live fixture carries Form 4C, not the screen's old hand-written "Form 4A" — proving
    // this against the fixture itself means a future change to WF-004's authored form is caught
    // here rather than leaving a stale expectation green.
    const expectedFormName = legalFormName(movement.legalForm!);
    const expectedDue = clock(movement.legalForm!.dueAt!);

    expect(within(root).getAllByText(new RegExp(expectedFormName.replace(/[()]/g, "\\$&"))).length).toBeGreaterThan(0);
    expect(within(root).getAllByText(new RegExp(expectedDue)).length).toBeGreaterThan(0);
    expect(within(root).queryByText(/Form 4A/)).not.toBeInTheDocument();
    // D5: no legal time on this screen is computed from `now`.
    expect(within(root).queryByText("12:42")).not.toBeInTheDocument();
  });

  it("provides an accessible back arrow button that links back contextually", () => {
    mockBack.mockClear();
    mockReplace.mockClear();
    setCanGoBack(true);
    renderScreen();
    const root = screen.getByTestId("ward-person-screen");
    const backBtn = within(root).getByTestId("ward-patient-back-button");
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute("href", "/mockups/ward-flow");
    expect(backBtn).toHaveAttribute("aria-label", "Back to previous page");

    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    // Direct entry fallback
    mockBack.mockClear();
    mockReplace.mockClear();
    setCanGoBack(false);
    fireEvent.click(backBtn);
    expect(mockReplace).toHaveBeenCalledWith("/mockups/ward-flow");
  });
});

describe("the ward person route", () => {
  it("renders the governed PersonScreen for an id PATIENT_NOW_RECORDS holds no story for", async () => {
    await renderPersonRoute("PT-9999-does-not-exist");
    expect(screen.getByTestId("ward-person-missing")).toBeInTheDocument();
    // `PersonScreen` and `PatientNowScreen` share the `ward-person-screen` root testid (a
    // pre-existing overlap), so the identity block — which `PatientNowScreen` renders
    // unconditionally and `PersonScreen`'s "no such person" branch never does — is what proves
    // the rich synthetic screen did not render WF-009's story under this unrelated id.
    expect(screen.queryByTestId("ward-person-identity")).not.toBeInTheDocument();
  });

  it("renders the dynamic PatientNowScreen for a live WF- movement not in PATIENT_NOW_RECORDS", async () => {
    await renderPersonRoute("WF-005");
    expect(screen.queryByTestId("ward-person-missing")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-person-identity")).toBeInTheDocument();
    // WF-005 names its patient since the seed-link work, so the identity is that person, not the id.
    expect(
      within(screen.getByTestId("ward-person-identity")).getByText(explicitIdentity("WF-005")),
    ).toBeInTheDocument();
  });

  it("renders the governed PersonScreen for an unknown WF- id that does not exist in movements", async () => {
    await renderPersonRoute("WF-9999-does-not-exist");
    expect(screen.getByTestId("ward-person-missing")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-person-identity")).not.toBeInTheDocument();
  });

  it("renders the live linked identity at a movement id", async () => {
    await renderPersonRoute("WF-009");
    expect(
      within(screen.getByTestId("ward-person-identity")).getByText(explicitIdentity("WF-009")),
    ).toBeInTheDocument();
  });

  it("renders the governed PersonScreen when ?view=governed is requested", async () => {
    await renderPersonRoute("WF-004", { view: "governed" });
    expect(screen.queryByRole("group", { name: "Example patient" })).not.toBeInTheDocument();
  });
});

describe("the written history on a sample scenario is labelled as an example", () => {
  it("shows an Example history label beside the presentations it lists (Josh, 25 Sept 2026)", () => {
    renderScreen();
    expect(screen.getByTestId("pn-history-example-label").textContent).toBe("Example history");
  });
});
