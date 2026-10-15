import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFormTimes } from "@/components/ward-management/tools/ward-form-times";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderSheet(isPhone = false) {
  const onNavigate = vi.fn();
  const onNewReferral = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet
        isPhone={isPhone}
        roleLabel="Bed coordinator"
        onNavigate={onNavigate}
        onNewReferral={onNewReferral}
      />
    </WardFlowProvider>,
  );
  return { onNavigate, onNewReferral };
}

describe("Tools sheet mockup (Tools review, 15 Oct 2026)", () => {
  it("is one sheet in the reviewed groups, with the repeated items gone", () => {
    renderSheet();
    for (const group of ["Service now", "Do now", "Look up", "Print and share", "More pages", "Demo"]) {
      expect(screen.getByRole("region", { name: group })).toBeTruthy();
    }
    for (const gone of [
      "Figures at a glance",
      "Appearance",
      "Ward Flow Digest",
      "Shift desk",
      "Utilities",
      "Directory",
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /Settings/u })).toBeNull();
  });

  it("starts a referral from Do now", () => {
    const { onNewReferral } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /New referral/u }));
    expect(onNewReferral).toHaveBeenCalledTimes(1);
  });

  it("opens a tool in place and closes it again", () => {
    renderSheet();
    const toggle = screen.getByTestId("ward-tools-toggle-bed-finder");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(within(screen.getByTestId("ward-tools-bed-finder")).getByRole("status").textContent).toMatch(
      /synthetic beds free on/u,
    );
    fireEvent.click(toggle);
    expect(screen.queryByTestId("ward-tools-bed-finder")).toBeNull();
  });

  it("says plainly which rows are not wired, and keeps Bed meeting TV off the phone", () => {
    renderSheet(true);
    const escalation = screen.getByRole("button", { name: /Escalation check/u });
    expect(escalation.getAttribute("aria-disabled")).toBe("true");
    expect(escalation.textContent).toContain("Not wired in this prototype.");
    expect(screen.queryByRole("button", { name: /Bed meeting TV/u })).toBeNull();
    expect(screen.queryByRole("link", { name: /Bed meeting TV/u })).toBeNull();
  });

  it("links Bed meeting TV on desktop while its flag is on, and hides it while the flag is off", () => {
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("link", { name: /Bed meeting TV/u }).getAttribute("href")).toBe(
      "/mockups/ward-flow/bed-meeting",
    );
    unmount();
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", false));
    try {
      renderSheet();
      expect(screen.queryByRole("link", { name: /Bed meeting TV/u })).toBeNull();
    } finally {
      act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", null));
    }
  });

  it("opens a requested tool once, then tells the parent so a later open starts closed", async () => {
    const onRequestHandled = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone={false}
          roleLabel="Bed coordinator"
          onNavigate={vi.fn()}
          onNewReferral={vi.fn()}
          openRequest={{ tool: "demo", seq: 1 }}
          onRequestHandled={onRequestHandled}
        />
      </WardFlowProvider>,
    );
    expect(await screen.findByTestId("ward-tools-demo-panel")).toBeTruthy();
    await vi.waitFor(() => expect(onRequestHandled).toHaveBeenCalledTimes(1));
  });

  it("keeps the demo controls together behind one Demo row", () => {
    renderSheet();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    const panel = screen.getByTestId("ward-tools-demo-panel");
    expect(within(panel).getByRole("radiogroup", { name: "Demo scenario" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "+15 min" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Reset demo" })).toBeTruthy();
    // The one tap Demo reset (#298) lives in the same panel, behind its own flag.
    expect(within(panel).getByTestId("ward-demo-reset-winter-surge")).toBeTruthy();
    // Its three scenarios load from the reset, after a confirm, so the picker does not repeat them.
    const picker = within(panel).getByRole("radiogroup", { name: "Demo scenario" });
    expect(within(picker).queryByRole("radio", { name: /Winter surge/u })).toBeNull();
    expect(within(picker).getByRole("radio", { name: /Standard night/u })).toBeTruthy();
  });

  it("shows the network figures at a glance, and opens every figure in place", () => {
    renderSheet();
    const glance = screen.getByTestId("ward-tools-service-now");
    for (const label of ["Ready now", "Waiting", "Longest wait", "Deadline passed"]) {
      expect(within(glance).getByText(label)).toBeTruthy();
    }
    expect(glance.textContent).toContain("Whole network, synthetic figures.");
    expect(glance.querySelectorAll('[data-flagged="true"]').length).toBeLessThanOrEqual(2);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-figures"));
    expect(screen.getByTestId("ward-stats-drawer-content")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open statistics/u }).getAttribute("href")).toBe(
      "/mockups/ward-flow/statistics",
    );
  });
});

describe("Form times on the Perth clock", () => {
  afterEach(() => vi.useRealTimers());

  it("starts from the demo clock, read from Perth midnight", () => {
    // Carried over from the retired MHA form calculator: 16:30 UTC is 00:30 on Saturday in Perth.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T16:30:00.000Z"));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFormTimes />
      </WardFlowProvider>,
    );
    expect(screen.getByLabelText("Date written on form")).toHaveValue("2026-09-26");
    expect(screen.getByLabelText("Time written on form")).toHaveValue("10:42");
    expect(screen.getByRole("status").textContent).toContain("on the demo clock");
  });
});
