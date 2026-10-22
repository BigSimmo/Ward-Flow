import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Fix plan item 16 (D-76, mock-up version 2 locked in 22 Oct 2026): the coordinator asks more wards
 * about an open community referral from the decision pane. Synthetic data only.
 */

/** The id the reducer gives the first `RECEIVE_REFERRAL` against a freshly seeded state. */
const RAISED_ID = "RF-901";

function SeedCommunityReferral({ unitId }: { unitId: string }) {
  const { now, dispatch } = useWardFlow();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId,
          sex: "Male",
          gender: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Midland" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
  }, [now, dispatch, unitId]);
  return null;
}

function Harness() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const referral = referrals.find((candidate) => candidate.id === RAISED_ID);
  if (!referral) return null;
  return (
    <ReferralMatchView
      referral={referral}
      units={units}
      now={now}
      dispatch={dispatch}
      rejections={rejections}
      phone={null}
    />
  );
}

function FirstOpenUnit() {
  const { units } = useWardFlow();
  const unit = units.find((candidate) => candidate.cohort === "Adult" && !candidate.isClosed);
  return unit ? <SeedCommunityReferral unitId={unit.id} /> : null;
}

function renderPane() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FirstOpenUnit />
      <Harness />
    </WardFlowProvider>,
  );
}

function fitBoxes(card: HTMLElement) {
  return within(within(card).getByRole("group", { name: "Fits, bed ready" })).getAllByRole("checkbox");
}

describe("Ask more wards on a community referral (fix plan item 16, D-76)", () => {
  it("lists the ward asked, opens an A to Z list, swaps the footer and asks the chosen wards", () => {
    renderPane();
    const card = screen.getByTestId("ward-referral-ask-more-wards");
    expect(within(card).getByTestId("ward-referral-ask-waiting")).toHaveTextContent("1 of 3 waiting");
    expect(within(card).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.click(within(card).getByRole("button", { name: "Ask more wards" }));
    // One set of actions: Cancel and Ask replace Decline and Accept while the list is open.
    expect(screen.queryByTestId("ward-referral-match-decline-open")).toBeNull();
    expect(screen.getByRole("button", { name: "Pick up to 2 wards" })).toHaveAttribute("aria-disabled", "true");

    const boxes = fitBoxes(card);
    const names = boxes.map((box) => box.getAttribute("aria-label") ?? "");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(boxes.length).toBeGreaterThanOrEqual(3);

    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    // The cap is 3 waiting and one ward already waits, so a third tick is refused.
    expect(boxes[2]).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Ask 2 wards" }));
    const after = screen.getByTestId("ward-referral-ask-more-wards");
    expect(within(after).getByTestId("ward-referral-ask-waiting")).toHaveTextContent("3 of 3 waiting");
    expect(within(after).getAllByRole("listitem")).toHaveLength(3);
    expect(within(after).getByRole("button", { name: "Ask more wards" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-referral-match-decline-open")).toBeInTheDocument();
  });

  it("Cancel closes the list, clears the ticks and brings Decline back", () => {
    renderPane();
    const card = screen.getByTestId("ward-referral-ask-more-wards");
    fireEvent.click(within(card).getByRole("button", { name: "Ask more wards" }));
    fireEvent.click(fitBoxes(card)[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-referral-ask-list")).toBeNull();
    expect(screen.getByTestId("ward-referral-match-decline-open")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Ask more wards" }));
    expect(fitBoxes(card).every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  });
});
