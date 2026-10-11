import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The answer view's back link goes through contextual history (ContextualBackLink), which reads
// the app router; jsdom has none mounted.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { eligibility, wardFacingGateDetail } from "@/components/ward-management/ward-eligibility";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import {
  allEmergencyDepartments,
  allUnits,
  NOW_ANCHOR,
  unitById,
  wardSites,
} from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { namesRealPlace } from "./helpers/ward-place-names";

const MOVEMENT = movementById("WF-002")!;
const UNIT = unitById("fsh-older-adult")!;
const LINKED_REFERRAL = seedWardFlowState().referrals.find((referral) => referral.id === MOVEMENT.referralId)!;
const COADDRESSED = movementById("WF-013")!;
const COADDRESSED_UNIT = unitById("bty-older-adult")!;
const HISTORY_UNIT = unitById("rph-adult-secure")!;

function DeclineProbe() {
  const { movements } = useWardFlow();
  const decline = movements
    .find((movement) => movement.id === MOVEMENT.id)
    ?.declines.find((entry) => entry.unitId === UNIT.id);

  return <output data-testid="answer-decline-probe">{decline?.reason ?? "none"}</output>;
}

function renderAnswer(withProbe = false) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={UNIT.id} presentation="answer" />
      {withProbe ? <DeclineProbe /> : null}
    </WardFlowProvider>,
  );
}

