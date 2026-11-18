// Printed Patients list (18 Nov 2026): a 28-page print showed no page numbers and a group that ran
// onto the next page lost its name there. On paper the census prints one table per group whose head
// holds "<group> (continued)" above the column heads, so the browser repeats both on every page the
// group runs onto; the heading before each table covers that line on the group's first page. The
// default page gets a margin so "Page x of y" has room even in a zero-margin PDF export.
// Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, configure, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { afterEach, describe, expect, it } from "vitest";

import { CensusTable } from "@/components/ward-management/search/patient-census-view";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { censusSections } from "@/components/ward-management/search/patient-states";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Synthetic census print query failed; record text suppressed.") });
afterEach(() => {
  act(() => window.dispatchEvent(new Event("afterprint")));
  cleanup();
});

function renderCensus() {
  const seed = seedWardFlowState();
  const rows = buildCensus({
    ...seed,
    now: NOW_ANCHOR,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    dayZero: new Date("2026-11-04T00:00:00+08:00"),
  }).rows;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CensusTable
        rows={rows}
        totalPeople={rows.length}
        searching={false}
        needle=""
        sort="wait"
        onSort={() => {}}
        highlight={null}
        onHighlight={() => {}}
        highlightCounts={{ t1: 0, long: 0, form: 0, edd: 0, aed: 0 }}
        lifted={() => false}
        openGroups={{ ask: false, wait: false, found: false, move: false, ward: false, off: false }}
        onToggleGroup={() => {}}
        showAllWard={false}
        onShowAllWard={() => {}}
        selectedKey={null}
        flashKey={null}
        onSelect={() => {}}
        tab="now"
        onTab={() => {}}
        liveCount={rows.length}
        historyCount={0}
        history={null}
        onCopyList={() => {}}
        copyNote={null}
        empty={null}
      />
    </WardFlowProvider>,
  );
  return rows;
}

const COLUMNS = ["Tier", "Patient", "Where", "Next step", "Legal", "Time"];

describe("printed Patients list", () => {
  it("prints one table per group, each head carrying the group's continued line and the column heads", () => {
    const rows = renderCensus();
    expect(screen.getByRole("table", { name: "Patients by where they are now" })).toBeInTheDocument();
    expect(document.querySelector("[data-census-print-group]")).toBeNull();

    act(() => window.dispatchEvent(new Event("beforeprint")));

    expect(screen.queryByRole("table", { name: "Patients by where they are now" })).toBeNull();
    const sections = censusSections(rows);
    const printed = [...document.querySelectorAll<HTMLElement>("[data-census-print-group]")];
    expect(printed).toHaveLength(sections.length);
    let printedRows = 0;
    printed.forEach((group, index) => {
      const { label, rows: groupRows } = sections[index]!;
      expect(group.querySelector("[data-census-print-heading]")).toHaveTextContent(`${label} · ${groupRows.length}`);
      const head = group.querySelector("table > thead")!;
      const [continued, columns] = [...head.querySelectorAll("tr")];
      expect(continued).toHaveAttribute("data-census-print-continued");
      expect(continued).toHaveTextContent(`${label} (continued)`);
      expect([...columns!.querySelectorAll("th")].map((cell) => cell.textContent?.trim())).toEqual(COLUMNS);
      // Every row prints, with no "Show all" row and no group toggle on paper.
      const bodyRows = group.querySelectorAll("table > tbody > tr");
      expect(bodyRows).toHaveLength(groupRows.length);
      expect(group.querySelector("button[aria-expanded]")).toBeNull();
      printedRows += bodyRows.length;
    });
    expect(printedRows).toBe(rows.length);

    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(screen.getByRole("table", { name: "Patients by where they are now" })).toBeInTheDocument();
  });

  it("gives the page number room and lays the first-page heading exactly over the continued line", () => {
    const css = readFileSync("src/app/ward-flow-print.css", "utf8");
    let defaultPage = "";
    postcss.parse(css).walkAtRules("page", (rule) => {
      if (!rule.params) defaultPage = rule.toString();
    });
    expect(defaultPage).toMatch(/margin:\s*\d+mm/);
    expect(defaultPage).toMatch(/"Page "\s*counter\(page\)\s*" of "\s*counter\(pages\)/);

    expect(css).toMatch(
      /\[data-census-print-heading\],\s*\[data-census-print-continued\] > th\s*\{[^}]*block-size:\s*var\(--census-print-line\)/,
    );
    expect(css).toMatch(
      /\[data-census-print-heading\]\s*\{[^}]*z-index:\s*1;[^}]*margin:\s*0 0 calc\(-1 \* var\(--census-print-line\)\)/,
    );
    expect(css).toMatch(/\[data-census-print-group\] table\s*\{\s*min-inline-size:\s*0/);
  });
});
