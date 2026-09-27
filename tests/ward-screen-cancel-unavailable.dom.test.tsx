import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * THE WARD SCREEN STOPS OFFERING A CANCEL IT IS NO LONGER ALLOWED TO MAKE.
 *
 * `TR-D6` removed `ward` from `CANCEL_TRANSPORT`'s permitted roles: the receiving ward did not book
 * the job, and a booking cancelled by the destination is indistinguishable on the sending board
 * from one that failed. The reducer now refuses it at the role gate.
 *
 * ⚠️ **WHICH WOULD HAVE LEFT A BUTTON THAT DOES NOTHING — the exact defect this file's own screen
 * has a written rule against.** `ward-screen.tsx` carries the contract in a comment: *"each control
 * renders ONLY when the reducer would accept it — never dispatched optimistically and left for the
 * reducer to refuse silently."* A permission change made in the model is not finished until the
 * screens that exercised it agree, and nothing about a silently-refused dispatch is visible: the
 * form closes, the reason clears, and the transport is untouched.
 *
 * So the control goes, and the screen says who may cancel instead — a stated reason rather than a
 * disappearance, because a ward that used to have this button will otherwise assume it broke.
 */
/** A ward whose transport is still cancellable — see the second canary for why it matters. */
const UNIT = "fre-adult-open";

describe("the ward screen and the cancel it may no longer make", () => {
  function renderWard() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={UNIT} />
      </WardFlowProvider>,
    );
  }

  it("has `ward` permitted in the role table (scoped to booking ward per WLQ-11)", () => {
    // WLQ-11 restored `ward` to EVENT_ROLE.CANCEL_TRANSPORT, scoped in the reducer to booking ward.
    // The receiving ward (UNIT) cannot cancel, as asserted below. Owner answer 9 (third ruling,
    // 2026-09-17) added `community` under the identical booking-scoped check, against
    // `bookedBy.placeId` — see that case's own doc comment in ward-flow-reducer.ts.
    expect(EVENT_ROLE.CANCEL_TRANSPORT).toContain("ward");
    expect([...EVENT_ROLE.CANCEL_TRANSPORT].sort()).toEqual(["community", "coordinator", "ed", "ward"]);
  });

  it("⚠️ RENDERS A WARD THAT ACTUALLY HAS A CANCELLABLE TRANSPORT — the second canary", () => {
    // The first draft of this file used `rph-adult-secure`, whose only transported patient has
    // already been COLLECTED. `canCancel` was therefore false for reasons that had nothing to do
    // with TR-D6, and "no cancel control is on screen" passed before the change was even made.
    // A test that cannot distinguish "the ruling removed it" from "there was never one here"
    // proves nothing, so the precondition is asserted from the model rather than assumed.
    const cancellable = seedWardFlowState().movements.filter(
      (movement) =>
        movement.acceptedUnitId === UNIT &&
        movement.transport !== undefined &&
        movement.transport.collectedAt === undefined &&
        movement.transport.arrivedAt === undefined &&
        movement.transport.cancelledAt === undefined,
    );
    expect(
      cancellable.length,
      `${UNIT} must hold at least one movement whose transport is still cancellable, or the ` +
        "absence of a cancel control below is not evidence of anything",
    ).toBeGreaterThan(0);
  });

  it("offers no cancel-transport control anywhere on the screen", () => {
    renderWard();
    expect(
      screen.queryByRole("button", { name: /cancel transport/i }),
      "a control the reducer will always refuse is a button that does nothing, and this screen's " +
        "own rule is that a control renders only when the reducer would accept it",
    ).toBeNull();
  });

  it("says WHO may cancel, rather than letting the control vanish without explanation", () => {
    renderWard();
    const note = screen.getByTestId("ward-cancel-transport-unavailable");
    expect(note).toHaveTextContent(/coordinator/i);
    expect(
      note,
      "the note must name the booking team too — a ward told only that the coordinator can do it " +
        "will ring the coordinator when the sending department is the faster route",
    ).toHaveTextContent(/emergency department|booking/i);
  });
});
