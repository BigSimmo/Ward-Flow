import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WITHDRAWING A REFERRAL — and, more importantly, NOT OFFERING IT WHERE THE REDUCER WOULD REFUSE.
 *
 * ⚠️ **The control's availability is the thing under test, not the withdrawal.** A button that
 * offers an action the reducer will bounce teaches a clinician that this screen's controls are
 * decorative. That is the single lesson a prototype must never teach, so each refusal is asserted
 * as an UNAVAILABLE CONTROL rather than as a rejected event.
 *
 * 🔴 **CORRECTED, Ward Lead audit (2026-09-17).** Until this date this file pinned a STALE UI
 * rule — "already accepted" alone blocked withdrawal — that predated WLQ-38 (owner, 2026-09-15)
 * and had drifted from the reducer it claims to restate: `withdrawReferralBlockedReason`
 * (`ed-screen.tsx`) went on blocking an accepted referral even after the reducer's own
 * post-acceptance branch started permitting the referrer (`ed`, the only role this screen ever
 * dispatches as) to revoke one, once, up until the patient is collected. That is the opposite of
 * the usual wiring defect this file's own header warns about: not a button the reducer refuses,
 * but a button withheld from an action the reducer allows. The real remaining block for an
 * accepted movement is COLLECTION, not acceptance — this file now pins that.
 */

const ED_ID = "fsh-ed";

const seenRef: { current: Movement[] } = { current: [] };

function MovementProbe() {
  const movements = useWardFlow().movements;
  useLayoutEffect(() => {
    seenRef.current = movements;
  });
  return null;
}

function renderEd() {
  seenRef.current = [];
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={ED_ID} />
      <MovementProbe />
    </WardFlowProvider>,
  );
}

/** Movements this department is holding open, which is exactly what the patients section lists. */
function openHere(): Movement[] {
  return seenRef.current.filter(
    (movement) => movement.originEdId === ED_ID && !movement.closure && movement.stage !== "arrived",
  );
}

function toggleFor(movementId: string): HTMLElement {
  return screen.getByTestId(`ward-ed-withdraw-referral-toggle-${movementId}`);
}

describe("withdrawing a referral from the emergency department", () => {
  it("offers the control only where the reducer would accept it", () => {
    renderEd();
    const movements = openHere();
    expect(movements.length).toBeGreaterThan(0);

    // Every open movement carries the control. Availability is what varies, never presence — an
    // absent control cannot explain itself, and the reason is the point.
    //
    // 🔴 CORRECTED (Ward Lead audit, 2026-09-17): `acceptedUnitId !== undefined` is no longer a
    // block on its own — WLQ-38 lets this screen's own role (`ed`) revoke an accepted referral —
    // so `withdrawable` now matches the reducer's real post-acceptance permission: blocked only
    // once the patient has been collected, or (pre-acceptance) once no live referral remains.
    for (const movement of movements) {
      const toggle = toggleFor(movement.id);
      const withdrawable =
        movement.transport?.collectedAt === undefined &&
        (movement.acceptedUnitId !== undefined || movement.referredUnitIds.length > 0);
      expect(toggle.getAttribute("aria-disabled")).toBe(withdrawable ? null : "true");
      if (!withdrawable) {
        // The reason must be readable, not merely implied by the control being inert.
        //
        // `getAllByText`, not `getByText`: the collected-patient wording (P2-5, this file's own
        // header) is now a fixed sentence shared by every collected movement, unlike the old
        // per-movement text every blocked reason used to carry — `fsh-ed`'s fixture holds more
        // than one, so `getByText`'s single-match requirement would throw on real, correct output.
        expect(toggle.getAttribute("title")).toBeTruthy();
        expect(screen.getAllByText(String(toggle.getAttribute("title"))).length).toBeGreaterThan(0);
      }
    }
  });

  /*
   * 🔴 REPURPOSED (Ward Lead audit, 2026-09-17): this used to assert the STALE rule — see this
   * file's own header — that an accepted referral could never be withdrawn from here. It now
   * proves the two real halves of WLQ-38's post-acceptance permission on this screen: an accepted
   * but uncollected movement (WF-029, `fsh-ed`, `stage: "pulled"`, no transport job yet) IS
   * withdrawable, and one already collected (WF-014, `fsh-ed`, `stage: "moving"`,
   * `transport.collectedAt` set) is blocked — by collection, not by acceptance — and tells the ED
   * to ask the coordinator to use "Stop transport" on the console (owner answer 8, second round)
   * rather than naming the internal event STOP_TRANSPORT.
   */
  it("permits withdrawing an accepted-but-uncollected referral, and blocks only once collected", () => {
    renderEd();
    const uncollectedAccepted = openHere().find(
      (movement) => movement.acceptedUnitId !== undefined && movement.transport?.collectedAt === undefined,
    );
    expect(
      uncollectedAccepted,
      "the fixture must carry an accepted, uncollected movement or this asserts nothing",
    ).toBeTruthy();
    expect(toggleFor(uncollectedAccepted!.id).getAttribute("aria-disabled")).toBeNull();

    const collected = openHere().find((movement) => movement.transport?.collectedAt !== undefined);
    expect(collected, "the fixture must carry a collected movement or this asserts nothing").toBeTruthy();
    const collectedToggle = toggleFor(collected!.id);
    expect(collectedToggle.getAttribute("aria-disabled")).toBe("true");
    const title = collectedToggle.getAttribute("title") ?? "";
    expect(title).toContain(
      'Ask the coordinator to stop the journey, using the "Stop transport" control on the console',
    );
    expect(title).not.toContain("STOP_TRANSPORT");
  });

  it("withdraws every live referral, closes the movement, and keeps it on the board as 'Withdrawn'", () => {
    renderEd();
    const target = openHere().find(
      (movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
    );
    expect(target, "the fixture must carry a withdrawable movement or this asserts nothing").toBeTruthy();
    const id = target!.id;

    fireEvent.click(toggleFor(id));
    fireEvent.click(screen.getByTestId(`ward-ed-withdraw-referral-confirm-${id}`));

    const after = seenRef.current.find((movement) => movement.id === id);
    expect(after?.referredUnitIds).toEqual([]);
    expect(after?.closure?.outcome).toBe("did_not_proceed");
    // The vocabulary is the owner's, never the caller's — the event carries no reason field.
    expect(after?.withdrawnReferrals.every((entry) => entry.reason === "referrer_withdrew")).toBe(true);
    // 🔴 CORRECTED (Ward Lead audit, 2026-09-17): the row used to leave the board entirely on
    // withdrawal, which is what this assertion checked until today. It now stays, under its own
    // "Withdrawn" chip — this department raised the withdrawal and stays accountable for it.
    expect(screen.getByTestId(`ward-ed-patient-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`ward-ed-withdrawn-reason-${id}`)).toHaveTextContent(
      "Withdrawn: The referrer withdrew the referral",
    );
  });

  it("keeps the referral when the second step is declined", () => {
    renderEd();
    const target = openHere().find(
      (movement) => movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0,
    );
    const id = target!.id;
    const before = [...target!.referredUnitIds];

    fireEvent.click(toggleFor(id));
    fireEvent.click(screen.getByTestId(`ward-ed-withdraw-referral-cancel-${id}`));

    expect(seenRef.current.find((movement) => movement.id === id)?.referredUnitIds).toEqual(before);
    expect(screen.queryByTestId(`ward-ed-withdraw-referral-${id}`)).toBeNull();
    expect(screen.getByTestId(`ward-ed-patient-${id}`)).toBeTruthy();
  });
});
