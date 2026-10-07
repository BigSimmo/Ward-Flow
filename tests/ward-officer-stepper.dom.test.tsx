import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE TRANSPORT-LEG STEPPER, added to the transport officer's job cards per
 * `docs/ward-flow/build-contracts-2026-09-12/contract-transport-officer.md` §"What was built".
 *
 * WF-005 is the seeded fixture's own case (`ward-movements.ts`): `transport.acceptedAt` is set and
 * `enRouteAt`/`collectedAt`/`arrivedAt` are not, so `transportLeg` reads "Accepted" and the next
 * action is "en route" — a real value read off the seed, never invented for this test.
 *
 * 🔴 THIS IS AN ADDITIVE CHECK, NOT A REPLACEMENT FOR THE PLAYWRIGHT ONE. `ui-ward-roles.spec.ts`
 * ("gives the officer four actions and nothing else") already pins the four-button action row as
 * deliberate — this stepper renders BESIDE that row, inside the same job card, and must never grow
 * into a fifth button or change that count. `getByRole("button")` scoped to the stepper element
 * below asserts zero, which is what would go red the moment the stepper stopped being purely
 * informational.
 */
afterEach(cleanup);

function renderOfficer() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OfficerScreen />
    </WardFlowProvider>,
  );
}

describe("the transport officer's job cards render a leg stepper", () => {
  it("renders WF-005's stepper naming its real stage and real next action, in visible text", () => {
    renderOfficer();

    const stepper = screen.getByTestId("ward-officer-stepper-WF-005");
    expect(stepper).toHaveAttribute("role", "img");
    // The bar is never the only carrier of the stage (§6.11) — the same sentence must also be
    // readable as ordinary page text, not only inside an aria-label a sighted reader never sees.
    expect(stepper).toHaveAttribute("aria-label", "Transport stage: Accepted, next en route");

    const card = stepper.closest('[data-testid="ward-officer-job-WF-005"]');
    expect(card, "the stepper must live inside the job's own row").not.toBeNull();
    // The stage line is the stepper's own next sibling, not merely somewhere inside the card —
    // scoping this way (rather than `getByText`) avoids colliding with the "Accepted" action
    // button label that also renders inside the same card.
    const stageLine = stepper.nextElementSibling;
    expect(stageLine?.tagName).toBe("P");
    expect(stageLine?.textContent).toBe("Accepted, next en route");
  });

  it("marks WF-005's own stage as done/now/todo in the same order transportLeg reports it", () => {
    renderOfficer();

    const stepper = screen.getByTestId("ward-officer-stepper-WF-005");
    const bars = stepper.querySelectorAll("span");
    expect(bars).toHaveLength(4);
    // Requested (index 0) is behind Accepted (index 1, the current leg): done, now, todo, todo.
    expect(Array.from(bars).map((bar) => bar.getAttribute("data-s"))).toEqual(["done", "now", "todo", "todo"]);
  });

  it("never adds a button to the job card — the four-action row stays the only controls", () => {
    renderOfficer();

    const stepper = screen.getByTestId("ward-officer-stepper-WF-005");
    expect(within(stepper as HTMLElement).queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a stepper for every job on the list, not only the selected one", () => {
    renderOfficer();

    const joblist = screen.getByTestId("ward-officer-joblist");
    const jobCards = within(joblist).getAllByTestId(/^ward-officer-job-/);
    const steppers = within(joblist).getAllByTestId(/^ward-officer-stepper-/);
    expect(
      steppers.length,
      'every job card must carry its own stepper, per the screen\'s own "shows every job" rule',
    ).toBe(jobCards.length);
  });
});
