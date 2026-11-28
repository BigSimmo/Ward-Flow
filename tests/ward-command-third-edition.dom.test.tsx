import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
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
 * on the priority queue (`coordinatorReferralQueue`, the same established derivation `wardNavCounts`
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

/**
 * Home without Flow (simplification round, item 4, built in r10 on 28 Nov 2026): Flow folded into
 * Waiting, so Home holds one list, Needs you. A movement is chosen from an Act now row that names
 * one (`li[data-movement-id]`); a referral from "Referrals to decide".
 */
function openAMovement(): string {
  const row = document.querySelector<HTMLElement>("li[data-movement-id]");
  expect(row, "expected at least one Act now row that names a movement").not.toBeNull();
  fireEvent.click(within(row!).getAllByRole("button")[0]!);
  return row!.getAttribute("data-movement-id")!;
}

function renderCoordinator() {
  return renderHome();
}

describe("Command third-edition restyle — panel order and heading pins", () => {
  it("renders pressure, queue and Beds that fit, then mounts the shortlist after selection", () => {
    renderCoordinator();
    // Direction A (owner, 10 Oct 2026): the hero answers how many wait for how many beds, then the
    // ED strip (heading for screen readers) and the queue. Home v7 (Josh, 22 Oct 2026): State
    // bedflow moved to Capacity, Beds that fit takes its place, and Placement previews nobody.
    const atRest = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    // Sticky header redesign (Josh, 9 Nov 2026): one plain hero title; the counts are its figures,
    // and the ED strip sits inside the hero under its own level-3 "Waiting in ED" heading.
    expect(atRest[0]).toBe("Bed flow right now");
    // Wave 4 (D-191): count label nouns, as Capacity says them; no window word under "right now".
    expect(screen.getByTestId("home-figure-ed")).toHaveTextContent(/^\d+ Open ED movements$/u);
    expect(screen.getByTestId("home-figure-beds")).toHaveTextContent(/^\d+ Ready$/u);
    // Open ED movements retain accountability through transit; the queue can also contain ward/community origins.
    // Home and Activity (Josh, 31 Oct 2026): "in transit" as the phone says it, and the demo
    // coverage disclosure lives in the app bar and the footer, so the hero keeps only its facts.
    // Audit two #91 (T11, r10): the Waiting / In transit split moved into the first figure's breakdown,
    // so the ED strip head keeps its title and the link to All EDs.
    expect(screen.getByTestId("ward-home-ed-population")).toHaveTextContent(/^Open All EDs$/u);
    const edPressure = screen.getByTestId("ward-home-ed-pressure");
    expect(within(edPressure).getByRole("heading", { level: 3, name: "Waiting in ED" })).toBeInTheDocument();
    const heroTitle = screen.getByRole("heading", { level: 2, name: "Bed flow right now" });
    expect(heroTitle.compareDocumentPosition(edPressure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Home without Flow (item 4, r10): Home holds Needs you, Beds that fit and Later today, and no
    // Flow card, so the queue pins are the Needs you groups, before Beds that fit.
    expect(atRest.slice(1).filter((title) => /^(Beds that fit|Later today)$/u.test(title!))).toEqual([
      "Beds that fit",
      "Later today",
    ]);
    expect(screen.queryByRole("region", { name: "Flow" })).toBeNull();
    const needsYou = screen.getByRole("heading", { level: 2, name: "Needs you" });
    const bedsThatFit = screen.getByRole("heading", { level: 2, name: "Beds that fit" });
    expect(edPressure.compareDocumentPosition(needsYou) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(needsYou.compareDocumentPosition(bedsThatFit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("ward-placement-top-of-queue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull(); // notes 4: no at-rest prompt
    openAMovement();
    // The exceptions drawer's default tab ("Exceptions") carries no `<h2>`, and its other three
    // tabs are `hidden` (not merely visually hidden — the native `hidden` attribute, which
    // Testing Library's accessibility-tree-aware `getByRole` already excludes) until a coordinator
    // switches tabs. So a plain, unfiltered level-2-heading query is exactly the hero and the three
    // headed panels this test is about, in DOM order — nothing here reaches into an inactive
    // tabpanel to manufacture that count.
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    // Later today steps aside while Placement is open, so Placement keeps the whole right column.
    expect(headings[0]).toBe(atRest[0]);
    expect(headings).not.toContain("Later today");
    expect(headings[headings.length - 1]).toBe("Placement");
    expect(screen.queryByTestId("home-placement-prompt")).not.toBeInTheDocument();
  });

  it("reads the queue, then opens Placement as a drawer once a patient is selected", () => {
    // Owner, 8 Oct 2026. Proven by real DOM order. Home v7 (Josh, 22 Oct 2026): State bedflow is
    // no longer on Home; it sits at the foot of Capacity.
    renderCoordinator();
    const movementId = openAMovement();
    const body = screen.getByTestId("ward-coordinator-body");
    const queue = within(body).getByTestId("home-my-list").querySelector(`li[data-movement-id="${movementId}"]`);
    // H7 (Josh, 3 Nov 2026): Placement opens as the patient drawer over Home, like the Capacity
    // pop-up, so the queue stays on the page behind it rather than sharing a column order.
    const shortlist = screen.getByLabelText("Placement");

    expect(within(body).queryByLabelText("State Bedflow")).not.toBeInTheDocument();
    expect(queue).not.toBeNull();
    expect(screen.getByTestId("home-placement-drawer")).toContainElement(shortlist);
  });

  it("offers Today's review, not Registers, from the More menu, with no strip above the columns", () => {
    // Home notes 4, issue 4 (Josh, 9 Nov 2026): Today's review replaced the Registers strip, so the
    // "More for this list" menu opens that page and nothing is drawn between the hero and the list.
    renderCoordinator();
    const body = screen.getByTestId("ward-coordinator-body");
    expect(within(body).queryByTestId("ward-coordinator-registers")).toBeNull();

    // Desktop holds one list, so the "Needs you" heading carries More at its right (no tab bar).
    const lists = within(body).getByTestId("home-lists");
    const more = within(lists).getByRole("button", { name: "More for this list" });
    fireEvent.click(more);
    expect(screen.getByRole("menuitem", { name: "Today's review" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Registers" })).toBeNull();
  });

  it("keeps the shortlist panel's heading as 'Placement' once a patient is selected", () => {
    // The one state this codebase actually has (see the file comment above for the state this
    // does NOT cover). Asserted explicitly, per-state, rather than assumed unchanged from the
    // no-selection case above — a fixed-heading assumption is exactly what the brief warns is
    // wrong in one of the two drawing states, so this re-checks it after a real selection rather
    // than reasoning about it.
    renderCoordinator();
    openAMovement();

    const shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
  });

  it("keeps the candidate target, eligibility checks and override label aligned", () => {
    // Home without Flow (item 4, r10): a movement with no ward yet is no longer a Home row, so the
    // Placement panel is rendered for it directly, as `ward-home-placement-redesign` does.
    function Panel() {
      const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
      const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
      return (
        <ShortlistPanel
          movement={movements.find((candidate) => candidate.id === "WF-001")}
          now={now}
          units={units}
          bedReleases={bedReleases}
          leaveBeds={leaveBeds}
          admissions={wardAdmissions}
          referrals={referrals}
          selectedUnitId={selectedUnitId}
          onSelectUnit={setSelectedUnitId}
          dispatch={dispatch}
          parallelReferralCap={configuration.parallelReferralCap}
        />
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <Panel />
      </WardFlowProvider>,
    );

    // Home v7 (Josh, 22 Oct 2026): State bedflow left Home, so the ward is chosen in Placement.
    const scghCandidate = screen.getByTestId("ward-shortlist-candidate-scgh-adult-open");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(scghCandidate);

    expect(scghCandidate).toHaveAttribute("data-showing", "true");
    expect(scghCandidate).toHaveAttribute("aria-pressed", "true");

    const shortlist = screen.getByTestId("ward-shortlist-WF-001");
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
 * decide) and `Flow`; r10 (item 4, Home without Flow) folded Flow into Waiting, so Home holds Needs you alone.
 * Referrals live only under Needs you. These tests pin the same three things on the new controls:
 * real counts, keyboard selection, and that a list or stage switch never changes the shortlist's
 * subject on its own.
 *
 * The population is the established derivation, cross-checked here against the real fixture
 * rather than trusted: `referralQueueOrder` (`ward-referrals.ts`) is `referralState(referral) ===
 * "queued"`, sorted `urgency` then `raisedAt`, and nothing here re-derives that filter or that
 * sort a second time.
 */
/** Needs you's "Referrals to decide" group, with every referral row shown (it caps, then "Show N more"). */
function allReferralRows(): HTMLElement[] {
  const group = screen.getByRole("region", { name: "Referrals to decide" });
  const more = within(group).queryByRole("button", { name: /^Show \d+ more$/u });
  if (more) fireEvent.click(more);
  return Array.from(group.querySelectorAll<HTMLElement>("[data-referral-id]"));
}

describe("Command's Home Needs you list and its Placement subject (Task C2, Home without Flow)", () => {
  it("keeps a selected referral's fields off the destination it never carries — no ward, no 'referred to'", () => {
    renderHome();
    const referralRows = allReferralRows();
    fireEvent.click(within(referralRows[0]!).getByRole("button", { name: /^Open referral for / }));

    const placement = screen.getByLabelText("Referral placement");
    expect(placement.textContent, "a referral names no ward — this must never render one").not.toMatch(
      /referred to|destination:/i,
    );
  });

  it("selecting a referral retitles Placement, and closing it never hands the shortlist back to the movement", () => {
    renderCoordinator();

    // Select a movement first: the shortlist explains it under "Placement".
    const movementId = openAMovement();
    let shortlist = screen.getByLabelText("Placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Placement");
    expect(within(shortlist).getByTestId(`ward-shortlist-${movementId}`)).toBeInTheDocument();

    // Selecting a referral (under Needs you) sets the shortlist's subject to that referral and
    // retitles the panel; it never swaps the earlier movement back in.
    const referralRow = allReferralRows()[0]!;
    const referralId = referralRow.getAttribute("data-referral-id")!;
    fireEvent.click(within(referralRow).getByRole("button", { name: /^Open referral for / }));

    shortlist = screen.getByLabelText("Referral placement");
    expect(within(shortlist).getByRole("heading", { level: 2 })).toHaveTextContent("Referral placement");
    expect(within(shortlist).getByTestId(`ward-referral-placement-${referralId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-shortlist-${movementId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-placement-prompt")).toBeNull(); // notes 4: no at-rest prompt
  });
});
