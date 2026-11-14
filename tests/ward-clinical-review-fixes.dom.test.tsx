import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { boardRows, OVER_24H } from "@/components/ward-management/delays/delays-board-model";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { NextCrossings } from "@/components/ward-management/delays/waiting-next-crossings";
import {
  TOUR_ROLE_LABELS,
  tourSteps as liveTourSteps,
  type TourRole,
} from "@/components/ward-management/help/ward-tour-steps";
import { MovementCheckInDrawer } from "@/components/ward-management/movements/movement-check-in-drawer";
import { BED_FINDER_NOTE } from "@/components/ward-management/tools/ward-bed-finder";
import { OfficerFormsCell } from "@/components/ward-management/officer/officer-forms-pack";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { tourSteps as popTourSteps } from "@/components/ward-redesign/pop-tour/tour-steps";
import {
  collectionGaps,
  transportOrderFactWords,
  transportOrderGap,
} from "@/components/ward-management/ward-transport-checks";
import { TRANSPORT_PAPERWORK_STATUS_WORDS } from "@/components/ward-management/ward-transport-paperwork";

/**
 * The independent clinical review's must-fix items R3 to R6 and R8 (14 Nov 2026). Synthetic records
 * only. R3 and R4: the Movements check-in drawer and the officer's forms cell read the one transport
 * paperwork rule and say "rule not signed" (D-186 item 6, D-189 item 8(b)). R5: a wait past 24 hours
 * is neutral on the Delays board's owner tile and the next-crossings strip (D-194 item 3). R6: the bed
 * finder no longer says the referral checks every rule. R8: the capacity table mock-up states no
 * ward's authorisation (D-189 item 6).
 */

// The Delays board draws Whose move as a band on a phone.
const device = vi.hoisted(() => ({ phone: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => device.phone,
}));

afterEach(() => {
  cleanup();
  device.phone = false;
});

/** The live wards, which the paperwork rule reads for the destination's site. */
const UNITS = seedWardFlowState().units;

const job = (fields: Partial<Movement>) =>
  ({
    id: "WF-SYN-1",
    referredUnitIds: [],
    uploadedForms: [],
    transport: { id: "WF-SYN-1-transport" },
    ...fields,
  }) as unknown as Movement;

describe("R3: the check-in drawer's Transport order fact reads the one rule", () => {
  it("reads Recorded for a recorded Form 4C, the same answer as the collection check", () => {
    const movement = job({ legalStatus: "Involuntary inpatient", legalForm: { code: "4C" } as never });
    expect(transportOrderGap(movement, UNITS)).toBe(false);
    expect(collectionGaps(movement, UNITS)).not.toContain("transport_order_missing");
    expect(transportOrderFactWords(movement, UNITS)).toBe(`Recorded · ${TRANSPORT_PAPERWORK_STATUS_WORDS}`);
  });

  it("reads Not recorded only when the collection check is open, and says rule not signed", () => {
    const movement = job({ legalStatus: "Involuntary inpatient" });
    expect(collectionGaps(movement, UNITS)).toContain("transport_order_missing");
    expect(transportOrderFactWords(movement, UNITS)).toBe("Not recorded · rule not signed");
  });

  it("reads Not needed for a voluntary journey", () => {
    expect(transportOrderFactWords(job({ legalStatus: "Voluntary" }), UNITS)).toBe("Not needed · rule not signed");
  });

  it("shows the one rule's answer in the drawer, for every open journey of the seed", () => {
    const seed = seedWardFlowState();
    const open = seed.movements.filter((movement) => !movement.closure);
    const answers = new Set<string>();
    for (const movement of open) {
      const view = render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <MovementCheckInDrawer movementId={movement.id} now={NOW_ANCHOR} onClose={() => {}} />
        </WardFlowProvider>,
      );
      const label = within(view.baseElement).getByText("Transport order");
      const expected = transportOrderFactWords(movement, seed.units);
      expect(label.parentElement, movement.id).toHaveTextContent(expected);
      answers.add(expected.split(" · ")[0]!);
      view.unmount();
    }
    // Not vacuous: the seed reaches more than one answer.
    expect(answers.size).toBeGreaterThan(1);
  });
});

