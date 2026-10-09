import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/statistics/weekly",
  useRouter: () => ({ push: vi.fn() }),
}));

import { forgetDowntimePack, lastDowntimePack } from "@/components/ward-management/reports/downtime-pack";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { OperationalLinks } from "@/components/ward-management/tools/ward-tools-workspace";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const inProvider = (node: ReactNode) => render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);

afterEach(() => forgetDowntimePack());

describe("read-only report screens", () => {
  it("opens a chronology for the patient named in the link, labelled synthetic", () => {
    inProvider(<PatientChronologyScreen initialPatientId="PT-013" />);
    const page = screen.getByTestId("ward-patient-chronology");
    expect(within(page).getAllByText(/Synthetic demo data/u).length).toBeGreaterThan(0);
    const table = screen.getByTestId("ward-chronology-table");
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByTestId("ward-chronology-csv")).toBeTruthy();
    expect(screen.getByTestId("ward-chronology-print")).toBeTruthy();
  });

  it("asks for a patient before showing any chronology", () => {
    inProvider(<PatientChronologyScreen />);
    expect(screen.queryByTestId("ward-chronology-table")).toBeNull();
    expect(screen.queryByTestId("ward-chronology-csv")).toBeNull();
    fireEvent.change(screen.getByTestId("ward-chronology-patient"), { target: { value: "PT-013" } });
    expect(screen.getByTestId("ward-chronology-table")).toBeTruthy();
  });

  it("renders the weekly report for the last full week by default, with a Weekly tab current", () => {
    inProvider(<WeeklyReportScreen />);
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^Last full week/u);
    const nav = within(screen.getByRole("navigation", { name: "Ward Flow statistics sections" }));
    expect(nav.getByRole("link", { name: "Weekly" })).toHaveAttribute("aria-current", "page");
    fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "-1" } });
    expect(screen.getByTestId("ward-weekly-range").textContent).toMatch(/^This week so far/u);
  });

  it("takes a stamped downtime snapshot and keeps it in tab memory", () => {
    inProvider(<DowntimePackScreen />);
    expect(screen.getByTestId("ward-downtime-generated").textContent).toMatch(/^Generated /u);
    expect(screen.getByTestId("ward-downtime-beds")).toBeTruthy();
    expect(lastDowntimePack()?.generatedAt).toBe(NOW_ANCHOR);
  });

  it("is reachable from the Tools drawer's shortcuts", () => {
    render(<OperationalLinks onNavigate={() => {}} />);
    expect(screen.getByRole("link", { name: /Downtime pack/u })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/reports/downtime",
    );
    expect(screen.getByRole("link", { name: /Patient chronology/u })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/reports/chronology",
    );
  });
});
