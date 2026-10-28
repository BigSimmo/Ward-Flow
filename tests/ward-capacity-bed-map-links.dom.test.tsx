import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BedMap, bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

/** Audit P093 (Josh, 9:55 PM 27 Oct 2026, option A): each bed-map square links to its ward's bed board. */
describe("Capacity bed map squares (audit P093)", () => {
  it("link every square to its own ward's bed board", () => {
    const units = allUnits();
    render(<BedMap units={units} bedReleases={bedReleases} admissions={wardAdmissions} leaveBeds={leaveBeds} />);
    for (const ward of bedMapWards(units, bedReleases, wardAdmissions, leaveBeds)) {
      const squares = screen.getAllByTestId(`ward-bed-map-square-${ward.unit.id}`);
      expect(squares.length, ward.unit.id).toBeGreaterThan(0);
      for (const square of squares) {
        expect(square.tagName, ward.unit.id).toBe("A");
        expect(square).toHaveAttribute("href", `/ward-flow/ward/${ward.unit.id}?tab=board`);
      }
    }
  });
});
