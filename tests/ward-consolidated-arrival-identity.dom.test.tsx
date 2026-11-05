import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within, configure } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Synthetic arrival identity query failed; record text suppressed.") });
afterEach(cleanup);
it("names the person and record number visibly and in the arrival dialog description", () => {
  const seed = seedWardFlowState();
  const movement = seed.movements.find((row) => row.stage === "pulled" && row.patientId)!;
  const identity = patientIdentityLine(resolveSubjectPatient(movement, seed));
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ArrivalTimeModal isOpen movement={movement} onClose={() => {}} />
    </WardFlowProvider>,
  );
  const dialog = screen.getByRole("dialog", { name: "Update arrival time & transport" });
  expect(within(dialog).getByText(identity)).toBeVisible();
  expect(dialog).toHaveAccessibleDescription(identity);
});

import { CensusTable } from "@/components/ward-management/search/patient-census-view";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
it("gives the independently scrolling census a labelled keyboard focus target", () => {
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
        openGroups={{ ask: true, wait: true, found: true, move: true, ward: true, off: true }}
        onToggleGroup={() => {}}
        showAllWard
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
  const region = screen.getByRole("region", { name: "Patient census rows" });
  expect(within(region).getByRole("table", { name: "Patients by where they are now" })).toBeInTheDocument();
  expect(region).toHaveAttribute("tabindex", "0");
  region.focus();
  expect(region).toHaveFocus();
});
