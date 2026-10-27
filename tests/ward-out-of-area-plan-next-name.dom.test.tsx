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
    const button = screen.getByRole("button", { name: /Plan next return/i });
    const opens = /^Opens (.+), the longest past discharge with no plan$/.exec(button.getAttribute("title") ?? "");
    expect(opens).not.toBeNull();
    expect(button.textContent).toBe(`Plan next return ${opens![1]}`);
  });
});