describe("R4: the officer's forms cell says rule not signed", () => {
  it("names the open order with the rule's own words", () => {
    render(<OfficerFormsCell movement={job({ legalStatus: "Involuntary inpatient" })} units={UNITS} />);
    expect(screen.getByText(`Order not uploaded · ${TRANSPORT_PAPERWORK_STATUS_WORDS}`)).toBeInTheDocument();
    expect(screen.queryByText("Order not uploaded · not signed")).toBeNull();
  });
});

describe("R5: a wait past 24 hours is neutral on the Delays board (D-194 item 3)", () => {
  // The owner tile's stylesheet colour for data-band 3 is in ward-clinical-source-guards.test.ts.
  it.each([
    ["the desk's owner tiles", false],
    ["the phone's Whose move band", true],
  ])("draws no longest wait in danger red on %s, with a wait past 24 hours on the board", (_where, phone) => {
    const seed = seedWardFlowState();
    const rows = boardRows(
      delayGroups(seed.movements, seed.units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS),
      NOW_ANCHOR,
    );
    expect(
      rows.some((row) => row.waited >= OVER_24H),
      "a wait past 24 hours on the seed board",
    ).toBe(true);
    device.phone = phone;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );
    const tiles = phone ? [screen.getByTestId("delays-whose-move")] : screen.getAllByTestId(/^delays-owner-/u);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles)
      expect(tile.querySelectorAll('[data-tone="danger"]'), tile.textContent ?? "").toHaveLength(0);
    // On the desk the past-24-hours tile is marked band 3; its colour is the stylesheet's (source guards).
    if (!phone) expect(tiles.some((tile) => tile.querySelector('[data-band="3"]') !== null)).toBe(true);
  });

  it("keeps the next-crossings 24 hour count and marks out of danger red", () => {
    const seed = seedWardFlowState();
    const rows = boardRows(
      delayGroups(seed.movements, seed.units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS),
      NOW_ANCHOR,
    );
    // One synthetic row an hour short of 24 hours, so a 24 hour crossing is on the strip.
    const nearly = { ...rows[0]!, waited: OVER_24H - 60, dueIn: undefined };
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NextCrossings rows={[nearly]} now={NOW_ANCHOR} selectedId={null} onPick={() => {}} />
      </WardFlowProvider>,
    );
    const strip = screen.getByTestId("delays-next-crossings");
    expect(strip.querySelectorAll('[data-tone="danger"]')).toHaveLength(0);
    const runs = [...strip.querySelectorAll("[data-tone]")].map((node) => node.getAttribute("data-tone"));
    expect(runs.filter((tone) => tone === "neutral").length).toBeGreaterThan(1);
    // The count's wording stays for Josh to judge at the walk.
    expect(
      within(strip)
        .getAllByText(/^pass /u)[0]!
        .closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "warning");
    expect(
      within(strip)
        .getAllByText(/^pass /u)[1]!
        .closest("[data-tone]"),
    ).toHaveAttribute("data-tone", "neutral");
  });
});

describe("R6: the bed finder claims nothing about every rule", () => {
  it("says the referral still runs its other bed checks, in the finder and both tours", () => {
    expect(BED_FINDER_NOTE).not.toMatch(/every rule/iu);
    expect(BED_FINDER_NOTE).toContain("The referral still runs the other bed checks before a bed is offered.");
    const roles = Object.keys(TOUR_ROLE_LABELS) as TourRole[];
    const text = [
      ...roles.flatMap((role) =>
        (["desk", "tablet", "phone"] as const).map((device) => JSON.stringify(liveTourSteps(role, device, {}))),
      ),
      ...roles.flatMap((role) =>
        (["desk", "phone"] as const).map((device) => JSON.stringify(popTourSteps(role, device, {}))),
      ),
    ].join("\n");
    expect(text).not.toMatch(/checks every rule/u);
    expect(text).toContain("The referral still runs its own bed checks.");
  });
});

describe("R8: the capacity table mock-up states no ward's authorisation (D-189 item 6)", () => {
  it("heads the column Involuntary admissions and reads Not stated for every ward", () => {
    const html = readFileSync("public/capacity-table-mockup.html", "utf8");
    expect(html).not.toContain("MHA Auth");
    expect(html).toContain(">Involuntary admissions</th>");
    expect(html).not.toMatch(/authorised:\s*(true|false)/u);
    expect(html).toMatch(/const authCell = `<span[^`]*>Not stated<\/span>`;/u);
  });
});
