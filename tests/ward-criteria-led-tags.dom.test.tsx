// D-64 follow up: the criteria led discharge tag shows on the Bed board, on Home tiles whose note is
// taken by something higher (Past date, Due out), and on the Discharges list. Synthetic seed only.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { admissionCriteriaEligibility, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

// The ward the demo seeds with one stay part way and one with every criterion met.
const UNIT = "rph-adult-secure";
const FLAG = "top25-criteria-led-discharge";

function renderWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={UNIT} />
    </WardFlowProvider>,
  );
}

function renderDischarges() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^History/ }));
}

describe("criteria led discharge tags with the flag on", () => {
  beforeEach(() => {
    act(() => setWardFeatureFlagOnDevice(FLAG, true));
  });

  it("tags each Bed board cell that has criteria, and the cell still reads the full phrase", () => {
    renderWard();
    fireEvent.click(screen.getByRole("tab", { name: /^Bed board/ }));
    const cells = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).filter(
      (cell) => /Criteria led discharge/.test(cell.getAttribute("aria-label") ?? ""),
    );
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      const tag = within(cell).getByTestId("ward-criteria-led-tag");
      expect(tag).toHaveAttribute("aria-hidden", "true");
      expect(tag.textContent).toMatch(/^CLD /);
    }
  });

  it("shows the CLD state on every Home tile that has criteria, as its note or as a tag", () => {
    renderWard();
    const tiles = within(screen.getByRole("list", { name: /^Beds at / }))
      .getAllByRole("button")
      .filter((tile) => /Criteria led discharge/.test(tile.getAttribute("aria-label") ?? ""));
    expect(tiles).toHaveLength(2);
    const tagged = tiles.filter((tile) => within(tile).queryByTestId("ward-criteria-led-tag") !== null);
    // The seeded stay with every criterion met is past its expected date, so Past date takes the note.
    expect(tagged.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      const visible = (tile.textContent ?? "").match(/CLD [^,]*/g) ?? [];
      expect(visible, "the CLD state shows once, never twice").toHaveLength(1);
    }
    expect(tagged.some((tile) => /Past date/.test(tile.textContent ?? ""))).toBe(true);
  });

  it("shows the CLD state on the Discharges list, read in full by a screen reader", () => {
    renderDischarges();
    const tags = screen.getAllByTestId("ward-discharge-criteria-led");
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.some((tag) => /Criteria led discharge, all criteria met/.test(tag.textContent ?? ""))).toBe(true);
  });

  it("projects the criteria and the same eligibility the ward card reads onto the discharge record", () => {
    const state = seedWardFlowState();
    const seeded = state.admissions.filter((a) => a.unitId === UNIT && a.state === "occupied" && a.dischargeCriteria);
    expect(seeded).toHaveLength(2);
    for (const admission of seeded) {
      const read = selectDischargeRecord(state, { role: "coordinator" }, admission.id);
      if (read.status !== "allowed") throw new Error("coordinator read denied");
      expect(read.value.dischargeCriteria).toEqual(admission.dischargeCriteria);
      expect(read.value.criteriaEligibility).toBe(admissionCriteriaEligibility(state, admission));
    }
  });
});

describe("criteria led discharge tags with the flag off", () => {
  beforeEach(() => {
    act(() => setWardFeatureFlagOnDevice(FLAG, false));
  });

  it("shows no tag on the Bed board, Home tiles or the Discharges list", () => {
    renderWard();
    expect(screen.queryAllByTestId("ward-criteria-led-tag")).toHaveLength(0);
    fireEvent.click(screen.getByRole("tab", { name: /^Bed board/ }));
    expect(screen.queryAllByTestId("ward-criteria-led-tag")).toHaveLength(0);
  });

  it("shows no CLD state on the Discharges list", () => {
    renderDischarges();
    expect(screen.queryAllByTestId("ward-discharge-criteria-led")).toHaveLength(0);
  });
});
