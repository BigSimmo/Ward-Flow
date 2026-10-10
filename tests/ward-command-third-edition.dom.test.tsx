import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task C1: the Command screen's third-edition restyle carries no structural change (no panel
 * added, removed, reordered or merged), so this file pins exactly the two things a restyle CAN
 * silently break — the drawing's panel order and its per-state wording — never anything about
 * colour, radius or shadow, which no DOM test can see.
 *
 * Panels enumerated from `docs/ward-flow/mockups/command-third-edition.html` and from the source
 * (grep over `title="..."|aria-label="..."|<h[123]`, never a confirm-shaped search for names
 * already believed), in the drawing's own top-to-bottom order:
 *
 *   1. Emergency department pressure  — pressure-strip.tsx      (a per-department list)
 *   2. Priority queue                 — priority-queue.tsx
 *   3. Statewide flow                 — flow-diagram.tsx (wrapped by coordinator-screen.tsx)
 *   4. the exceptions drawer          — exception-drawer.tsx, aria-label "Declines, overrides
 *                                        and exceptions" — no heading of its own; its default
 *                                        active tab ("Exceptions") carries no `<h2>` either, which
 *                                        is exactly why "Exceptions and escalation" is asserted
 *                                        nowhere below as a panel heading (it is a `tabpanel`, not
 *                                        a top-level panel — asserting it here would fail against
 *                                        a correct screen).
 *   5. the shortlist panel            — shortlist-panel.tsx, wrapped by coordinator-screen.tsx
 *
 * ⚠️ **UPDATE, TASK C2: THE GAP ABOVE IS NOW CLOSED.** The paragraph used to read (and is kept
 * below, struck only in spirit, for the reader who wants the history): Command had no referral
 * selection concept at all, so this file tested only the one state that existed and reported the
 * second back rather than faking it. Task C2 built exactly that second state — a `Referrals` tab
 * on the priority queue (`referralQueueOrder`, the same established derivation `wardNavCounts`
 * already uses, never a second filter) and a `selectedReferralId` on `coordinator-screen.tsx`,
 * independent of `selectedMovementId` exactly as the drawing's own quoted comment describes:
 * *"Selecting the tab decides which list is on screen. It never touches `state.movementId` or
 * `state.referralId`... A coordinator can sit on the Referrals tab while the shortlist still
 * explains the last movement they opened."* The tests below prove that independence directly,
 * plus the retitle itself ("Placement" -> "Referral placement").
 *
 * A referral carries no ward (`Movement.acceptedUnitId` is the only place a destination attaches),
 * so the referral-placement view built for this renders no "referred to" text, no ward column and
 * no back-link to a unit — see `ReferralPlacementPanel` in `shortlist-panel.tsx`.
 */

const NOW = NOW_ANCHOR;

function renderCoordinator() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

