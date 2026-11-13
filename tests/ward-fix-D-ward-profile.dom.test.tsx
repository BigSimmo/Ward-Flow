import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { officialForms } from "@/lib/form-register";

/**
 * D-170 item 7 and check pack E1 (Josh, 13 Nov 2026): the ward profile lists no standing forms. The
 * "Forms held" row gave every authorised ward the same list from one yes/no flag; until a per-ward
 * fact is recorded, a ward names no form at all, so it can name neither a community treatment order
 * (the 2026-09-18 defect in `tests/ward-register-inpatient-form-codes.test.ts`) nor an inpatient one.
 * This opens each authorised ward's profile on All wards and reads what it shows. Synthetic data only.
 */
const COMMUNITY_ORDER_CODES = officialForms
  .filter((form) => form.category === "Community treatment orders")
  .map((form) => form.code);

describe("All wards: a ward's profile names no standing forms", () => {
  it("shows no Forms held row and no form number on any authorised ward's profile", () => {
    const authorised = STANDARD_WARD_SITES.flatMap((site) => site.units).filter((unit) => unit.authorised);
    expect(authorised.length).toBeGreaterThanOrEqual(20);
    expect(COMMUNITY_ORDER_CODES.length).toBeGreaterThanOrEqual(4);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const opened: string[] = [];
    for (const unit of authorised) {
      const card = screen.queryByRole("heading", { level: 2, name: unit.name })?.closest("article");
      if (!card) continue;
      fireEvent.click(within(card as HTMLElement).getByRole("button", { name: unit.name }));
      const profile = within(
        screen.getByRole("dialog", { name: new RegExp(`^${unit.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u") }),
      ).getByRole("region", { name: "Ward profile" });
      // The profile still says something, so an emptied panel cannot pass.
      expect(profile, unit.id).toHaveTextContent("Cohort");
      expect(profile, unit.id).not.toHaveTextContent(/Forms held|WA MHA/u);
      expect(profile.textContent ?? "", unit.id).not.toMatch(/\bForm \d/u);
      for (const code of COMMUNITY_ORDER_CODES)
        expect(profile.textContent ?? "", unit.id).not.toContain(`Form ${code}`);
      opened.push(unit.id);
    }
    // Every authorised ward in the standard network has a card on All wards.
    expect(opened).toEqual(authorised.map((unit) => unit.id));
  });
});
