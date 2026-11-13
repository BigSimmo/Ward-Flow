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
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

// A16-04: the app shows only travel bands someone has checked (none yet). This file tests a
// mechanism that needs bands, so importing this swaps in the tests' own invented table.
import "./helpers/ward-test-travel-bands";

afterEach(cleanup);

/**
 * P192: on the desktop board "Plan next return" named its patient only in a hover tooltip, while the
 * phone bar shows the surname on the button. The desktop button now shows the patient's full name (D-83), so the
 * coordinator sees whose return opens before clicking. Synthetic demo data only.
 */
describe("out-of-area desktop: Plan next return names the patient (P192)", () => {
  it("shows the next patient's full name on the button, matching its tooltip", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OutOfAreaBoard admissions={wardAdmissions} />
      </WardFlowProvider>,
    );
    // Page tops (Josh approved, 9 Nov 2026): the full name sits in the hero's next-step title, read
    // before the Plan next return button.
    const button = screen.getByRole("button", { name: /Plan next return/i });
    const title = screen.getByTestId("ward-out-of-area-next-return");
    expect(title.textContent).toMatch(/^Next return: \S.+$/);
    expect(title.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
