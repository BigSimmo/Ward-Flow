// Josh, 22 Oct 2026 ("the wards should not see where the patient is referred. But they need to see all
// the other information"): this replaces the owner's 26 Sept 2026 rule that a ward sees no identity
// before it accepts. The overview's incoming card names the patient and shows the UMRN, and the full
// referral opens from the name. Neither ever names another ward the patient was referred to (FD-23),
// and neither shows the WF journey number.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const seed = seedWardFlowState();
// WF-013 is referred to two older adult wards at once, so it is the journey that can leak the other.
const awaiting = seed.movements.find((movement) => movement.id === "WF-013");
const thisWard = "gry-older-adult";
const otherWardNames = (awaiting?.referredUnitIds ?? [])
  .filter((id) => id !== thisWard)
  .map((id) => seed.units.find((unit) => unit.id === id)?.name ?? id);

describe("the ward overview before a ward accepts", () => {
  it("names the incoming patient with their UMRN, and never the other ward or the WF number", () => {
    expect(awaiting, "the seed must hold WF-013 awaiting a ward's answer").toBeDefined();
    expect(awaiting!.referredUnitIds).toContain(thisWard);
    expect(otherWardNames.length, "WF-013 must also be referred to another ward").toBeGreaterThan(0);
    const person = resolveSubjectPatient(awaiting, seed);
    expect(person.displayName, "the seed must link this referral to a named patient").not.toBe("Name not recorded");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={thisWard} />
      </WardFlowProvider>,
    );

    const card = screen.getByTestId(`ward-incoming-${awaiting!.id}`);
    expect(card).toHaveTextContent(person.displayName);
    expect(card).toHaveTextContent(person.umrn);
    expect(card).not.toHaveTextContent("Incoming patient");
    for (const name of otherWardNames) expect(card).not.toHaveTextContent(name);
    expect(card.textContent ?? "").not.toMatch(/WF-/u);
  });

  it("opens the full referral from the name, with the seeded details and never the other ward", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={thisWard} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId(`ward-incoming-open-${awaiting!.id}`));
    const detail = await screen.findByTestId(`ward-referral-detail-${awaiting!.id}`);

    expect(detail).toHaveTextContent(/nihilistic ideas/i);
    expect(detail).toHaveTextContent("Fits this ward.");
    expect(within(detail).getByTestId("ward-referral-referrer")).toHaveTextContent("Dr Kalan Moongate");
    for (const name of otherWardNames) expect(detail).not.toHaveTextContent(name);
    expect(detail.textContent ?? "").not.toMatch(/WF-/u);

    // A document opens in the in-app viewer, marked synthetic, and Back returns to the referral.
    const documents = within(detail).getByTestId("ward-referral-documents");
    fireEvent.click(within(documents).getAllByRole("button", { name: "View" })[0]);
    const viewer = await screen.findByTestId("ward-referral-document-viewer");
    expect(viewer).toHaveTextContent(/synthetic/i);
    fireEvent.click(within(viewer).getByRole("button", { name: "Back to referral" }));
    expect(await screen.findByTestId(`ward-referral-detail-${awaiting!.id}`)).toBeInTheDocument();
  });
});
