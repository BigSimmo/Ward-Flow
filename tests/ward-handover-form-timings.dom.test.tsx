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
import { clockState } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** The movements the panel must list, worked out from the records the page itself reads. */
function ExpectedProbe() {
  const { movements, now } = useWardFlow();
  const ids = movements
    .filter((movement) => {
      if (!isOpen(movement)) return false;
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt === undefined) return false;
      const state = clockState(dueAt, now);
      return state === "breached" || state === "critical";
    })
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

describe("Handover recorded form timings", () => {
  it("lists only recorded movements, never the typed-in patient cards", () => {
    renderAt(NOW_ANCHOR);
    const pane = document.getElementById("pane-breaches");
    expect(pane).not.toBeNull();
    const text = pane!.textContent ?? "";
    for (const invented of [
      "Tobias Wren · Peel ED",
      "Rowan Vance",
      "Kester Proudfoot",
      "Dermot Hawthorn",
      "Dermot Hawthornby",
      "26h 48m",
      "Graylands Bed 05 is held until 16:30",
    ]) {
      expect(text).not.toContain(invented);
    }
    const cards = within(pane!).queryAllByTestId("handover-form-timing-card");
    expect(cards).toHaveLength(expectedIds().length);
    if (cards.length === 0) {
      expect(within(pane!).getByTestId("handover-form-timings-empty")).toBeTruthy();
    }
    expect(text).toContain(`${expectedIds().length} passed or due within the hour`);
    expect(text.toLowerCase()).not.toContain("breach");
  });

  it("shows a card for every recorded form once the clock passes its due time", () => {
    renderAt(NOW_ANCHOR);
    fireEvent.click(screen.getByRole("button", { name: "advance clock" }));
    const pane = document.getElementById("pane-breaches")!;
    const cards = within(pane).queryAllByTestId("handover-form-timing-card");
    expect(expectedIds().length).toBeGreaterThan(0);
    expect(cards).toHaveLength(expectedIds().length);
    for (const card of cards) {
      expect(card.textContent).toMatch(/Form \S+ due time passed/);
      expect(card.textContent).toContain("Recorded due time");
    }
    expect(screen.queryByText(/Form 1A Breached/)).toBeNull();
  });
});