describe("Command third-edition restyle — panel order and heading pins", () => {
  it("renders pressure, queue and flow, then mounts the shortlist after selection", () => {
    renderCoordinator();
    // Direction A (owner, 10 Oct 2026): the hero answers how many wait for how many beds, then the
    // ED strip (heading for screen readers), the queue, State bedflow, and Placement showing the
    // top of the queue at rest.
    const atRest = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(atRest[0]).toMatch(/^\d+ waiting, \d+ beds? ready$/u);
    expect(atRest.slice(1)).toEqual(["ED pressure", "Priority queue", "State bedflow", "Placement"]);
    expect(screen.getByTestId("ward-placement-top-of-queue")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));
    // The exceptions drawer's default tab ("Exceptions") carries no `<h2>`, and its other three
    // tabs are `hidden` (not merely visually hidden — the native `hidden` attribute, which
    // Testing Library's accessibility-tree-aware `getByRole` already excludes) until a coordinator
    // switches tabs. So a plain, unfiltered level-2-heading query is exactly the four panels this
    // test is about, in DOM order — nothing here reaches into an inactive tabpanel to manufacture
    // that count.
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.length, "expected the hero and the four headed top-level panels, found a different count").toBe(5);
    expect(headings.map((heading) => heading.textContent)).toEqual([
      atRest[0],
      "ED pressure",
      "Priority queue",
      "State bedflow",
      "Placement",
    ]);
  });

  it("reads queue, State Bedflow, then the shortlist on the far right once a patient is selected", () => {
    // Owner, 8 Oct 2026. Proven by real DOM order, asserted both ways so a reversed pair cannot pass.
    renderCoordinator();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));
    const body = screen.getByTestId("ward-coordinator-body");
    const queue = within(body).getByTestId("ward-queue-row-WF-001");
    const statewideFlow = within(body).getByLabelText("State Bedflow");
    const shortlist = within(body).getByLabelText("Placement");

    expect(
      queue.compareDocumentPosition(statewideFlow) & Node.DOCUMENT_POSITION_FOLLOWING,
      "State Bedflow must follow the priority queue",
    ).toBeTruthy();
    expect(
      statewideFlow.compareDocumentPosition(shortlist) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the shortlist panel must follow State Bedflow",
    ).toBeTruthy();
  });

  it("keeps the registers closed until the hero's Exceptions count opens them, above the columns", () => {
    renderCoordinator();
    const body = screen.getByTestId("ward-coordinator-body");
    expect(within(body).queryByTestId("ward-coordinator-registers")).toBeNull();

    const toggle = within(body).getByRole("button", { name: /Exceptions/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const registers = within(body).getByTestId("ward-coordinator-registers");
    const statewideFlow = within(body).getByLabelText("State Bedflow");
    expect(
      registers.compareDocumentPosition(statewideFlow) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the registers strip must sit above the columns",
    ).toBeTruthy();

    fireEvent.click(toggle);
    expect(within(body).queryByTestId("ward-coordinator-registers")).toBeNull();
  });

  it("keeps the shortlist panel's heading as 'Placement' once a patient is selected", () => {
    // The one state this codebase actually has (see the file comment above for the state this
    // does NOT cover). Asserted explicitly, per-state, rather than assumed unchanged from the
    // no-selection case above — a fixed-heading assumption is exactly what the brief warns is
    // wrong in one of the two drawing states, so this re-checks it after a real selection rather
    // than reasoning about it.
    renderCoordinator();
    const queueRows = screen.getAllByTestId(/^ward-queue-row-/);
    expect(queueRows.length, "expected at least one open movement in the priority queue").toBeGreaterThan(0);
    fireEvent.click(queueRows[0]!);

    const shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
  });

  it("keeps the diagram unit, candidate target, eligibility checks and override label aligned", () => {
    renderCoordinator();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));

    const scghDiagramNode = screen.getByTestId("ward-diagram-unit-scgh-adult-open");
    fireEvent.click(scghDiagramNode);

    const scghCandidate = screen.getByTestId("ward-shortlist-candidate-scgh-adult-open");
    expect(scghCandidate).toHaveAttribute("data-showing", "true");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(scghCandidate);

    expect(scghCandidate).toHaveAttribute("data-showing", "true");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "true");

    const shortlist = screen.getByLabelText("Placement");
    expect(
      within(shortlist).getByText("Eligibility checks · Mental Health Unit", { selector: "summary" }),
    ).toBeInTheDocument();

    fireEvent.click(within(shortlist).getByTestId("ward-shortlist-override-toggle"));
    expect(
      within(shortlist).getByRole("combobox", {
        name: "Reason for overriding the shortlist for Mental Health Unit",
      }),
    ).toBeInTheDocument();
  });

  it("gives every flow-diagram ED node a word for its state (never a bar or colour alone)", () => {
    renderCoordinator();
    // Anti-vacuity floor: a selector that matched nothing would otherwise pass the loop below
    // silently and prove nothing about the drawing's own no-bars rule.
    // v6 Home draws each ED as a pressure card (`ward-ed-<id>`) rather than a diagram node.
    const edNodes = screen.getAllByTestId(/^ward-ed-/);
    expect(
      edNodes.length,
      "expected at least one ED node in the flow diagram — selector matched nothing",
    ).toBeGreaterThan(0);
    for (const node of edNodes) {
      const text = node.textContent ?? "";
      // Every ED card carries a site code and name (always present) plus either "waiting" or "No
      // patients waiting" — a word, not a bare number and never a colour standing in for it.
      expect(text, `ED node ${node.getAttribute("data-testid")} carries no waiting word: "${text}"`).toMatch(
        /waiting/i,
      );
    }
  });

  it("draws every live inpatient unit on State Bedflow (Wave 4 item 32 / R2-16)", async () => {
    const { allUnits } = await import("@/components/ward-management/ward-sites");
    renderCoordinator();
    const unitNodes = screen.getAllByTestId(/^ward-diagram-unit-/);
    expect(unitNodes.length).toBe(allUnits().length);
  });
});

/**
 * Task C2. The priority queue's own two tabs — `Patients` and `Referrals` — and the shortlist's
 * independent subject state, once a referral is selected.
 *
 * The population is the established derivation, cross-checked here against the real fixture
 * rather than trusted: `referralQueueOrder` (`ward-referrals.ts`) is `referralState(referral) ===
 * "queued"`, sorted `urgency` then `raisedAt`, and nothing here re-derives that filter or that
 * sort a second time.
 */
