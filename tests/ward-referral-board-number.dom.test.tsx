import "@testing-library/jest-dom/vitest";
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

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

// #819: Search finds a referral by its number, so the bed manager's read-only board shows it too.
describe("Referral board shows the referral number (#819)", () => {
  it("puts each referral's number on its queue row and its card", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralBoard readOnly />
      </WardFlowProvider>,
    );
    const rows = screen.getAllByTestId(/^ward-referral-board-row-/);
    expect(rows.length, "the seed has no queued referral, so this proves nothing").toBeGreaterThan(0);
    for (const row of rows) {
      const id = row.getAttribute("data-referral-id")!;
      expect(id).toMatch(/^RF-/);
      expect(screen.getByTestId(`ward-referral-board-number-${id}`)).toHaveTextContent(id);
      expect(screen.getByTestId(`ward-referral-board-card-number-${id}`)).toHaveTextContent(id);
    }
  });
});
