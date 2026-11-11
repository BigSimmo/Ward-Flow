import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocalSettingsNote } from "@/components/ward-management/shell/local-settings-note";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit M123 (Josh, 10 Nov 2026): once a shared rule is away from its default, the shared views
 * say so in one line. The line comes from the live configuration, so a Settings save shows at once.
 */

function ChangeHold() {
  const { dispatch, configuration, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "SET_CONFIGURATION",
          role: "coordinator",
          now,
          payload: { ...configuration, pullHoldMinutes: configuration.pullHoldMinutes - 15 },
        })
      }
    >
      Change
    </button>
  );
}

describe("M123 local settings line", () => {
  it("is absent at the defaults and names the rule once one changes", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LocalSettingsNote />
        <ChangeHold />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-local-settings")).toBeNull();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Change" }));
    });
    expect(screen.getByTestId("ward-local-settings").textContent).toMatch(/^Local settings in use: Pull time limit /);
  });

  it.each([
    ["the TV", "src/components/ward-management/bed-meeting/bed-meeting-tv.tsx", "bed-meeting-tv-local-settings"],
    [
      "the meeting TV top",
      "src/components/ward-management/bed-meeting/bed-meeting-tv-top.tsx",
      "bed-meeting-tv-local-settings",
    ],
    ["every print footer", "src/components/ward-management/shell/ward-access.tsx", "ward-print-local-settings"],
    [
      "the weekly report",
      "src/components/ward-management/reports/weekly-report-screen.tsx",
      "ward-weekly-local-settings",
    ],
  ])("is shown on %s", (_view, file, testId) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).toContain(`<LocalSettingsNote`);
    expect(source).toContain(`testId="${testId}"`);
  });
});
