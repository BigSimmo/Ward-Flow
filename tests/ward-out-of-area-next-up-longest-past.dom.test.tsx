import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { dischargeOffsetDays } from "@/components/ward-management/out-of-area/out-of-area-model";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

const DAY = 24 * 60 * 60 * 1000;

/**
 * P192 (Josh, 27 Oct 2026, option A): "Plan next return" opens the patient with no plan who is
 * longest past discharge, as its tooltip says, even when nobody is past their date yet. Before, with
 * no one past discharge it fell back to the first unplanned row in table order. Synthetic demo data.
 */
describe("out-of-area: Plan next return opens the unplanned patient longest past discharge (P192)", () => {
  it("picks the earliest discharge date, not the first row, when nobody is past discharge", () => {
    const ledgerOrder = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR).entries.map((e) => e.admission.id);
    // Every out-of-area patient is due in the future; the first table row is due last.
    const admissions = wardAdmissions.map((admission) => {
      const index = ledgerOrder.indexOf(admission.id);
      if (index < 0) return admission;
      return { ...admission, expectedDischargeAt: NOW_ANCHOR + (ledgerOrder.length - index + 1) * DAY };
    });
    const { entries } = outOfAreaLedger(admissions, allUnits(), NOW_ANCHOR);
    expect(entries.length).toBeGreaterThan(1);
    const offsets = entries.map((entry) => dischargeOffsetDays(entry, NOW_ANCHOR) ?? Infinity);
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    const earliest = entries[offsets.indexOf(Math.min(...offsets))]!;
    expect(earliest.admission.id).not.toBe(entries[0]!.admission.id);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard admissions={admissions} />
      </WardFlowProvider>,
    );
    const button = screen.getByRole("button", { name: /Plan next return/i });
    const opens = /^Opens (.+), the longest past discharge with no plan$/.exec(button.getAttribute("title") ?? "");
    expect(opens).not.toBeNull();
    const name = opens![1]!;
    expect(screen.getByTestId(`ward-out-of-area-row-${earliest.admission.id}`).textContent).toContain(name);
    expect(button.textContent).toBe(`Plan next return ${name}`);
  });
});
