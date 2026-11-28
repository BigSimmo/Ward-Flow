import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { EXPECT_RECONSIDER_AFTER_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { atDesktopWidth } from "./helpers/ed-phone-lists";

// Untested-537 VALUE-049 (14 Nov 2026): the desktop Expected table left out the "does it still
// stand?" note the phone list shows once a referral has waited past the reconsider time.
describe("ED desktop Expected list", () => {
  it("shows the reconsider note on a row referred longer ago than the reconsider time", () => {
    atDesktopWidth();
    const later = NOW_ANCHOR + EXPECT_RECONSIDER_AFTER_MINUTES + 60;
    let found = 0;
    for (const department of allEmergencyDepartments()) {
      const view = render(
        <WardFlowProvider initialNow={later}>
          <EdScreen edId={department.id} />
        </WardFlowProvider>,
      );
      // Expected is a section of My list now (batch 1 item 14, 26 Nov 2026), not a Lists tab.
      const option = screen.queryByRole("radio", { name: /^My list/u });
      if (option) {
        fireEvent.click(option);
        const table = screen.queryByRole("table", { name: "Expected" });
        if (table) {
          for (const row of within(table).getAllByRole("row").slice(1)) {
            const waited = Number(row.getAttribute("data-minutes-waiting"));
            const note = within(row).queryByTestId(/^ward-ed-expects-reconsider-/u);
            expect(note !== null, `row waited ${waited} minutes`).toBe(waited >= EXPECT_RECONSIDER_AFTER_MINUTES);
            if (note) found += 1;
          }
        }
      }
      view.unmount();
    }
    expect(found, "no seeded department shows a desktop Expected row to check").toBeGreaterThan(0);
  });
});
