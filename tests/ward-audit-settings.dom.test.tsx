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
import { OPERATIONAL_DEFAULTS } from "@/components/ward-management/ward-operational-defaults";
beforeEach(() => {
  localStorage.clear();
});
function settings() {
  return render(
    <WardFlowProvider initialNow={642}>
      <SettingsScreen />
    </WardFlowProvider>,
  );
}
it("shows operational runtime defaults without editable display overrides", () => {
  settings();
  expect(screen.queryByRole("button", { name: "Edit defaults" })).not.toBeInTheDocument();
  for (const item of OPERATIONAL_DEFAULTS) {
    expect(screen.getByTestId(`ward-settings-operational-default-${item.name}`)).toHaveTextContent(item.display);
  }
});
it("discloses that board refresh is not wired and does not pretend to save a cadence", () => {
  settings();
  const row = screen.getByTestId("setting-wallboard-refresh-row");
  expect(row).toHaveTextContent("Not wired in this prototype.");
  fireEvent.click(within(row).getByRole("button", { name: /15s/ }));
  expect(localStorage.getItem("ward_flow_wallboard_refresh")).toBeNull();
});
