// Phone audit (Josh, 1 Nov 2026): a ready bed on the phone round says "Ready" once, not three times.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardPhoneRoundList, type PhoneRoundRow } from "@/components/ward-management/ward/ward-phone-round-list";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

const row = (bedNumber: string, extra: Partial<PhoneRoundRow>): PhoneRoundRow => ({
  bed: { bedNumber, stayDays: 0, status: "ready" } as unknown as BedItem,
  free: true,
  stateWord: "Ready",
  days: "",
  note: "Ready",
  criteriaTag: null,
  glyph: "success",
  number: bedNumber,
  name: "Ready",
  accessibleName: `Bed ${bedNumber}`,
  ...extra,
});

function renderRows(rows: PhoneRoundRow[]) {
  render(
    <WardPhoneRoundList
      rows={rows}
      unitName="Test ward"
      mark={() => ({ reviewed: false, changed: false })}
      walkFrom={() => undefined}
      isLit={() => true}
      rowLabel={(name) => name}
    />,
  );
  return within(screen.getByTestId("ward-phone-round-list"));
}

describe("ward phone round list, ready bed", () => {
  it("draws Ready once for a ready bed", () => {
    const list = renderRows([row("07", {})]);
    const bed = list.getByRole("button", { name: "Bed 07" });
    expect(bed.textContent?.match(/Ready/g)).toHaveLength(1);
    // The ready mark stays, beside the name.
    expect(bed.querySelector('[data-wf-glyph="success"]')).not.toBeNull();
  });

  it("keeps an occupied bed's note and stay days", () => {
    const list = renderRows([
      row("03", {
        bed: { bedNumber: "03", stayDays: 95, status: "occupied" } as unknown as BedItem,
        free: false,
        stateWord: "Occupied",
        days: "95d",
        note: "Occupied",
        name: "Testperson, Alex",
        glyph: null,
      }),
    ]);
    const text = list.getByRole("button", { name: "Bed 03" }).textContent ?? "";
    expect(text).toContain("Occupied");
    expect(text).toContain("95d");
  });
});
