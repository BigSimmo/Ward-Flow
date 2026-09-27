import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Opus review round 2, 17 September 2026 (P2), item 6: when the ED raises a movement from a
 * front-door referral that already recorded a gender on its own ward arm, the "Raise a referral"
 * form should start with that gender already chosen — still editable, never locked — rather than
 * making the clinician re-answer a question the front door already asked.
 *
 * `RECEIVE_REFERRAL` and `RECORD_ARRIVED_IN_DEPARTMENT` are dispatched directly, the same
 * discipline `tests/ward-coordinator-suburb.dom.test.tsx` holds to for linking a referral before
 * the screen under test ever sees it — building a fixture no seeded referral happens to hold
 * (an ED-addressed, arrived, ward-arm-gendered referral) is the point of this file, not something
 * to route around.
 */
const ED_ID = "jhc-ed";

function LastMovementProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <>
      <p data-testid="last-movement-probe">
        {last?.id ?? "no-movement"}|{last?.gender ?? "no-gender"}|{last?.referralId ?? "no-referral-link"}
      </p>
    </>
  );
}

function ReceiveAndArrive() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => {
        dispatch({
          type: "RECEIVE_REFERRAL",
          role: "community",
          now,
          ageBand: "Adult",
          destinations: [
            {
              kind: "psychiatric_ward",
              sex: "Female",
              gender: "Female",
              secureBedNeeded: false,
              involuntaryBedNeeded: false,
              highAcuityNursingNeeded: false,
            },
            { kind: "emergency_department", edId: ED_ID, purpose: "psychiatric_review" },
          ],
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "named", name: "Armadale" },
          source: "community",
          urgency: 2,
          originSiteCode: "SCGH",
          transportNeeded: false,
          ...FIXTURE_HISTORY,
        } as never);
      }}
    >
      receive referral
    </button>
  );
}

function referralIdFrom(state: ReturnType<typeof useWardFlow>): string {
  const created = state.referrals.at(-1);
  if (!created) throw new Error("RECEIVE_REFERRAL must have created a referral");
  return created.id;
}

function ArriveButton() {
  const flow = useWardFlow();
  const { dispatch, now } = flow;
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "RECORD_ARRIVED_IN_DEPARTMENT", role: "ed", now, referralId: referralIdFrom(flow) })
      }
    >
      mark arrived
    </button>
  );
}

function renderEdScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReceiveAndArrive />
      <ArriveButton />
      <EdScreen edId={ED_ID} />
      <LastMovementProbe />
    </WardFlowProvider>,
  );
}

describe("ED screen: raising into a movement prefills gender from the linked referral", () => {
  it('prefills "Female" from the referral\'s own ward-arm gender, still editable, and links referralId on submit', () => {
    renderEdScreen();
    fireEvent.click(screen.getByRole("button", { name: "receive referral" }));
    fireEvent.click(screen.getByRole("button", { name: "mark arrived" }));

    const raiseButtons = screen.getAllByTestId(/^ward-ed-inbox-raise-/);
    expect(raiseButtons).toHaveLength(1);
    fireEvent.click(raiseButtons[0]!);

    const genderSelect = screen.getByTestId("ward-ed-referral-gender") as HTMLSelectElement;
    expect(genderSelect.value).toBe("Female");

    // Still editable — a clinician can change what the referral prefilled.
    fireEvent.change(genderSelect, { target: { value: "Non-binary" } });
    expect(genderSelect.value).toBe("Non-binary");

    // Fill the remaining required fields and submit.
    fireEvent.change(screen.getByTestId("ward-ed-referral-cohort"), { target: { value: "Adult" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-security"), { target: { value: "Open" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-sex"), { target: { value: "Female" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-status"), { target: { value: "Voluntary" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-urgency"), { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    const [id, gender, referralLink] = (screen.getByTestId("last-movement-probe").textContent ?? "").split("|");
    expect(id).not.toBe("no-movement");
    expect(gender).toBe("Non-binary");
    expect(referralLink).not.toBe("no-referral-link");

    /*
     * P2-6 (Ward Lead audit, 2026-09-17): the referral's ED addressing stays `queued` after
     * `RAISE_REFERRAL` (nothing in that case above settles it), so before this fix the inbox row
     * stayed on screen with its "Raise into a movement" button still offered — a second click
     * would raise a SECOND journey for the same person. It must now be hidden once any movement is
     * linked to this referral, open or closed.
     */
    expect(
      screen.queryAllByTestId(/^ward-ed-inbox-raise-/),
      "the button must disappear once this referral already has a linked movement",
    ).toHaveLength(0);
  });
});
