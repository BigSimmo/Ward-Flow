import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RUNWAY_MARKER_GAP_PX,
  RUNWAY_MARKER_HALF_PX,
  WaitRunway,
  runwayMarkerPercent,
  runwayGapPercent,
  runwayLanes,
} from "@/components/ward-management/referrals/referral-board-parts";
import { referrals } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Six synthetic referrals 12 minutes apart: 5% of the runway, under a marker on a narrow track. */
function closeWaits() {
  const base = referrals[0]!;
  return [5, 17, 29, 41, 53, 65].map((minutes, index) => ({
    ...base,
    id: `RF-LANE-${index}`,
    // Instants are minutes; no triage time, so each wait runs to now.
    raisedAt: NOW_ANCHOR - minutes,
    triagedAt: undefined,
  }));
}

function renderAtWidth(trackPx: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(trackPx);
  render(
    <WaitRunway
      queued={closeWaits()}
      now={NOW_ANCHOR}
      selectedId={undefined}
      isHighlighted={() => false}
      nameOf={(referral) => referral.id}
      onSelect={() => {}}
    />,
  );
  return within(screen.getByRole("group", { name: /Waiting time/u }))
    .getAllByRole("button")
    .map((marker) => ({ left: parseFloat(marker.style.left), bottom: marker.style.bottom }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Referrals waiting runway keeps close markers apart", () => {
  it("lays markers on the lowest lane with room, never moving their position", () => {
    expect(runwayLanes([10, 12, 14, 16, 40], 4)).toEqual([0, 1, 0, 1, 0]);
    expect(runwayLanes([10, 11, 12], 4)).toEqual([0, 1, 2]);
  });

  it("sizes the gap from the measured track, falling back to the old share before measuring", () => {
    expect(runwayGapPercent(undefined, false)).toBe(4);
    expect(runwayGapPercent(undefined, true)).toBe(8);
    expect(runwayGapPercent(280, false)).toBeCloseTo((RUNWAY_MARKER_GAP_PX / 280) * 100);
  });

  it("holds a marker at either end of the track inside it, by half a marker", () => {
    const half = (px: number) => (RUNWAY_MARKER_HALF_PX / px) * 100;
    expect(runwayMarkerPercent(100, 600, false)).toBeCloseTo(100 - half(600));
    expect(runwayMarkerPercent(0, 600, false)).toBeCloseTo(half(600));
    expect(runwayMarkerPercent(50, 600, false)).toBe(50);
    // Before measuring, the same fallback width as the lane gap (4% stands for 28px).
    expect(runwayMarkerPercent(100, undefined, false)).toBeCloseTo(
      100 - (4 * RUNWAY_MARKER_HALF_PX) / RUNWAY_MARKER_GAP_PX,
    );
  });

  for (const trackPx of [236, 271, 306, 462, 670, 1150]) {
    it(`never puts two markers within ${RUNWAY_MARKER_GAP_PX}px on one lane at a ${trackPx}px track`, () => {
      const markers = renderAtWidth(trackPx);
      expect(markers).toHaveLength(6);
      for (const [index, a] of markers.entries()) {
        for (const b of markers.slice(index + 1)) {
          if (a.bottom !== b.bottom) continue;
          expect(Math.abs(a.left - b.left) * (trackPx / 100)).toBeGreaterThanOrEqual(RUNWAY_MARKER_GAP_PX - 0.01);
        }
      }
    });
  }
});
