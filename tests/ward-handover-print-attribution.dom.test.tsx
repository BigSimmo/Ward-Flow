import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "@/components/ward-management/handover/handover-print-sheet";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  vi.restoreAllMocks();
});

it("prints the current desk and full place on every sheet, using the copy generation time", () => {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
  // The same clock face one day earlier must identify the older copy as yesterday.
  const earlier = NOW_ANCHOR - 24 * 60;
  function Sheet() {
    const [preparedAt, setPreparedAt] = useState<Instant | null>(earlier);
    return (
      <HandoverPrintSheet
        groups={[]}
        columns={[]}
        ctx={{ now: NOW_ANCHOR, cutoff: NOW_ANCHOR, readyBeds: () => 0 }}
        wards={[]}
        held={[]}
        outsideAct={[]}
        isHighlighted={() => false}
        anyHighlight={false}
        scopeLabel="Whole network"
        shiftLabel="Day"
        densityLabel="Standard"
        sheetDate="Friday"
        options={DEFAULT_PRINT_OPTIONS}
        onOptionsChange={() => {}}
        controls={null}
        highlightControls={null}
        onOpenPatient={() => {}}
        onBack={() => {}}
        onPrintPrepared={setPreparedAt}
        preparedAt={preparedAt}
        now={NOW_ANCHOR}
      />
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Sheet />
    </WardFlowProvider>,
  );
  const stamps = () => screen.getAllByTestId("ward-print-attribution");
  expect(stamps().length).toBeGreaterThan(1);
  for (const stamp of stamps()) {
    expect(stamp).toHaveTextContent("Prepared for printing by Nurse in charge, Mabu Liyan / Broome Mental Health Unit");
    expect(stamp).toHaveTextContent(`at ${formatInstant(earlier)} yesterday. Synthetic data.`);
  }
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    // flushSync must update the paper before the native print dialog is opened.
    for (const stamp of stamps()) expect(stamp).toHaveTextContent(`at ${formatInstant(NOW_ANCHOR)}. Synthetic data.`);
  });
  fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
  expect(print).toHaveBeenCalledOnce();
});
