import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
it("names the rules export for the Perth date during the first eight hours", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T17:00:00Z"));
  const OriginalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends OriginalURL {
      static createObjectURL = vi.fn(() => "blob:synthetic");
      static revokeObjectURL = vi.fn();
    },
  );
  let filename = "";
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    filename = this.download;
  });
  render(
    <WardFlowProvider initialNow={642}>
      <SettingsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  expect(click).toHaveBeenCalledTimes(1);
  expect(filename).toBe("ward-flow-rules-2026-10-16.json");
});