describe("Ward answer current facts", () => {
  it("renders eight movement facts and real gates without joining identity or making failed capacity a UI gate", () => {
    const verdict = eligibility(MOVEMENT, UNIT, NOW_ANCHOR);
    const capacityGate = verdict.gates.find((gate) => gate.gate === "allocatable_bed");
    expect(MOVEMENT.referredUnitIds).toContain(UNIT.id);
    expect(verdict.gates.length).toBeGreaterThan(0);
    expect(capacityGate?.pass).toBe(false);
    expect(LINKED_REFERRAL).toBeDefined();

    renderAnswer();

    const facts = screen.getByLabelText("Current facts for this patient");
    expect(Array.from(facts.querySelectorAll("dt"), (term) => term.textContent)).toEqual([
      "Cohort",
      "Bed needed",
      "Sex",
      // Owner answer 2026-09-25 (R7, Q2): gender identity beside sex, as its own fact.
      "Gender",
      "Specialling",
      "High-acuity nursing",
      "Legal status",
      "From",
      "Referred",
    ]);
    const factValue = (term: string) =>
      Array.from(facts.querySelectorAll("div"))
        .find((row) => row.querySelector("dt")?.textContent === term)
        ?.querySelector("dd")?.textContent;
    expect(factValue("Cohort")).toBe(MOVEMENT.cohort);
    expect(factValue("Bed needed")).toBe(MOVEMENT.security);
    expect(factValue("Legal status")).toBe(MOVEMENT.legalStatus);

    // The linked referral contains these person/context facts. Ward Answer deliberately reads the
    // movement only, so this proves the new panel did not become a referral/person join surface.
    const referralOnlyFacts = [
      LINKED_REFERRAL.homeRegion,
      LINKED_REFERRAL.history,
      LINKED_REFERRAL.suburb?.kind === "named" ? LINKED_REFERRAL.suburb.name : undefined,
    ].filter((value): value is string => value !== undefined);
    expect(referralOnlyFacts).toHaveLength(3);
    referralOnlyFacts.forEach((fact) => expect(facts).not.toHaveTextContent(fact));
    expect(screen.getByText("Patient name and age are not recorded for this movement.")).toBeInTheDocument();

    const gates = screen.getByRole("region", { name: "This ward's own gates for this patient" });
    const rows = within(gates).getAllByRole("listitem");
    expect(rows).toHaveLength(verdict.gates.length);
    verdict.gates.forEach((gate, index) => {
      // The ward screen shows wardFacingGateDetail, not raw gate.detail: the gender_designation gate is
      // replaced by a fixed sentence so a bed verdict never reveals sex or gender (Opus gender review round 2).
      expect(rows[index]).toHaveTextContent(wardFacingGateDetail(gate));
      expect(rows[index]).toHaveTextContent(gate.pass ? "Pass" : "Does not pass");
    });

    const accept = screen.getByTestId(`ward-accept-${MOVEMENT.id}`);
    expect(accept).not.toHaveAttribute("aria-disabled");
    expect(accept).not.toBeDisabled();
    expect(gates).toHaveTextContent(capacityGate!.detail);
  });

  it("still requires an explicit decline reason and records the chosen existing reason", () => {
    renderAnswer(true);

    fireEvent.click(screen.getByTestId(`ward-decline-toggle-${MOVEMENT.id}`));
    const form = screen.getByTestId(`ward-decline-form-${MOVEMENT.id}`);
    const choices = within(form).getAllByRole("radio");
    const submit = within(form).getByRole("button", { name: "Confirm decline" });

    expect(choices).toHaveLength(DECLINE_REASONS.length);
    expect(choices.every((choice) => !(choice as HTMLInputElement).checked)).toBe(true);
    expect(submit).toBeDisabled();

    // Owner ruling 2026-09-25: DECLINE with reason no_bed now waitlists the patient instead of
    // declining; capability_mismatch still declines, so this reason keeps exercising a real decline.
    fireEvent.click(within(form).getByRole("radio", { name: "capability mismatch" }));
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    expect(screen.getByTestId("answer-decline-probe")).toHaveTextContent("capability_mismatch");
    expect(screen.queryByTestId(`ward-incoming-${MOVEMENT.id}`)).not.toBeInTheDocument();
  });

  it("keeps the populated Answer facts for a co-addressed request free of every other place name", () => {
    expect(COADDRESSED.referredUnitIds).toContain(COADDRESSED_UNIT.id);
    expect(COADDRESSED.referredUnitIds.length).toBeGreaterThan(1);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={COADDRESSED_UNIT.id} presentation="answer" />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-incoming-${COADDRESSED.id}`);
    const shown = card.textContent ?? "";
    expect(
      within(card).getByText("Emergency department. Origin department is not disclosed in this ward view."),
    ).toBeInTheDocument();

    for (const other of allUnits()) {
      if (other.id === COADDRESSED_UNIT.id) continue;
      expect(shown).not.toContain(other.name);
      expect(shown).not.toContain(other.id);
    }

    for (const site of wardSites) {
      if (site.units.some((unit) => unit.id === COADDRESSED_UNIT.id)) continue;
      expect(shown).not.toContain(site.name);
      expect(namesRealPlace(shown, site.code)).toBe(false);
      if (site.emergencyDepartment !== undefined) {
        expect(namesRealPlace(shown, site.emergencyDepartment.name)).toBe(false);
      }
    }

    for (const department of allEmergencyDepartments()) {
      if (
        wardSites.some(
          (site) =>
            site.units.some((unit) => unit.id === COADDRESSED_UNIT.id) &&
            site.emergencyDepartment?.id === department.id,
        )
      )
        continue;
      expect(namesRealPlace(shown, department.name)).toBe(false);
    }

    expect(shown).not.toMatch(
      /parallel|also referred|referred elsewhere|another ward|other wards?|co-referred|multiple (?:wards|units|destinations)/i,
    );
  });

  it("reuses one live capacity form and retains every ward-owned accepted or declined answer", () => {
    const initial = seedWardFlowState();
    const accepted = initial.movements.filter((movement) => movement.acceptedUnitId === HISTORY_UNIT.id);
    const declines = initial.movements.flatMap((movement) =>
      movement.declines
        .filter((decline) => decline.unitId === HISTORY_UNIT.id)
        .map((decline, declineIndex) => ({ movementId: movement.id, decline, declineIndex })),
    );
    expect(accepted.length).toBeGreaterThan(0);
    expect(declines.length).toBeGreaterThan(0);
    expect(accepted.some((movement) => movement.acceptedAt === undefined)).toBe(true);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={HISTORY_UNIT.id} presentation="answer" />
      </WardFlowProvider>,
    );

    const capacityPanel = screen.getByRole("region", { name: "Confirm your beds" });
    expect(screen.getAllByTestId("ward-capacity-form")).toHaveLength(1);
    expect(within(capacityPanel).getByText("Physically empty")).toBeInTheDocument();
    expect(within(capacityPanel).getByText("Allocatable")).toBeInTheDocument();

    const nextCapacity = HISTORY_UNIT.allocatable.value + 1;
    // v10: allocatable is a stepper only (no free number box).
    fireEvent.click(within(capacityPanel).getByRole("button", { name: "Increase allocatable beds" }));
    expect(within(capacityPanel).getByTestId("ward-capacity-input")).toHaveAttribute(
      "aria-valuenow",
      String(nextCapacity),
    );
    fireEvent.click(within(capacityPanel).getByTestId("ward-capacity-submit"));
    expect(within(capacityPanel).getByText(new RegExp(`Currently confirmed ${nextCapacity} at`))).toBeInTheDocument();

    const historyPanel = screen.getByRole("region", { name: "Recent answers" });
    const history = within(historyPanel).getByTestId("ward-answer-history");
    expect(within(history).getAllByRole("listitem")).toHaveLength(accepted.length + declines.length);
    accepted.forEach((movement) => {
      expect(within(history).getByTestId(`ward-answer-history-${movement.id}-accepted`)).toHaveTextContent(
        "Accepted by this ward",
      );
    });
    declines.forEach(({ movementId, decline, declineIndex }) => {
      const row = within(history).getByTestId(`ward-answer-history-${movementId}-declined-${declineIndex}`);
      expect(row).toHaveTextContent(decline.reason.replace(/_/g, " "));
      expect(row).toHaveTextContent(formatInstant(decline.at));
    });
    expect(within(history).getAllByText("Time not recorded")).toHaveLength(
      accepted.filter((movement) => movement.acceptedAt === undefined).length,
    );
  });

  it("suppresses the false-alarm Tier 1 badge and Emergency Department Origin subtitle when incoming is empty", () => {
    renderAnswer();

    // Initially has an incoming movement (WF-002, urgency tier 1)
    expect(screen.getByText("Emergency department origin")).toBeInTheDocument();
    expect(screen.queryByText("none waiting")).not.toBeInTheDocument();

    // Decline the incoming movement so incoming is empty
    fireEvent.click(screen.getByTestId(`ward-decline-toggle-${MOVEMENT.id}`));
    const form = screen.getByTestId(`ward-decline-form-${MOVEMENT.id}`);
    // Owner ruling 2026-09-25: DECLINE with reason no_bed now waitlists rather than declines, which
    // would leave this movement's referredUnitIds untouched and "incoming" — capability_mismatch
    // still declines, which is what "incoming is empty" below needs.
    fireEvent.click(within(form).getByRole("radio", { name: "capability mismatch" }));
    fireEvent.click(within(form).getByRole("button", { name: "Confirm decline" }));

    // Empty state: the v6 card head reads "Bed request" with a quiet "none waiting" count
    // (design/pages-v6/Ward_answer.png), not a coloured badge.
    expect(screen.getByText("none waiting")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bed request" })).toBeInTheDocument();
    expect(screen.queryByText("Emergency department origin")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Tier\b/)).not.toBeInTheDocument();
  });
});
