import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { applyDueSoonThresholds, clockState } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh, 26 Sept 2026 ("All yes", question 3): the 1-hour and 3-hour warnings before a recorded legal
 * due time are his defaults, changeable in Settings. A saved configuration must reach every
 * `clockState` reading, not only the screen that saved it.
 */
function ClockProbe({ minutesToDue }: { minutesToDue: number }) {
  const { now, dispatch, configuration } = useWardFlow();
  return (
    <>
      <output data-testid="state">{clockState(now + minutesToDue, now)}</output>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "SET_CONFIGURATION",
            role: "coordinator",
            now,
            payload: { ...configuration, dueSoonUrgentMinutes: 30, dueSoonMinutes: 120 },
          })
        }
      >
        save
      </button>
    </>
  );
}

afterEach(() => applyDueSoonThresholds(DUE_SOON_URGENT_MINUTES, DUE_SOON_MINUTES));

describe("due-time warnings follow Settings", () => {
  it("uses the defaults until Settings changes them, then the saved values", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ClockProbe minutesToDue={45} />
      </WardFlowProvider>,
    );
    // 45 minutes out: inside the default first warning (60).
    expect(screen.getByTestId("state").textContent).toBe("critical");
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    // After saving 30 and 120: 45 minutes out is past the first warning but inside the second.
    expect(screen.getByTestId("state").textContent).toBe("due");
  });

  it("outside a provider, the defaults hold", () => {
    expect(clockState(NOW_ANCHOR + 45, NOW_ANCHOR)).toBe("critical");
    expect(clockState(NOW_ANCHOR + 150, NOW_ANCHOR)).toBe("due");
    expect(clockState(NOW_ANCHOR + 200, NOW_ANCHOR)).toBe("clear");
  });
});
