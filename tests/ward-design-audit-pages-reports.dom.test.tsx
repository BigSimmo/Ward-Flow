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
  it("finds a patient from the header search and opens the chosen record (Josh, 31 Oct 2026)", () => {
    render(report(<PatientChronologyScreen />));
    const search = screen.getByRole("combobox", { name: "Find a patient" });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "zzzz" } });
    expect(screen.getByText("No patient with records matches")).toBeInTheDocument();
    const first = screen.getAllByTestId("ward-chronology-start-patient")[0]!;
    const umrn = first.children[1]?.textContent ?? "";
    fireEvent.change(search, { target: { value: umrn } });
    const option = screen.getAllByRole("option").find((item) => item.textContent?.includes(umrn));
    expect(option).toBeDefined();
    fireEvent.mouseDown(option!);
    expect(screen.getByTestId("ward-chronology-table")).toBeInTheDocument();
    expect(screen.queryByText("Patients on this demo night")).not.toBeInTheDocument();
    // The typed text never stays in the box once a person is chosen.
    expect(screen.getByRole("combobox", { name: "Find another patient" })).toHaveValue("");
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
