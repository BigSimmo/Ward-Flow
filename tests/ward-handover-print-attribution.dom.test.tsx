import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "@/components/ward-management/handover/handover-print-sheet";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { formatInstant, perthMidnight, type Instant } from "@/components/ward-management/ward-clock";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  vi.restoreAllMocks();
});

function renderSheet(initial: Instant | null, dayZero?: Date) {
  function Sheet() {
    const [preparedAt, setPreparedAt] = useState<Instant | null>(initial);
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
        dayZero={dayZero}
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
}

it("labels a sheet nobody has prepared yet as a preview, then as prepared once Print is pressed", () => {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["brm-adult-secure"] } });
  renderSheet(null);
  const stamps = () => screen.getAllByTestId("ward-print-attribution");
  for (const stamp of stamps()) {
    expect(stamp).toHaveTextContent(/^Preview opened by /);
    expect(stamp).not.toHaveTextContent("Prepared for printing");
  }
  expect(document.body).toHaveTextContent("no copy prepared yet");
  expect(document.body).not.toHaveTextContent(/Copy prepared \d/);
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    for (const stamp of stamps()) expect(stamp).toHaveTextContent(/^Prepared for printing by /);
  });
  fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
  expect(print).toHaveBeenCalledOnce();
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

it("keeps the prepared copy's full calendar date across midnight", () => {
  const dayZero = perthMidnight(2026, 9, 24);
  renderSheet(NOW_ANCHOR - 24 * 60, dayZero);
  for (const page of screen.getAllByRole("article")) {
    expect(page).toHaveTextContent("Prepared Fri, 23 Oct 2026, 10:42 AWST");
  }
});

it("keeps one ResizeObserver across re-renders instead of rebuilding it each render (H-0350)", () => {
  let built = 0;
  let disconnected = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor() {
        built += 1;
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnected += 1;
      }
    },
  );
  try {
    renderSheet(null);
    // The preview-width observer and the paper measurement observer.
    const afterMount = built;
    expect(afterMount).toBeGreaterThan(0);
    vi.spyOn(window, "print").mockImplementation(() => {});
    // Each press stamps a new prepared time, so the sheet re-renders.
    fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));
    expect(built).toBe(afterMount);
    expect(disconnected).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
