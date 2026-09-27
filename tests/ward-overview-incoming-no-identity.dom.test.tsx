// Owner, 26 Sept 2026 ("yes to your recommendations"): a ward sees no identity for a referral it has
// not yet accepted. The overview's incoming cards read "Incoming patient", with no name, no UMRN and
// no WF journey number, the same as the ward's answer view.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const seed = seedWardFlowState();
const awaiting = seed.movements.find(
  (movement) => !movement.closure && movement.stage === "destination_review" && movement.referredUnitIds.length > 0,
);

describe("the ward overview before a ward accepts", () => {
  it("shows an incoming referral with no name, no UMRN and no WF number", () => {
    expect(awaiting, "the seed must hold a referral awaiting a ward's answer").toBeDefined();
    const person = resolveSubjectPatient(awaiting, seed);
    expect(person.displayName, "the seed must link this referral to a named patient").not.toBe("Unknown Patient");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={awaiting!.referredUnitIds[0]} />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-incoming-${awaiting!.id}`);
    expect(card).toHaveTextContent("Incoming patient");
    expect(card).not.toHaveTextContent(person.displayName);
    expect(card).not.toHaveTextContent(person.formalName);
    expect(card).not.toHaveTextContent(person.umrn);
    expect(card.textContent ?? "").not.toMatch(/WF-/u);
  });
});
