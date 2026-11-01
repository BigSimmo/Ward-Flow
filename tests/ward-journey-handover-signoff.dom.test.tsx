import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { handoverSignedAt } from "@/components/ward-management/handover/handover-model";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";

let flow: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  }, [value]);
  return null;
}

describe("handover sign-off selection integrity", () => {
  it.each([
    [600, "am", "07:00", false],
    [600, "pm", "15:00", true],
    [600, "ev", "23:00", false],
    [360, "am", "07:00", true],
    [960, "ev", "23:00", true],
    [1410, "am", "07:00", true],
  ] as const)("at %s selecting %s signs only the offered shift", (now, shift, time, allowed) => {
    render(
      <WardFlowProvider initialNow={now}>
        <HandoverPage />
        <Probe />
      </WardFlowProvider>,
    );
    // 1 Nov 2026 redesign: one handover menu, and the checklist opens from the sign-off bar.
    fireEvent.click(screen.getByTestId("ward-handover-shift"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: new RegExp(time) }));
    fireEvent.click(
      within(screen.getByTestId("ward-handover-sign-bar")).getByRole("button", { name: "Open checklist" }),
    );
    const button = screen.queryByTestId("ward-handover-sign-off-button");
    if (!allowed) {
      expect(
        button === null || button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true",
      ).toBe(true);
      if (button) fireEvent.click(button);
      expect(flow.handoverSignOffs).toHaveLength(0);
    } else {
      expect(button).not.toBeNull();
      fireEvent.click(button!);
      expect(flow.handoverSignOffs).toHaveLength(1);
      expect(handoverSignedAt(flow.handoverSignOffs, shift, now)).toBe(now);
    }
  });

  it("assigns a boundary timestamp to exactly one handover", () => {
    const records = [{ at: 900 }];
    expect(handoverSignedAt(records, "pm", 900)).toBeNull();
    expect(handoverSignedAt(records, "ev", 900)).toBe(900);
  });
});
