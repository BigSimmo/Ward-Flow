import "@testing-library/jest-dom/vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Untested-537 lane U1b, INV-FIGURE-009 (14 Nov 2026): the legal status options counted an exact
// status match, so "Involuntary (0)" showed while choosing it listed several people. Each option now
// counts with the same rule the filter applies.
function countIn(label: string | null | undefined): number {
  const match = /\((\d+)\)\s*$/.exec(label ?? "");
  return match ? Number(match[1]) : Number.NaN;
}

describe("Search legal status option counts", () => {
  it("each option's count matches the people that option lists", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const select = document.getElementById("ward-patient-search-legal") as HTMLSelectElement;
    const options = Array.from(select.options).filter((o) => o.value !== "all");
    const counted = new Map(options.map((o) => [o.value, countIn(o.textContent)]));
    expect(counted.get("Involuntary")).toBeGreaterThan(0);

    for (const value of ["Voluntary", "Involuntary"]) {
      fireEvent.change(select, { target: { value } });
      const all = Array.from(select.options).find((o) => o.value === "all");
      expect(countIn(all?.textContent)).toBe(counted.get(value));
    }
  });
});
