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
import { clinicalValueStatusText } from "@/components/ward-management/ward-clinical-values";
import { CLINICAL_VALUE_LIST } from "@/components/ward-management/ward-clinical-value-notes";

/** The summary line the screen shows, from the list itself: a synthetic value is named, never signed off here. */
function signedSummary(): string {
  const unsigned = CLINICAL_VALUE_LIST.filter((entry) => entry.status === "synthetic").length;
  return unsigned === 0
    ? `All ${CLINICAL_VALUE_LIST.length} values are signed for the prototype only.`
    : `${unsigned} of ${CLINICAL_VALUE_LIST.length} values are still synthetic. The rest are signed for the prototype only.`;
}
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
it("lists every clinical value with its synthetic or signed status", () => {
  settings();
  fireEvent.click(screen.getByRole("radio", { name: /^Data and about/ }));
  fireEvent.click(screen.getByRole("tab", { name: /Clinical values/ }));
  const panel = screen.getByTestId("ward-settings-clinical-values");
  expect(panel).toHaveTextContent(signedSummary());
  for (const entry of CLINICAL_VALUE_LIST) {
    const row = within(panel).getByTestId(`ward-settings-clinical-value-${entry.id}`);
    expect(row).toHaveTextContent(entry.name);
    expect(row).toHaveTextContent(clinicalValueStatusText(entry));
  }
});
it("offers no board refresh cadence, since nothing reads one (D-72)", () => {
  settings();
  fireEvent.click(screen.getByRole("radio", { name: /^Alerts/ }));
  expect(screen.getByTestId("setting-buzz-alert-row")).toBeInTheDocument();
  expect(screen.queryByTestId("setting-wallboard-refresh-row")).toBeNull();
  expect(screen.queryByText("Not wired in this prototype.")).toBeNull();
  expect(localStorage.getItem("ward_flow_wallboard_refresh")).toBeNull();
});
