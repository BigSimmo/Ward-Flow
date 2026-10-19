import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/reports/chronology",
}));

import { ToastProvider } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";

const report = (children: ReactNode) => (
  <ToastProvider>
    <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>
  </ToastProvider>
);

describe("design audit report entry states", () => {
  it("takes the empty chronology action to the real patient selector and opens the chosen record", () => {
    render(report(<PatientChronologyScreen />));
    const select = screen.getByRole("combobox", { name: "Patient" });
    fireEvent.click(screen.getByRole("button", { name: "Choose a patient" }));
    expect(select).toHaveFocus();
    fireEvent.change(select, { target: { value: "PT-013" } });
    expect(screen.getByTestId("ward-chronology-table")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No patient chosen" })).not.toBeInTheDocument();
  });

  it("labels the initial downtime snapshot without presenting unready tables as a saved pack", () => {
    const html = renderToStaticMarkup(report(<DowntimePackScreen />));
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Taking a snapshot of beds");
    expect(document.querySelector("table")).toBeNull();
    expect(document.body.textContent).toContain("Preparing the downtime pack");
  });
});
