import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { OPERATIONAL_DEFAULTS } from "@/components/ward-management/ward-operational-defaults";
beforeEach(() => {
  localStorage.clear();
});
function settings() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={642}>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}
it("shows operational runtime defaults without editable display overrides", () => {
  settings();
  fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
  fireEvent.click(screen.getByRole("tab", { name: /Fixed defaults/ }));
  expect(screen.queryByRole("button", { name: "Edit defaults" })).not.toBeInTheDocument();
  for (const item of OPERATIONAL_DEFAULTS) {
    expect(screen.getByTestId(`ward-settings-operational-default-${item.name}`)).toHaveTextContent(item.display);
  }
});
it("discloses that board refresh is not wired and does not pretend to save a cadence", () => {
  settings();
  fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
  const row = screen.getByTestId("setting-wallboard-refresh-row");
  expect(row).toHaveTextContent("Not wired in this prototype.");
  const option = within(row).getByRole("radio", { name: "15s" });
  // Site review (12 Oct 2026): a working control that says it is not wired (D-16), never greyed.
  expect(option).not.toHaveAttribute("aria-disabled");
  fireEvent.click(option);
  expect(screen.getByRole("status")).toHaveTextContent("is not wired in this prototype.");
  expect(option).toHaveAttribute("aria-checked", "false");
  expect(localStorage.getItem("ward_flow_wallboard_refresh")).toBeNull();
});
