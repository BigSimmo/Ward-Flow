import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
function Probe() {
  const { configuration, readAuditEvents, movements, referrals } = useWardFlow();
  const auditRead = readAuditEvents({ role: "coordinator" });
  const auditCount =
    auditRead.status === "allowed" ? auditRead.value.filter((event) => event.category === "configuration").length : 0;
  return (
    <output data-testid="state">
      {JSON.stringify({ configuration, audit: auditCount, movements: movements.length, referrals: referrals.length })}
    </output>
  );
}
function mount() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SettingsScreen />
      <Probe />
    </WardFlowProvider>,
  );
}
function state() {
  return JSON.parse(screen.getByTestId("state").textContent!);
}
function estimate(value: unknown) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { estimate: vi.fn().mockResolvedValue(value) },
  });
}
const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
  else Reflect.deleteProperty(navigator, "storage");
  vi.restoreAllMocks();
});
describe("truthful Settings coordination and browser estimates", () => {
  it("shows checking without invented values until the browser reports its estimate", async () => {
    let resolve!: (value: StorageEstimate) => void;
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: () =>
          new Promise<StorageEstimate>((r) => {
            resolve = r;
          }),
      },
    });
    mount();
    expect(screen.getByText("Checking browser storage estimate…")).toBeVisible();
    expect(screen.queryByRole("progressbar", { name: "Browser storage quota usage" })).not.toBeInTheDocument();
    resolve({ usage: 1024, quota: 10240 });
    await waitFor(() => expect(screen.getByText("1 KB of 10 KB (10%)")).toBeVisible());
    expect(screen.getByRole("progressbar", { name: "Browser storage quota usage" })).toHaveAttribute(
      "aria-valuenow",
      "10",
    );
    expect(screen.getByText(/not a measurement of Ward Flow records or cache health/i)).toBeVisible();
  });
  it("keeps actual zero usage and the progress fill at zero", async () => {
    estimate({ usage: 0, quota: 10240 });
    const { container } = mount();
    await waitFor(() => expect(screen.getByText("0 KB of 10 KB (0%)")).toBeVisible());
    const bar = screen.getByRole("progressbar", { name: "Browser storage quota usage" });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.firstElementChild).toHaveStyle({ width: "0%" });
    expect(container.textContent).not.toContain("Cache Healthy");
  });
  it("reports use over the estimated quota truthfully while bounding the progress bar", async () => {
    estimate({ usage: 2048, quota: 1024 });
    mount();
    await waitFor(() => expect(screen.getByText("2 KB of 1 KB (200%)")).toBeVisible());
    const bar = screen.getByRole("progressbar", { name: "Browser storage quota usage" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "200% of the browser-reported quota");
    expect(bar.firstElementChild).toHaveStyle({ width: "100%" });
  });
  it("does not label custom saved values as a standard or operational surge mode", () => {
    estimate({ usage: 0, quota: 1024 });
    mount();
    fireEvent.change(document.getElementById("setting-ed-threshold")!, { target: { value: "1560" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(state().configuration.edAccessTargetMinutes).toBe(1560);
    expect(screen.getByText("Other saved values")).toBeVisible();
  });
  it.each([
    { usage: 1 },
    { quota: 10 },
    { usage: 1, quota: 0 },
    { usage: -1, quota: 10 },
    { usage: NaN, quota: 10 },
    { usage: 1, quota: Infinity },
    { usage: Infinity, quota: 10 },
    { usage: Number.MAX_VALUE, quota: Number.MIN_VALUE },
  ])("keeps invalid estimate unknown: %j", async (value) => {
    estimate(value);
    const storageRead = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new Error("synthetic denied text access");
    });
    mount();
    await waitFor(() => expect(screen.getByText("Storage estimate unavailable. Quota not reported.")).toBeVisible());
    expect(storageRead).not.toHaveBeenCalled();
    expect(screen.queryByRole("progressbar", { name: "Browser storage quota usage" })).not.toBeInTheDocument();
    expect(screen.queryByText(/5\.0 MB/)).not.toBeInTheDocument();
  });
  it.each(["missing", "rejected"])(
    "keeps %s storage API unknown without inspecting browser text storage",
    async (kind) => {
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value:
          kind === "missing" ? undefined : { estimate: vi.fn().mockRejectedValue(new Error("synthetic unavailable")) },
      });
      const storageRead = vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
        throw new Error("synthetic denied text access");
      });
      mount();
      await waitFor(() => expect(screen.getByText("Storage estimate unavailable. Quota not reported.")).toBeVisible());
      expect(storageRead).not.toHaveBeenCalled();
      expect(screen.queryByRole("progressbar", { name: "Browser storage quota usage" })).not.toBeInTheDocument();
    },
  );
  it("describes the real surge payload and applies it only on Save", () => {
    estimate({ usage: 0, quota: 1024 });
    mount();
    const before = state();
    fireEvent.change(document.getElementById("setting-morning-rollup-slider")!, { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Select surge draft preset" }));
    expect(state()).toEqual(before);
    expect((document.getElementById("setting-ed-threshold") as HTMLInputElement).value).toBe("720");
    expect(screen.getByText("120m preset")).toBeVisible();
    expect(screen.getByText("3 destinations preset")).toBeVisible();
    expect(screen.getByText(/does not add beds or verify staffing/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    expect(state().configuration).toMatchObject({
      edAccessTargetMinutes: 720,
      parallelReferralCap: 3,
      pullHoldMinutes: 120,
      morningRollupDeadlineMinutes: 600,
    });
    expect(state().audit).toBe(before.audit + 1);
    expect(state().movements).toBe(before.movements);
    expect(state().referrals).toBe(before.referrals);
  });
  it("shows real reset defaults; cancelling changes nothing; confirming resets configuration only", () => {
    estimate({ usage: 0, quota: 1024 });
    mount();
    fireEvent.change(document.getElementById("setting-ed-threshold")!, { target: { value: "720" } });
    fireEvent.click(screen.getByRole("button", { name: "Save coordination rules" }));
    const before = state();
    fireEvent.click(screen.getByTestId("btn-restore-baseline"));
    const dialog = screen.getByRole("dialog", { name: "Restore Settings defaults?" });
    expect(within(dialog).getByText("24 hours")).toBeVisible();
    expect(within(dialog).getByText("3 destinations")).toBeVisible();
    expect(within(dialog).getByText("240 minutes")).toBeVisible();
    expect(within(dialog).getByText("60 minutes")).toBeVisible();
    expect(within(dialog).getByText("180 minutes")).toBeVisible();
    expect(dialog).not.toHaveTextContent("WA Health clinical standards");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(state()).toEqual(before);
    fireEvent.click(screen.getByTestId("btn-restore-baseline"));
    fireEvent.click(screen.getByTestId("confirm-restore-defaults-btn"));
    expect(state().configuration).toEqual(defaultWardConfiguration());
    expect(state().audit).toBe(before.audit + 1);
    expect(state().movements).toBe(before.movements);
    expect(state().referrals).toBe(before.referrals);
  });
});
