import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { TIER_TARGETS_NOTE } from "@/components/ward-management/coordinator/priority-queue";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { showEveryoneWaiting } from "./helpers/ward-home-queue";

/**
 * Home placement redesign, Josh 19 Oct 2026. Desktop Home scrolls once: the queue shows its top 10
 * behind "Show all (N)", and the Placement panel leads with the next step, says times in plain
 * words, labels its checks, drops empty clutter and never contradicts an accepted destination.
 * Everything here runs on the synthetic fixture.
 */

afterEach(cleanup);

/** Accepted, with a recorded Form 4C deadline, at NOW_ANCHOR. */
const ACCEPTED_ID = "WF-004";
/** Open with recorded declines. */
const DECLINED_ID = "WF-009";

function seeded(id: string): Movement {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.id === id);
  if (!movement) throw new Error(`${id} is not in the fixture`);
  return movement;
}

function seededUnitName(unitId: string): string {
  const unit = seedWardFlowState().units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error(`${unitId} is not in the fixture`);
  return unit.name;
}

function Harness({
  movementId,
  editMovement = (movement) => movement,
  editUnits = (units) => units,
  nowOverride,
}: {
  movementId: string;
  editMovement?: (movement: Movement) => Movement;
  editUnits?: (units: Unit[]) => Unit[];
  nowOverride?: number;
}) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === movementId);
  return (
    <ShortlistPanel
      movement={movement ? editMovement(movement) : undefined}
      now={nowOverride ?? now}
      units={editUnits(units)}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

function renderPanel(props: Parameters<typeof Harness>[0]) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness {...props} />
    </WardFlowProvider>,
  );
  return screen.getByTestId(`ward-shortlist-${props.movementId}`);
}