describe("Command's priority queue carries a Patients/Referrals tablist (Task C2)", () => {
  it("renders a Queues tablist with two tabs, each carrying the real count of its own rows", () => {
    renderCoordinator();

    // v6 Home (7 Oct 2026): the Queues choice is a segmented radiogroup, not a tablist.
    const tablist = screen.getByRole("radiogroup", { name: "Queues" });
    const patientsTab = within(tablist).getByRole("radio", { name: /Patients/ });
    const referralsTab = within(tablist).getByRole("radio", { name: /Referrals/ });

    // Anti-vacuity floor — a selector matching nothing would let every assertion below pass on an
    // empty queue and prove nothing about the real tab wiring.
    const patientRows = screen.getAllByTestId(/^ward-queue-row-/);
    const referralRows = screen.getAllByTestId(/^ward-referral-row-/);
    expect(patientRows.length, "expected at least one open movement in the Patients tab").toBeGreaterThan(0);
    expect(referralRows.length, "expected at least one queued referral in the Referrals tab").toBeGreaterThan(0);

    expect(patientsTab, "the Patients tab must carry the real row count, not an invented figure").toHaveTextContent(
      String(patientRows.length),
    );
    expect(referralsTab, "the Referrals tab must carry the real row count, not an invented figure").toHaveTextContent(
      String(referralRows.length),
    );

    // The population and its order are `referralQueueOrder`'s own — never a second filter or sort
    // written down here. Read from the full seeded state (seedWardFlowState().referrals), not the
    // raw ward-movements.ts fixture: seedWardFlowState() additively overlays demonstration referrals
    // (ward-rulings-demo.ts), which include RF-RD06, added 2026-09-25 and queued — the same
    // population CoordinatorScreen itself renders from.
    const expectedIds = referralQueueOrder(seedWardFlowState().referrals).map(
      (referral) => `ward-referral-row-${referral.id}`,
    );
    expect(referralRows.map((row) => row.getAttribute("data-testid"))).toEqual(expectedIds);
  });

  it("moves focus and selection between the two tabs with the arrow keys, and marks the active one", () => {
    renderCoordinator();

    const patientsTab = screen.getByRole("radio", { name: /Patients/ });
    const referralsTab = screen.getByRole("radio", { name: /Referrals/ });
    expect(patientsTab).toHaveAttribute("aria-checked", "true");
    expect(referralsTab).toHaveAttribute("aria-checked", "false");

    patientsTab.focus();
    fireEvent.keyDown(patientsTab, { key: "ArrowRight" });

    expect(referralsTab).toHaveAttribute("aria-checked", "true");
    expect(patientsTab).toHaveAttribute("aria-checked", "false");
    expect(referralsTab, "focus follows selection, the same convention the registers tabs use").toHaveFocus();

    fireEvent.keyDown(referralsTab, { key: "ArrowLeft" });
    expect(patientsTab).toHaveAttribute("aria-checked", "true");
    expect(patientsTab).toHaveFocus();
  });

  it("keeps a selected referral's fields off the destination it never carries — no ward, no 'referred to'", () => {
    renderCoordinator();
    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));
    const referralRows = screen.getAllByTestId(/^ward-referral-row-/);
    fireEvent.click(referralRows[0]!);

    const placement = screen.getByLabelText("Referral placement");
    expect(placement.textContent, "a referral names no ward — this must never render one").not.toMatch(
      /referred to|destination:/i,
    );
  });

  it("switching queue tabs never changes the shortlist's subject — tab state and subject state are independent", () => {
    renderCoordinator();

    // Select a movement first: the shortlist explains it under "Placement".
    const movementRows = screen.getAllByTestId(/^ward-queue-row-/);
    fireEvent.click(movementRows[0]!);
    const movementId = movementRows[0]!.getAttribute("data-testid")!.replace("ward-queue-row-", "");

    let shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    expect(within(shortlist).getByTestId(`ward-shortlist-${movementId}`)).toBeInTheDocument();

    // Switching to the Referrals tab decides which LIST is on screen — it must not touch which
    // record the shortlist is explaining.
    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));
    shortlist = screen.getByLabelText("Placement");
    expect(
      within(shortlist).getByTestId(`ward-shortlist-${movementId}`),
      "the shortlist must still explain the same movement after a tab switch",
    ).toBeInTheDocument();

    // Selecting a referral row sets the shortlist's subject to that referral and retitles the
    // panel — the second half of this task, closing the gap this file used to document.
    const referralRows = screen.getAllByTestId(/^ward-referral-row-/);
    fireEvent.click(referralRows[0]!);
    const referralId = referralRows[0]!.getAttribute("data-testid")!.replace("ward-referral-row-", "");

    shortlist = screen.getByLabelText("Referral placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Referral placement");
    expect(within(shortlist).getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();

    // Switching back to Patients must not silently hand the shortlist back to the movement either
    // — the referral stays the subject until a movement (or another referral) is explicitly
    // selected, exactly the independence the drawing's own comment describes.
    fireEvent.click(screen.getByRole("radio", { name: /Patients/ }));
    shortlist = screen.getByLabelText("Referral placement");
    expect(
      within(shortlist).getByTestId(`ward-referral-placement-${referralId}`),
      "a tab switch must never hand the shortlist back to the movement on its own",
    ).toBeInTheDocument();

    // Selecting a movement is what hands the shortlist back — proven, not assumed.
    fireEvent.click(movementRows[0]!);
    shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    expect(within(shortlist).getByTestId(`ward-shortlist-${movementId}`)).toBeInTheDocument();
  });
});
