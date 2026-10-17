import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  WARD_FEATURE_FLAGS_STORAGE_KEY,
  setWardFeatureFlagOnDevice,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** Top 25 item 1: confirming a discharge offers the support notices, honestly marked not wired. */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("top25-discharge-notices", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  window.history.replaceState(null, "", "/");
});

function confirmFirstRelease(flagOn: boolean) {
  act(() => {
    setWardFeatureFlagOnDevice("top25-discharge-notices", flagOn);
  });
  const state = seedWardFlowStateAt(0);
  const unit = state.units.find((candidate) =>
    state.bedReleases.some((release) => release.unitId === candidate.id && release.state === "expected"),
  )!;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unit.id} />
    </WardFlowProvider>,
  );
  const confirm = screen.getAllByRole("button", { name: "Confirm Ready", hidden: true })[0];
  fireEvent.click(confirm);
}

describe("discharge support notices", () => {
  it("offers pharmacy, transport and cleaning notices after a confirmed discharge, each not wired", () => {
    confirmFirstRelease(true);
    const card = screen.getByTestId("ward-discharge-notices");
    expect(card).toHaveTextContent("Discharge support notices");
    expect(within(card).getAllByText("Not wired in this prototype.")).toHaveLength(3);
    for (const button of within(card).getAllByRole("button", { name: "Send notice" })) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }
    fireEvent.click(within(card).getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("ward-discharge-notices")).toBeNull();
  });

  it("shows nothing when the flag is off", () => {
    confirmFirstRelease(false);
    expect(screen.queryByTestId("ward-discharge-notices")).toBeNull();
  });
});
