import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// A plain <a> for next/link, as in every sibling handover dom suite.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Open movements whose typed form time has passed, worked out from the records the page reads. */
function ExpectedProbe() {
  const { movements, now } = useWardFlow();
  const ids = movements
    .filter(
      (movement) => isOpen(movement) && movement.legalForm?.dueAt !== undefined && movement.legalForm.dueAt <= now,
    )
    .map((movement) => movement.id);
  return <output data-testid="expected-form-timing-ids">{ids.join(",")}</output>;
}

/** The seed sets form due times relative to its opening instant, so only moving the shared clock
 * (the demo's own ADVANCE_CLOCK event) carries them past due. */
function ClockAdvancer({ minutes }: { minutes: number }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
      advance clock
    </button>
  );
}

function renderAt(now: number) {
  return render(
    <WardFlowProvider initialNow={now}>
      <HandoverPage />
      <ExpectedProbe />
      <ClockAdvancer minutes={8 * 60} />
    </WardFlowProvider>,
  );
}

function expectedIds(): string[] {
  const text = screen.getByTestId("expected-form-timing-ids").textContent ?? "";
  return text === "" ? [] : text.split(",");
}

// Refined Handover A (9 Oct 2026): a typed form time that has passed puts the patient in the
// Act now group of the sheet; there is no separate panel of typed-in cards.
describe("Handover recorded form timings", () => {
  it("never calls a passed typed time a breach", () => {
    renderAt(NOW_ANCHOR);
    const text = screen.getByTestId("ward-handover-sheet").textContent ?? "";
    expect(text.toLowerCase()).not.toContain("breach");
    expect(text).not.toContain("26h 48m");
  });

  it("puts every recorded form whose typed time has passed in Act now once the clock passes it", () => {
    renderAt(NOW_ANCHOR);
    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));
    expect(expectedIds().length).toBeGreaterThan(0);
    const act = screen.getByTestId("ward-handover-group-act");
    const ids = within(act)
      .queryAllByRole("row")
      .map((row) => row.getAttribute("data-row-id"))
      .filter((id): id is string => id !== null);
    for (const id of expectedIds()) expect(ids).toContain(id);
    expect(act.textContent ?? "").toMatch(/Form \S+ time passed/);
  });
});
