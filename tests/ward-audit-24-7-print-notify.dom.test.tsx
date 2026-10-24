/**
 * Audit 24-7 (CT-11, CT-12, CT-13): print stamps, filtered exports and the buzz chime. Synthetic data only.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/reports/chronology" }));
vi.mock("@/components/ward-management/shell/ward-sound-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-sound-store")>()),
  triggerUrgentBuzzAlert: vi.fn(),
}));

import { DEFAULT_PRINT_OPTIONS, HandoverPrintSheet } from "@/components/ward-management/handover/handover-print-sheet";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { triggerUrgentBuzzAlert } from "@/components/ward-management/shell/ward-sound-store";
import { WardNotificationCenter } from "@/components/ward-management/ward/ward-notification-center";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { perthMidnight, type Instant } from "@/components/ward-management/ward-clock";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(triggerUrgentBuzzAlert).mockClear();
});

it("CT-11: a browser print (Ctrl+P) stamps the copy with the current time, not an older Print press", () => {
  const prepared: Instant[] = [];
  function Sheet() {
    const [preparedAt, setPreparedAt] = useState<Instant | null>(NOW_ANCHOR - 90);
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
        onPrintPrepared={(at) => {
          prepared.push(at);
          setPreparedAt(at);
        }}
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
  act(() => {
    window.dispatchEvent(new Event("beforeprint"));
  });
  expect(prepared).toEqual([NOW_ANCHOR]);
});

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

it("CT-12: the chronology CSV and printed copy name the filter, never the typed search", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, 11, 31).getTime()}>
      <PatientChronologyScreen initialPatientId="PT-013" />
    </WardFlowProvider>,
  );
  expect(screen.getAllByTestId("ward-chronology-print-filter")[0]).toHaveTextContent(
    "Filter: All sources · Every record kind · No search",
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Find in events" }), { target: { value: "qqsynthetic" } });
  expect(screen.getAllByTestId("ward-chronology-print-filter")[0]).toHaveTextContent("Search applied");
  const csv = await captureCsv(() => fireEvent.click(screen.getAllByTestId("ward-chronology-csv")[0]));
  const lines = csv.split("\r\n");
  const scopeAt = lines.findIndex((line) => line.startsWith('"Scope",'));
  expect(scopeAt).toBeGreaterThan(0);
  expect(lines[scopeAt + 1]).toBe('"Filter","All sources · Every record kind · Search applied"');
  expect(csv).not.toContain("qqsynthetic");
});

it("CT-13: acknowledging an urgent buzz does not play the chime again", () => {
  const onDismissBuzz = vi.fn();
  render(
    <WardNotificationCenter
      unitId="ward-alpha"
      unitName="Ward Alpha"
      now={700}
      movements={[]}
      notices={[]}
      refreshRequests={[{ unitId: "ward-alpha", at: 540, byRole: "coordinator", message: "Synthetic", urgent: true }]}
      onDismissBuzz={onDismissBuzz}
    />,
  );
  // The chime plays once when the urgent buzz arrives.
  expect(triggerUrgentBuzzAlert).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
  expect(onDismissBuzz).toHaveBeenCalledTimes(1);
  expect(triggerUrgentBuzzAlert).toHaveBeenCalledTimes(1);
});