describe("desktop Home queue: top 10, then Show all (N)", () => {
  it("shows the top 10 rows and reveals the rest in place", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    showEveryoneWaiting();
    const patients = screen.getByRole("group", { name: "Patients" });
    const total = Number(within(screen.getByRole("radio", { name: /Patients/ })).getByText(/^\d+$/u).textContent);
    expect(total, "the fixture must hold more than 10 open patients for the cap to matter").toBeGreaterThan(10);
    expect(within(patients).getAllByTestId(/^ward-queue-row-/)).toHaveLength(10);

    const showAll = screen.getByTestId("ward-queue-show-all");
    expect(showAll).toHaveTextContent(`Show all (${total})`);
    expect(showAll).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(showAll);
    expect(within(patients).getAllByTestId(/^ward-queue-row-/)).toHaveLength(total);
    expect(showAll).toHaveAttribute("aria-expanded", "true");
    expect(showAll).toHaveTextContent("Show top 10");
  });

  it("keeps a chosen patient below the cap in view, in its own place, when the queue folds again", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    showEveryoneWaiting();
    const patients = screen.getByRole("group", { name: "Patients" });
    fireEvent.click(screen.getByTestId("ward-queue-show-all"));
    const rows = within(patients).getAllByTestId(/^ward-queue-row-/);
    const chosen = rows[14]!;
    const chosenId = chosen.getAttribute("data-testid");
    fireEvent.click(chosen);
    fireEvent.click(screen.getByTestId("ward-queue-show-all"));

    const folded = within(patients).getAllByTestId(/^ward-queue-row-/);
    expect(folded).toHaveLength(11);
    // Nothing is re-sorted: the chosen row follows the top 10 rather than jumping above them.
    expect(folded.map((row) => row.getAttribute("data-testid"))).toEqual(
      [...rows.slice(0, 10), chosen].map((row) => row.getAttribute("data-testid")),
    );
    expect(screen.getByTestId(chosenId!)).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Placement panel redesign", () => {
  it("leads with the next step, above the patient's details", () => {
    expect(seeded(ACCEPTED_ID).acceptedUnitId, "WF-004 must be accepted for this to test anything").toBeDefined();
    const panel = renderPanel({ movementId: ACCEPTED_ID });
    const step = within(panel).getByTestId("ward-shortlist-next-step");
    const facts = within(panel).getByTestId("ward-shortlist-facts");
    expect(step.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(step).getByTestId("ward-shortlist-find-another-bed")).toBeInTheDocument();
  });

  it("states the details as two compact lines, with overdue as a glyph and a word", () => {
    const movement = seeded(ACCEPTED_ID);
    const panel = renderPanel({ movementId: ACCEPTED_ID });
    const facts = within(panel).getByTestId("ward-shortlist-facts");
    // Each fact keeps its label for assistive technology.
    for (const label of ["Sex", "Age group", "Security", "Legal"]) {
      expect(within(facts).getByText(label)).toHaveClass("sr-only");
    }
    expect(facts).toHaveTextContent(`${movement.sex}`);
    expect(facts).toHaveTextContent(`Form ${movement.legalForm!.code}`);
    const wait = within(panel).getByTestId("ward-shortlist-wait-line");
    expect(wait.textContent).toMatch(/^Waiting \S+( \S+)? \(target \S+( \S+)?\)/u);
    if (wait.getAttribute("data-urgent") === "true") {
      expect(wait).toHaveTextContent("overdue");
    }
    // No six-box grid on desktop.
    expect(panel.querySelector("dl[data-phone]")).toBeNull();
  });

  it("states the tier targets once, at the panel foot", () => {
    const panel = renderPanel({ movementId: ACCEPTED_ID });
    const note = within(panel).getByTestId("ward-shortlist-tier-targets");
    expect(note).toHaveTextContent(TIER_TARGETS_NOTE);
    expect(panel.lastElementChild).toBe(note);
    expect(within(panel).getAllByText(TIER_TARGETS_NOTE)).toHaveLength(1);
  });

  it("puts the accepted destination and its desk link on one row", () => {
    const movement = seeded(ACCEPTED_ID);
    const panel = renderPanel({ movementId: ACCEPTED_ID });
    const unitName = seededUnitName(movement.acceptedUnitId!);
    const link = within(panel).getByTestId(`ward-shortlist-open-ward-desk-${movement.acceptedUnitId}`);
    const row = link.parentElement!;
    expect(row).toHaveTextContent(`Accepted destination: ${unitName}`);
    // Short on screen ("Open desk →"), named in full for a screen reader.
    expect(link).toHaveAccessibleName(`Open ${unitName} desk →`);
    expect(within(link).getByText(unitName).tagName).toBe("SPAN");
  });

  it("writes a passed legal deadline in plain time beside its not-legally-checked tag", () => {
    const movement = seeded(ACCEPTED_ID);
    const dueAt = movement.legalForm?.dueAt;
    expect(dueAt, "WF-004 must carry a recorded deadline for this to test anything").toBeDefined();
    // 3413 minutes past the recorded deadline: once "3413 min ago", now "2d 8h ago".
    const panel = renderPanel({ movementId: ACCEPTED_ID, nowOverride: dueAt! + 3413 });
    // The legal line under the patient (the "Why this wait" factors also name the deadline).
    const line = within(panel)
      .getAllByText(/passed its deadline/u)
      .find((candidate) => within(candidate).queryByTestId("legal-limits-not-checked"));
    expect(line, "the legal line lost its not-legally-checked tag").toBeDefined();
    if (!line) return;
    expect(line).toHaveTextContent(`Form ${movement.legalForm!.code} passed its deadline ${splitDuration(3413)} ago`);
    expect(splitDuration(3413)).toBe("2d 8h");
    expect(line.textContent).not.toMatch(/\d+ min ago/u);
    // Owner rule D5: wherever a legal limit shows, it says it was not legally checked.
    expect(within(line).getByTestId("legal-limits-not-checked")).toBeInTheDocument();
  });

  it("labels the checks in words and keeps the filter hooks", () => {
    const panel = renderPanel({ movementId: ACCEPTED_ID });
    const pill = within(panel).getByTestId("ward-shortlist-checks-clear-pill");
    expect(pill.textContent).toMatch(/^Checks: (\d+) of (\d+) met(, \d+ to review)?$/u);
    expect(within(panel).getByTestId("ward-shortlist-gate-filter-all").textContent).toMatch(/^All checks \(\d+\)$/u);
    expect(within(panel).getByTestId("ward-shortlist-gate-filter-open").textContent).toMatch(
      /^Still to review \(\d+\)$/u,
    );
  });

  it("hides the Declines disclosure when nothing was declined, and keeps it when something was", () => {
    expect(seeded(ACCEPTED_ID).declines).toHaveLength(0);
    const quiet = renderPanel({ movementId: ACCEPTED_ID });
    expect(quiet.querySelector('details[aria-label="Declines"]')).toBeNull();
    cleanup();

    const declined = seeded(DECLINED_ID).declines.length;
    expect(declined).toBeGreaterThan(0);
    const panel = renderPanel({ movementId: DECLINED_ID });
    const details = panel.querySelector('details[aria-label="Declines"]');
    expect(details).not.toBeNull();
    expect(details!.querySelector("summary")).toHaveTextContent(`Declines · ${declined}`);
  });

  it("never says no destination is available once one has accepted", () => {
    // Every ward reports no allocatable bed, so nothing is eligible: the condition the Escalation
    // prompt is for. The control (the same patient, not yet accepted) proves the prompt would show.
    const noBeds = (units: Unit[]) =>
      units.map((unit) => ({ ...unit, allocatable: { ...unit.allocatable, value: 0 } }));
    const notAccepted = (movement: Movement): Movement => ({
      ...movement,
      acceptedUnitId: undefined,
      escalation: undefined,
    });
    const control = renderPanel({ movementId: ACCEPTED_ID, editUnits: noBeds, editMovement: notAccepted });
    expect(control).toHaveTextContent("No eligible destination is currently available");
    cleanup();

    const accepted = (movement: Movement): Movement => ({ ...movement, escalation: undefined });
    const panel = renderPanel({ movementId: ACCEPTED_ID, editUnits: noBeds, editMovement: accepted });
    expect(within(panel).getByText(/^Accepted destination: /u)).toBeInTheDocument();
    expect(panel).not.toHaveTextContent("No eligible destination is currently available");
    expect(within(panel).queryByTestId("ward-shortlist-escalation-toggle")).toBeNull();
  });

  it("treats a recorded acceptance as accepted even when its ward cannot be found", () => {
    // Codex review on #448: the prompt keyed on the unit lookup, so an accepted ward missing from
    // the unit list showed "could not be resolved" and "No eligible destination" together.
    const noBeds = (units: Unit[]) =>
      units.map((unit) => ({ ...unit, allocatable: { ...unit.allocatable, value: 0 } }));
    const unresolved = (movement: Movement): Movement => ({
      ...movement,
      acceptedUnitId: "UNIT-NOT-IN-LIST",
      escalation: undefined,
    });
    const panel = renderPanel({ movementId: ACCEPTED_ID, editUnits: noBeds, editMovement: unresolved });
    expect(panel).toHaveTextContent("Accepted destination could not be resolved.");
    expect(panel).not.toHaveTextContent("No eligible destination is currently available");
    expect(within(panel).queryByTestId("ward-shortlist-escalation-toggle")).toBeNull();
  });
});
