import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/reports/chronology" }));

import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { perthMidnight } from "@/components/ward-management/ward-clock";

function chronology() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={perthMidnight(2026, 11, 31).getTime()}>
      <PatientChronologyScreen initialPatientId="PT-013" />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("identifies the full Perth date in chronology headings and recorded timestamps", () => {
  chronology();
  const table = screen.getByTestId("ward-chronology-table");
  const dayHead = table.querySelector('th[scope="rowgroup"]');
  expect(dayHead?.textContent).toMatch(/\b20\d\d AWST/);
  const recorded = table.querySelectorAll("[data-chronology-recorded]");
  expect(recorded.length).toBeGreaterThan(0);
  expect(
    Array.from(recorded).every(
      (cell) => cell.textContent === "Not recorded" || /\b20\d\d, \d{2}:\d{2} AWST/.test(cell.textContent ?? ""),
    ),
  ).toBe(true);
});

it("retains every existing event detail in phone print order instead of only the collapsed summary", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 48rem)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  chronology();
  const rows = screen.getAllByTestId("ward-chronology-phone-event");
  const facts = screen.getAllByTestId("ward-chronology-print-facts");
  expect(facts).toHaveLength(rows.length);
  for (const event of facts) {
    expect(Array.from(event.querySelectorAll("dt"), (node) => node.textContent)).toEqual([
      "Occurred",
      "Recorded",
      "Who",
      "Source",
      "Record",
      "Before",
      "After",
      "Reason",
    ]);
    expect(within(event).getByText("Recorded").nextElementSibling?.textContent).toMatch(
      /Not recorded|\b20\d\d, \d{2}:\d{2} AWST/,
    );
  }
});
