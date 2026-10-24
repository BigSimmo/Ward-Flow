/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Sheet } from "@/components/wf/sheet";
import { PhoneSheet } from "@/components/wf/phone";
import {
  announceToWardShell,
  resetWardLiveRegionForTests,
  WardLiveRegion,
} from "@/components/ward-management/shell/ward-live-region";

afterEach(resetWardLiveRegionForTests);

describe.each([Sheet, PhoneSheet])("shell announcement above a modal (%s)", (Component) => {
  it("keeps the nested live region available while inerting background controls", () => {
    render(
      <>
        <div>
          <WardLiveRegion />
          <button type="button">Background control</button>
        </div>
        <Component open title="Tools" onClose={() => {}}>
          <button type="button" onClick={() => announceToWardShell("Tools opened.")}>
            Announce
          </button>
        </Component>
      </>,
    );
    const live = screen.getByTestId("ward-live-region");
    expect(live.closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Background control" }).closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Announce" }));
    expect(live).toHaveTextContent("Tools opened.");
    expect(live).toHaveAttribute("aria-live", "polite");
  });
});
