import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
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
 * Panels enumerated from `design/third-edition-mockups/command-third-edition.html` and from the source
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

/** Home opens on Needs you (Home flow, Q340/Q341/Q345, 3 Nov 2026). */
function renderHome() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

/** The Flow list: one Card, one section per stage, each stage capped at 5 rows behind "Show all N". */
function flowCard(): HTMLElement {
  return screen.getByRole("region", { name: "Flow" });
}

/** Switches Home to Flow and opens every stage's "Show all N", as a coordinator would. */
function showWholeFlow(): void {
  const flow = within(screen.getByRole("radiogroup", { name: "Home list" })).getByRole("radio", { name: /^Flow/u });
  if (flow.getAttribute("aria-checked") !== "true") fireEvent.click(flow);
  for (const showAll of within(flowCard()).queryAllByRole("button", { name: /^Show all \d+$/u })) {
    if (showAll.getAttribute("aria-expanded") !== "true") fireEvent.click(showAll);
  }
}

function renderCoordinator() {
  const result = renderHome();
  // Home flow (Josh, 3 Nov 2026): the queue is the Flow list, grouped by stage with 5 rows per
  // stage behind "Show all N"; this suite reads rows further down, so it opens every stage first.
  showWholeFlow();
  return result;
}

describe("Command third-edition restyle — panel order and heading pins", () => {
  it("renders pressure, queue and Beds that fit, then mounts the shortlist after selection", () => {
    renderCoordinator();
    // Direction A (owner, 10 Oct 2026): the hero answers how many wait for how many beds, then the
    // ED strip (heading for screen readers) and the queue. Home v7 (Josh, 22 Oct 2026): State
    // bedflow moved to Capacity, Beds that fit takes its place, and Placement previews nobody.
    const atRest = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(atRest[0]).toMatch(/^\d+ open ED movements, \d+ beds? ready$/u);
    // Open ED journeys retain accountability through transit; the queue can also contain ward/community origins.
    // Home and Activity (Josh, 31 Oct 2026): "in transit" as the phone says it, and the demo
    // coverage disclosure lives in the app bar and the footer, so the hero keeps only its facts.
    expect(screen.getByTestId("ward-home-ed-population")).toHaveTextContent(
      /^\d+ still in ED · \d+ in transit( · (At risk )?\d+\.\d%( beds in use)?)?$/u,
    );
    // Home flow (Josh, 3 Nov 2026): the queue is the Flow card, a named region with one section per
    // stage and no heading of its own; Later today sits at the foot of the right column on desktop.
    expect(atRest.slice(1)).toEqual(["ED pressure", "Beds that fit", "Placement", "Later today"]);
    // The queue panel itself, pinned by its accessible name and DOM place: after ED pressure and
    // before Beds that fit, with its stages in the order a person moves through them.
    const flow = flowCard();
    const edPressure = screen.getByRole("heading", { level: 2, name: "ED pressure" });
    const bedsThatFit = screen.getByRole("heading", { level: 2, name: "Beds that fit" });
    expect(edPressure.compareDocumentPosition(flow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(flow.compareDocumentPosition(bedsThatFit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(flow)
        .getAllByRole("region")
        .map((section) => section.getAttribute("aria-label")),
    ).toEqual(["Needs a bed", "Bed agreed", "Ready to move", "Moving"]);
    expect(within(flow).getByText("Oldest first in each stage")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-placement-top-of-queue")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));
    // The exceptions drawer's default tab ("Exceptions") carries no `<h2>`, and its other three
    // tabs are `hidden` (not merely visually hidden — the native `hidden` attribute, which
    // Testing Library's accessibility-tree-aware `getByRole` already excludes) until a coordinator
    // switches tabs. So a plain, unfiltered level-2-heading query is exactly the hero and the three
    // headed panels this test is about, in DOM order — nothing here reaches into an inactive
    // tabpanel to manufacture that count.
    const headings = screen.getAllByRole("heading", { level: 2 });
    // Later today steps aside while Placement is open, so Placement keeps the whole right column.
    expect(headings.length, "expected the hero and the three headed top-level panels, found a different count").toBe(4);
    expect(headings.map((heading) => heading.textContent)).toEqual([
      atRest[0],
      "ED pressure",
      "Beds that fit",
      "Placement",
    ]);
    expect(screen.queryByTestId("home-placement-prompt")).not.toBeInTheDocument();
  });

  it("reads the queue, then opens Placement as a drawer once a patient is selected", () => {
    // Owner, 8 Oct 2026. Proven by real DOM order. Home v7 (Josh, 22 Oct 2026): State bedflow is
    // no longer on Home; it sits at the foot of Capacity.
    renderCoordinator();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));
    const body = screen.getByTestId("ward-coordinator-body");
    const queue = within(body).getByTestId("ward-queue-row-WF-001");
    // H7 (Josh, 3 Nov 2026): Placement opens as the patient drawer over Home, like the Capacity
    // pop-up, so the queue stays on the page behind it rather than sharing a column order.
    const shortlist = screen.getByLabelText("Placement");

    expect(within(body).queryByLabelText("State Bedflow")).not.toBeInTheDocument();
    expect(queue).toBeInTheDocument();
    expect(screen.getByTestId("home-placement-drawer")).toContainElement(shortlist);
  });

  it("keeps the registers closed until Registers opens them, above the columns", () => {
    // Home v7 (Josh, 22 Oct 2026): the hero's Alerts count became Act now, so the registers open
    // from Registers above the list, still as the strip under the hero. Home flow (Josh, 3 Nov
    // 2026): Registers moved into the "More for this list" menu at the end of the Home lists row.
    renderCoordinator();
    const body = screen.getByTestId("ward-coordinator-body");
    expect(within(body).queryByTestId("ward-coordinator-registers")).toBeNull();

    const lists = within(body).getByRole("navigation", { name: "Home lists" });
    const more = within(lists).getByRole("button", { name: "More for this list" });
    const chooseRegisters = () => {
      expect(more).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(more);
      expect(more).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(screen.getByRole("menuitem", { name: "Registers" }));
      expect(more, "choosing Registers closes the menu").toHaveAttribute("aria-expanded", "false");
    };

    chooseRegisters();
    const registers = within(body).getByTestId("ward-coordinator-registers");
    const columns = within(body).getByTestId("ward-coordinator-region-grid");
    expect(
      registers.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the registers strip must sit above the columns",
    ).toBeTruthy();

    chooseRegisters();
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

  it("keeps the candidate target, eligibility checks and override label aligned", () => {
    renderCoordinator();
    fireEvent.click(screen.getByTestId("ward-queue-row-WF-001"));

    // Home v7 (Josh, 22 Oct 2026): State bedflow left Home, so the ward is chosen in Placement.
    const scghCandidate = screen.getByTestId("ward-shortlist-candidate-scgh-adult-open");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(scghCandidate);

    expect(scghCandidate).toHaveAttribute("data-showing", "true");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "true");

    const shortlist = screen.getByLabelText("Placement");
    expect(
      within(shortlist).getByText("Eligibility checks · Mental Health Unit", { selector: "summary" }),
    ).toBeInTheDocument();

    // H7 (Josh, 3 Nov 2026): Refer and Override sit in the drawer's pinned foot, outside its body.
    fireEvent.click(screen.getByTestId("ward-shortlist-override-toggle"));
    expect(
      screen.getByRole("combobox", {
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

  it("no longer draws State Bedflow on Capacity; every ward is on the bed map instead", () => {
    // Capacity issue 7 (Josh, 3 Nov 2026): State bedflow repeated the bed map, so it left Capacity.
    // Its one extra figure, beds freeing today, now sits on each bed map card.
    render(
      <WardFlowProvider initialNow={NOW}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    expect(screen.queryAllByTestId(/^ward-diagram-unit-/)).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Bed map" })).toBeInTheDocument();
  });
});

/**
 * Task C2. The priority queue's own two tabs — `Patients` and `Referrals` — and the shortlist's
 * independent subject state, once a referral is selected.
 *
 * Home flow (Josh, Q340/Q341/Q345, 3 Nov 2026): the queue's Patients/Referrals tablist is gone.
 * Its successor is the Home list switch — `Needs you` (act now, beds to pull and referrals to
 * decide) and `Flow` (every open movement, by stage) — with the Flow stages as tabs beside it.
 * Referrals live only under Needs you. These tests pin the same three things on the new controls:
 * real counts, keyboard selection, and that a list or stage switch never changes the shortlist's
 * subject on its own.
 *
 * The population is the established derivation, cross-checked here against the real fixture
 * rather than trusted: `referralQueueOrder` (`ward-referrals.ts`) is `referralState(referral) ===
 * "queued"`, sorted `urgency` then `raisedAt`, and nothing here re-derives that filter or that
 * sort a second time.
 */
function homeListRadio(name: RegExp): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: "Home list" })).getByRole("radio", { name });
}

/** Needs you's "Referrals to decide" group, with every referral row shown (it caps, then "Show N more"). */
function allReferralRows(): HTMLElement[] {
  const group = screen.getByRole("region", { name: "Referrals to decide" });
  const more = within(group).queryByRole("button", { name: /^Show \d+ more$/u });
  if (more) fireEvent.click(more);
  return Array.from(group.querySelectorAll<HTMLElement>("[data-referral-id]"));
}

describe("Command's Home lists carry Needs you and Flow, the successor to the Patients/Referrals tablist (Task C2)", () => {
  it("renders a Home list radiogroup and Flow stage tabs, each carrying the real count of its own rows", () => {
    renderHome();

    // v6 Home (7 Oct 2026): the list choice is a segmented radiogroup, not a tablist.
    const needsTab = homeListRadio(/^Needs you/u);
    const flowTab = homeListRadio(/^Flow/u);
    expect(needsTab).toHaveAttribute("aria-checked", "true");

    // Anti-vacuity floor — a selector matching nothing would let every assertion below pass on an
    // empty list and prove nothing about the real wiring.
    const referralRows = allReferralRows();
    const actGroup = screen.getByRole("region", { name: "Act now" });
    const actRows = within(actGroup).queryAllByRole("listitem");
    expect(referralRows.length, "expected at least one queued referral under Needs you").toBeGreaterThan(0);
    expect(actRows.length, "expected at least one act-now row under Needs you").toBeGreaterThan(0);
    expect(needsTab, "Needs you must carry the real row count, not an invented figure").toHaveTextContent(
      String(actRows.length + referralRows.length),
    );

    // The population and its order are `referralQueueOrder`'s own — never a second filter or sort
    // written down here. Read from the full seeded state (seedWardFlowState().referrals), not the
    // raw ward-movements.ts fixture: seedWardFlowState() additively overlays demonstration referrals
    // (ward-rulings-demo.ts), which include RF-RD06, added 2026-09-25 and queued — the same
    // population CoordinatorScreen itself renders from.
    const expectedIds = referralQueueOrder(seedWardFlowState().referrals).map((referral) => referral.id);
    expect(referralRows.map((row) => row.getAttribute("data-referral-id"))).toEqual(expectedIds);

    showWholeFlow();
    const patientRows = within(flowCard()).getAllByTestId(/^ward-queue-row-/);
    expect(patientRows.length, "expected at least one open movement in Flow").toBeGreaterThan(0);
    expect(flowTab, "Flow must carry the real row count, not an invented figure").toHaveTextContent(
      String(patientRows.length),
    );
    // Referrals are listed once, under Needs you, never as Flow rows.
    expect(within(flowCard()).queryAllByTestId(/^ward-referral-row-/)).toHaveLength(0);

    // Every stage tab carries the real count of its own section's rows, and All carries them all.
    const stages = screen.getByRole("tablist", { name: "Flow stages" });
    expect(within(stages).getByRole("tab", { name: /^All/u })).toHaveTextContent(String(patientRows.length));
    let sum = 0;
    for (const label of ["Needs a bed", "Bed agreed", "Ready to move", "Moving"]) {
      const section = within(flowCard()).getByRole("region", { name: label });
      const rows = within(section).queryAllByTestId(/^ward-queue-row-/).length;
      sum += rows;
      expect(
        within(stages).getByRole("tab", { name: new RegExp(`^${label}`, "u") }),
        `the ${label} tab must carry its own section's row count`,
      ).toHaveTextContent(String(rows));
    }
    expect(sum, "the stage sections must between them hold every Flow row").toBe(patientRows.length);
  });

  it("moves focus and selection between the two lists with the arrow keys, and marks the active one", () => {
    renderHome();

    const needsTab = homeListRadio(/^Needs you/u);
    const flowTab = homeListRadio(/^Flow/u);
    expect(needsTab).toHaveAttribute("aria-checked", "true");
    expect(flowTab).toHaveAttribute("aria-checked", "false");

    needsTab.focus();
    fireEvent.keyDown(needsTab, { key: "ArrowRight" });

    expect(flowTab).toHaveAttribute("aria-checked", "true");
    expect(needsTab).toHaveAttribute("aria-checked", "false");
    expect(flowTab, "focus follows selection, the same convention the registers tabs use").toHaveFocus();
    expect(flowCard()).toBeInTheDocument();

    fireEvent.keyDown(flowTab, { key: "ArrowLeft" });
    expect(needsTab).toHaveAttribute("aria-checked", "true");
    expect(needsTab).toHaveFocus();
    expect(screen.queryByRole("region", { name: "Flow" })).not.toBeInTheDocument();
  });

  it("keeps a selected referral's fields off the destination it never carries — no ward, no 'referred to'", () => {
    renderHome();
    const referralRows = allReferralRows();
    fireEvent.click(within(referralRows[0]!).getByRole("button", { name: /^Open referral for / }));

    const placement = screen.getByLabelText("Referral placement");
    expect(placement.textContent, "a referral names no ward — this must never render one").not.toMatch(
      /referred to|destination:/i,
    );
  });

  it("switching stages never changes the shortlist's subject, and a list switch closes it rather than swapping in another", () => {
    renderCoordinator();

    // Select a movement first: the shortlist explains it under "Placement".
    const movementRow = within(flowCard()).getAllByTestId(/^ward-queue-row-/)[0]!;
    fireEvent.click(movementRow);
    const movementId = movementRow.getAttribute("data-testid")!.replace("ward-queue-row-", "");

    let shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    expect(within(shortlist).getByTestId(`ward-shortlist-${movementId}`)).toBeInTheDocument();

    // Choosing a Flow stage decides which rows are on screen — it must not touch which record the
    // shortlist is explaining, even when the chosen stage does not list that movement.
    const stages = screen.getByRole("tablist", { name: "Flow stages" });
    const otherStage = ["Needs a bed", "Bed agreed", "Ready to move", "Moving"].find(
      (label) =>
        !within(within(flowCard()).getByRole("region", { name: label })).queryByTestId(
          movementRow.getAttribute("data-testid")!,
        ),
    )!;
    fireEvent.click(within(stages).getByRole("tab", { name: new RegExp(`^${otherStage}`, "u") }));
    expect(
      within(flowCard())
        .getAllByRole("region")
        .map((section) => section.getAttribute("aria-label")),
    ).toEqual([otherStage]);
    shortlist = screen.getByLabelText("Placement");
    expect(
      within(shortlist).getByTestId(`ward-shortlist-${movementId}`),
      "the shortlist must still explain the same movement after a stage switch",
    ).toBeInTheDocument();

    // Switching LIST (unlike switching stage) closes Placement by design — `showView` in
    // coordinator-screen.tsx: "Switching lists clears Placement, so it never shows someone the new
    // list does not highlight". It closes; it never swaps in a different subject.
    // (At rest the Placement card is the prompt, so the shortlist itself is checked by its test id.)
    fireEvent.click(homeListRadio(/^Needs you/u));
    expect(screen.queryByTestId(`ward-shortlist-${movementId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Referral placement")).not.toBeInTheDocument();

    // Selecting a referral (under Needs you) sets the shortlist's subject to that referral and
    // retitles the panel — the second half of this task, closing the gap this file used to document.
    const referralRow = allReferralRows()[0]!;
    const referralId = referralRow.getAttribute("data-referral-id")!;
    fireEvent.click(within(referralRow).getByRole("button", { name: /^Open referral for / }));

    shortlist = screen.getByLabelText("Referral placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Referral placement");
    expect(within(shortlist).getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();

    // Switching back to Flow must not silently hand the shortlist back to the movement either:
    // the list switch closes Placement, so neither the referral nor the earlier movement is shown
    // until a coordinator explicitly selects one.
    fireEvent.click(homeListRadio(/^Flow/u));
    expect(
      screen.queryByTestId(`ward-shortlist-${movementId}`),
      "a list switch must never hand the shortlist back to the movement on its own",
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Referral placement")).not.toBeInTheDocument();
    expect(screen.queryByTestId(`ward-referral-placement-${referralId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId("home-placement-prompt")).toBeInTheDocument();

    // Selecting a movement is what hands the shortlist back — proven, not assumed.
    showWholeFlow();
    fireEvent.click(within(flowCard()).getByTestId(`ward-queue-row-${movementId}`));
    shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    expect(within(shortlist).getByTestId(`ward-shortlist-${movementId}`)).toBeInTheDocument();
  });
});
