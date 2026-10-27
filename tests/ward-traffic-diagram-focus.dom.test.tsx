import "@testing-library/jest-dom/vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrafficDiagram } from "@/components/ward-management/movements/traffic-diagram";
import type { CorridorCount, RefusedCorridorCount } from "@/components/ward-management/movements/movements-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();
const corridors: CorridorCount[] = [
  { originEdId: "ED-FSH", acceptedUnitId: units[0]!.id, stage: "moving", count: 2 },
  { originEdId: "ED-RPH", acceptedUnitId: units[1]!.id, stage: "pulled", count: 1 },
];
const refused: RefusedCorridorCount[] = [
  { originEdId: "ED-FSH", unitId: units[1]!.id, count: 1, reasons: ["no_suitable_bed"] },
];

/** Fresh audit A-10: the corridor highlight follows focus and a tap, not the mouse alone. */
describe("corridor highlight without a mouse", () => {
  it("lights a ranked corridor on keyboard focus and clears it on blur", () => {
    const { container } = render(<TrafficDiagram corridors={corridors} refusedCorridors={refused} units={units} />);
    const rail = container.querySelector('[aria-label="Ranked corridors"]') as HTMLElement;
    const [first] = within(rail).getAllByRole("button", { name: / to /u });
    fireEvent.focus(first!);
    expect(container.querySelectorAll('path[data-active="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('path[data-dimmed="true"]')).toHaveLength(2);
    fireEvent.blur(first!);
    expect(container.querySelectorAll("path[data-active], path[data-dimmed]")).toHaveLength(0);
  });

  it("lights an endpoint's corridors on a tap", () => {
    const { container } = render(<TrafficDiagram corridors={corridors} refusedCorridors={refused} units={units} />);
    const origin = container.querySelector('[data-side="origin"]') as HTMLElement;
    fireEvent.click(origin);
    expect(origin).toHaveAttribute("data-active", "true");
    expect(container.querySelectorAll('path[data-active="true"]').length).toBeGreaterThan(0);
  });
});
