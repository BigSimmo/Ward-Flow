// Desks-R2-1 (master stress test, 14 Nov 2026), synthetic seed only. AK-A-03: the site bed manager
// confirms beds. The answer page's Confirm sent the command as the ward, which the signed-in server
// refuses for a bed manager ("not part of your role"); it now goes under the desk's own role.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { awaitingWardAnswer } from "@/components/ward-management/ward-waitlist";

const UNIT = unitById("rph-adult-secure")!;

function ConfirmedByProbe() {
  const { units, rejections } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === UNIT.id);
  return (
    <>
      <output data-testid="confirmed-by">{unit?.allocatable.confirmedBy ?? "none"}</output>
      <output data-testid="rejections">{rejections.map((entry) => entry.reason).join(" / ")}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  setDeskRole("coordinator");
});

describe("the site bed manager confirms beds from the answer page as itself (AK-A-03)", () => {
  it("records the confirmation under the bed manager's role", () => {
    setDeskRole("bed_manager");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={UNIT.id} presentation="answer" />
        <ConfirmedByProbe />
      </WardFlowProvider>,
    );
    const capacityPanel = screen.getByRole("region", { name: "Confirm your beds" });
    fireEvent.click(within(capacityPanel).getByTestId("ward-capacity-submit"));
    expect(screen.getByTestId("rejections").textContent).toBe("");
    expect(screen.getByTestId("confirmed-by").textContent).toBe("bed_manager");
  });
});

describe("the site bed manager is not shown referral answers it may not give (Josh, 14 Nov 2026)", () => {
  const state = seedWardFlowState();
  const asked = state.movements.find(
    (movement) =>
      movement.stage === "destination_review" && state.units.some((unit) => awaitingWardAnswer(movement, unit.id)),
  );
  if (!asked) throw new Error("the seed has no referral awaiting a ward answer");
  const askedUnit = state.units.find((unit) => awaitingWardAnswer(asked, unit.id))!;

  function renderAnswer() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={askedUnit.id} presentation="answer" />
      </WardFlowProvider>,
    );
  }

  it("offers the nurse in charge Decline and Accept in principle", () => {
    setDeskRole("ward");
    const { container } = renderAnswer();
    expect(container.querySelector('[data-testid^="ward-decline-toggle-"]')).not.toBeNull();
    expect(container.querySelector('[data-testid^="ward-accept-"][data-placement-action]')).not.toBeNull();
  });

  it("hides Decline and Accept for the site bed manager, with no who-does-it line (D-218)", () => {
    setDeskRole("bed_manager");
    const { container } = renderAnswer();
    expect(container.querySelector('[data-testid^="ward-decline-toggle-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="ward-accept-"][data-placement-action]')).toBeNull();
    expect(container.querySelector('[data-testid^="ward-answer-who-decides-"]')).toBeNull();
  });
});
