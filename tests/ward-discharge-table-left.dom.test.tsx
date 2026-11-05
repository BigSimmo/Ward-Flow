import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit A2 (5 Nov 2026): the "by bed" table (tablet and desktop) said "Now" again for a discharge
 * that had already happened. The phone list cell was fixed to say "Left"; the table now matches.
 */
describe("discharges by bed: a completed discharge says Left", () => {
  it("shows Left, never Now, in the Expected out cell of every discharged row", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const more = screen.queryByTestId("ward-discharge-more-discharged-today")?.querySelector("button");
    if (more?.getAttribute("aria-expanded") === "false") fireEvent.click(more);
    const group = screen.getByTestId("ward-discharge-group-discharged-today");
    const rows = [...group.querySelectorAll("tr[data-release-id]")];
    expect(rows.length, "the seed has no discharge in the last 24 hours, so nothing was checked").toBeGreaterThan(0);
    for (const row of rows) {
      // Columns: Person, Expected out, ...
      const outCell = row.querySelectorAll("td")[1]!;
      expect(outCell.textContent).toMatch(/^Left/);
      expect(outCell.textContent).not.toMatch(/\bNow\b/);
    }
  });
});
