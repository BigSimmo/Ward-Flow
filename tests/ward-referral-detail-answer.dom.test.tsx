// D-79 (Josh, 23 Oct 2026): a ward reads the full referral before it answers, so the drawer carries its
// own Decline and Accept in principle. They act exactly as the card's do, for that referral only:
// Accept raises ACCEPT_IN_PRINCIPLE, Decline opens the one decline list (D-78), and a ward that may not
// answer (the site bed manager, D-80) gets both unavailable with nothing raised.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { MOVEMENT_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// WF-013 is referred to two older adult wards at once, so an answer must name this ward and no other.
const WARD = unitById("gry-older-adult")!;
const TARGET = "WF-013";
const target = seedWardFlowState().movements.find((movement) => movement.id === TARGET);
const otherWards = (target?.referredUnitIds ?? []).filter((id) => id !== WARD.id);

/** Record each event the screen raises, then let the real provider apply it. */
function Recorder({ events, children }: { events: WardFlowEvent[]; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    events.push(event);
    return flow.dispatch(event);
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function mount(events: WardFlowEvent[]) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Recorder events={events}>
        <WardScreen unitId={WARD.id} />
      </Recorder>
    </WardFlowProvider>,
  );
}

async function openReferral(movementId: string) {
  fireEvent.click(screen.getByTestId(`ward-incoming-open-${movementId}`));
  await screen.findByTestId(`ward-referral-detail-${movementId}`);
  // The answers sit in the drawer's footer, outside the referral body.
  return screen.getByTestId("ward-referral-detail-drawer");
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("answering from the full referral (D-79)", () => {
  it("starts from a seeded referral awaiting this ward and another", () => {
    expect(target?.stage).toBe("destination_review");
    expect(target?.acceptedUnitId).toBeFalsy();
    expect(target?.referredUnitIds).toContain(WARD.id);
    expect(otherWards.length).toBeGreaterThan(0);
  });

  it("Accept in principle raises the accept for that referral only and closes the drawer", async () => {
    const events: WardFlowEvent[] = [];
    mount(events);
    const detail = await openReferral(TARGET);

    fireEvent.click(within(detail).getByTestId(`ward-referral-detail-accept-${TARGET}`));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "ACCEPT_IN_PRINCIPLE",
      movementId: TARGET,
      unitId: WARD.id,
      actingUnitId: WARD.id,
    });
    for (const other of otherWards) expect(events[0]).not.toMatchObject({ unitId: other });
    await waitFor(() => expect(screen.queryByTestId(`ward-referral-detail-${TARGET}`)).toBeNull());
  });

  it("Decline opens the one decline list for that referral, not another, and raises nothing yet", async () => {
    const events: WardFlowEvent[] = [];
    mount(events);
    const detail = await openReferral(TARGET);

    fireEvent.click(within(detail).getByTestId(`ward-referral-detail-decline-${TARGET}`));

    await waitFor(() => expect(screen.queryByTestId(`ward-referral-detail-${TARGET}`)).toBeNull());
    expect(events).toHaveLength(0);
    const form = await screen.findByTestId(`ward-decline-form-${TARGET}`);
    expect(screen.getAllByTestId(/^ward-decline-form-/u)).toHaveLength(1);
    expect(screen.getByTestId(`ward-decline-toggle-${TARGET}`)).toHaveAttribute("aria-expanded", "true");
    // D-78: the same list the card uses, in its wording.
    const radios = within(form).getAllByRole("radio");
    expect(radios).toHaveLength(MOVEMENT_DECLINE_REASONS.length);
    for (const reason of MOVEMENT_DECLINE_REASONS) {
      expect(within(form).getByLabelText(DECLINE_REASON_LABELS[reason])).toBeInTheDocument();
    }

    fireEvent.click(radios[0]);
    fireEvent.click(within(form).getByRole("button", { name: "Confirm decline" }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "DECLINE", movementId: TARGET, unitId: WARD.id });
  });

  it("leaves both answers unavailable, and raises nothing, when this desk may not answer (D-80)", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: WARD.siteCode } });
    });
    const events: WardFlowEvent[] = [];
    mount(events);
    const detail = await openReferral(TARGET);

    const accept = within(detail).getByTestId(`ward-referral-detail-accept-${TARGET}`);
    const decline = within(detail).getByTestId(`ward-referral-detail-decline-${TARGET}`);
    expect(accept).toHaveAttribute("aria-disabled", "true");
    expect(decline).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(accept);
    fireEvent.click(decline);

    expect(events).toHaveLength(0);
    expect(screen.getByTestId(`ward-referral-detail-${TARGET}`)).toBeInTheDocument();
    expect(screen.queryByTestId(/^ward-decline-form-/u)).toBeNull();
  });
});
