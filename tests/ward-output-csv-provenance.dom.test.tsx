import { fireEvent, render, screen, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { StatisticsCapacityChart } from "@/components/ward-management/statistics/statistics-capacity-chart";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { allUnits } from "@/components/ward-management/ward-sites";
import { formatSheetMoment, perthMidnight } from "@/components/ward-management/ward-clock";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

async function captureCsv(action: () => void): Promise<string> {
  let file: Blob | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      file = blob;
      return "blob:synthetic-export";
    },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  action();
  expect(file).toBeDefined();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file!);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("capacity CSV retains the held snapshot time across the new year and preserves the data header", async () => {
  const asAt = formatSheetMoment(1439, perthMidnight(2026, 11, 31), { includeYearAndZone: true });
  render(<StatisticsCapacityChart units={allUnits().slice(0, 1)} bedReleases={[]} asAt={asAt} />);
  // Exporting later must not put the current date on held figures.
  vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2027, 0, 2));
  const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Chart CSV" })));
  const lines = csv.split("\r\n");
  expect(lines[1]).toBe(`"As at","Thu, 31 Dec 2026, 23:59 AWST"`);
  expect(lines[2]).toContain('"Scope","Capacity across the network');
  expect(lines[5]).toBe(
    '"Synthetic current-state data","Scope","Total beds","Ready","Pulled","Closed","Occupied","On leave"',
  );
  expect(lines).toHaveLength(7);
});

it("directory CSV explicitly stamps a Perth generation time and distinguishes reference data", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-31T16:05:00Z"));
  render(<CommunityIndex teams={[]} />);
  fireEvent.click(screen.getByTestId("community-action-catchment-guide"));
  const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Export team list" })));
  const lines = csv.split("\r\n");
  expect(lines[1]).toContain("2027");
  expect(lines[1]).toContain("00:05 AWST");
  expect(lines[3]).toBe('"Period","Reference directory at export time; not a clinical snapshot"');
  expect(lines[5]).toBe('"Team","Health service","Catchment suburbs","Reads like another name"');
});

it("quotes metadata through the same formula-safe CSV path as the untouched data schema", async () => {
  const csv = await captureCsv(() =>
    downloadCsv("synthetic.csv", [["Value"], ["=unsafe"]], {
      asAt: "Fri, 1 Jan 2027, 00:05 AWST",
      scope: '=HYPERLINK("x")',
    }),
  );
  expect(csv).toContain('"Scope","\'=HYPERLINK(""x"")"');
  const lines = csv.split("\r\n");
  expect(lines[0]).toBe('"Data","Synthetic, not clinical records"');
  expect(lines[1]).toBe('"As at","Fri, 1 Jan 2027, 00:05 AWST"');
  expect(lines[3]).toBe('"Period","Recorded state as at snapshot"');
  expect(lines.slice(5)).toEqual(['"Value"', '"\'=unsafe"']);
});

it("capacity export names all matching rows when one service is only highlighted", async () => {
  const units = [allUnits().find((u) => u.siteCode === "RPH")!, allUnits().find((u) => u.siteCode === "FSH")!];
  render(<StatisticsCapacityChart units={units} bedReleases={[]} asAt="Fri, 1 Jan 2027, 00:05 AWST" />);
  fireEvent.click(
    within(screen.getByRole("radiogroup", { name: "Health service filter" })).getByRole("radio", { name: "South" }),
  );
  const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Chart CSV" })));
  expect(csv).toContain("all matching rows; South Metro highlighted");
  expect(csv.split("\r\n")).toHaveLength(8);
  expect(csv).toContain('"Royal Perth Hospital"');
  expect(csv).toContain('"Fiona Stanley Hospital"');
});

it("searched roster export names matching rows without repeating the typed search", async () => {
  const state = seedWardFlowStateAt(0);
  const admission = state.admissions.find((a) => a.unitId === "rph-adult-secure" && a.state === "occupied")!;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={admission.unitId} />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Filter recorded admission roster" }), {
    target: { value: admission.id },
  });
  const roster = screen.getByTestId("ward-statistics-ward-roster");
  const csv = await captureCsv(() => fireEvent.click(within(roster).getByRole("button", { name: "CSV" })));
  const lines = csv.split("\r\n");
  expect(lines[2]).toContain("matching roster rows; status filter: all; search applied");
  expect(lines[2]).not.toContain(admission.id);
  expect(lines[2]).not.toContain("all roster rows");
  expect(lines).toHaveLength(7);
  expect(lines[6]).toContain(admission.id);
});

it("capacity export names the alert-line highlight while still exporting every matching row", async () => {
  render(
    <StatisticsCapacityChart units={allUnits().slice(0, 2)} bedReleases={[]} asAt="Fri, 1 Jan 2027, 00:05 AWST" />,
  );
  fireEvent.click(screen.getByRole("button", { name: /at or over the alert line/iu }));
  const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Chart CSV" })));
  expect(csv).toMatch(/all matching rows; all services highlighted, only rows at or above the \d+% alert line;/u);
});

it("out-of-area export names the complete current ledger rather than the visible view", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard />
    </WardFlowProvider>,
  );
  const csv = await captureCsv(() => fireEvent.click(screen.getByRole("button", { name: "Export list as CSV" })));
  const scope = csv.split("\r\n").find((line) => line.startsWith('"Scope"'));
  expect(scope).toContain("complete current ledger");
  expect(scope).not.toContain("matching rows");
});
