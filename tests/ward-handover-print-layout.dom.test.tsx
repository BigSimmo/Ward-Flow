import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { HandoverPrintSheet, DEFAULT_PRINT_OPTIONS } from "@/components/ward-management/handover/handover-print-sheet";
import { HANDOVER_COLUMNS } from "@/components/ward-management/handover/handover-columns";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { perthMidnight } from "@/components/ward-management/ward-clock";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

it("keeps the Standard legal/observation column in the print preview on a wide desktop", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
  fireEvent.keyDown(window, { key: "p" });
  const sheet = screen.getByTestId("ward-handover-print-sheet");
  expect(within(sheet).getAllByRole("columnheader", { name: "Legal and obs" }).length).toBeGreaterThan(0);
});

it("allocates a positive percentage width to every Full paper column including From and to", () => {
  function Sheet() {
    const [options, setOptions] = useState(DEFAULT_PRINT_OPTIONS);
    return (
      <HandoverPrintSheet
        groups={[]}
        columns={HANDOVER_COLUMNS}
        ctx={{ now: NOW_ANCHOR, cutoff: NOW_ANCHOR, readyBeds: () => 0 }}
        wards={[]}
        held={[]}
        outsideAct={[]}
        isHighlighted={() => false}
        anyHighlight={false}
        scopeLabel="Whole network"
        shiftLabel="Day"
        densityLabel="Full"
        dayZero={perthMidnight(2026, 9, 23)}
        options={options}
        onOptionsChange={setOptions}
        controls={null}
        highlightControls={null}
        onOpenPatient={() => {}}
        onBack={() => {}}
        onPrintPrepared={() => {}}
        preparedAt={null}
        now={NOW_ANCHOR}
      />
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Sheet />
    </WardFlowProvider>,
  );
  const first = screen.getAllByRole("article")[0]!;
  const heads = within(first).getAllByRole("columnheader");
  const widths = heads.map((head) => Number.parseFloat(head.style.width));
  expect(widths.every((width) => width > 0)).toBe(true);
  expect(widths.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);
  expect(within(first).getByRole("columnheader", { name: "From and to" }).style.width).toMatch(/%$/);
});
