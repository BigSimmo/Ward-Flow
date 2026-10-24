import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { CallSheet } from "@/components/ward-management/coordinator/call-sheet";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function inProvider(children: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
}

describe("Coordinated call sheet (closing-the-loop package A)", () => {
  it("groups the seeded open requests by ward and shows the recorded facts, with nothing to email", () => {
    inProvider(<CallSheet />);
    const sheet = screen.getByTestId("ward-call-sheet");
    const youth = screen.getByTestId("ward-call-sheet-bty-youth");
    expect(youth).toHaveTextContent("Last contact");
    expect(youth).toHaveTextContent("Call back later");
    expect(youth).toHaveTextContent("1 referral");
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001")).toHaveTextContent("Promise overdue");
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001-chases")).toHaveTextContent("Asked 3 times");
    expect(screen.getByTestId("ward-call-sheet-fsh-older-adult")).toBeInTheDocument();
    // Screen and print only: no mail, share or outside link anywhere on the sheet.
    for (const link of within(sheet).queryAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/referrals\?referral=/);
    }
    expect(sheet.innerHTML).not.toMatch(/mailto:|share/i);
    expect(sheet.textContent).not.toMatch(/suggested|recommended|best|priority score/i);
  });

  it("records one call outcome against every referral linked to the ward", async () => {
    const user = userEvent.setup();
    inProvider(<CallSheet />);
    await user.selectOptions(screen.getByTestId("ward-call-sheet-outcome-bty-youth"), "no_answer");
    await user.selectOptions(screen.getByTestId("ward-call-sheet-callback-bty-youth"), "60");
    await user.click(screen.getByTestId("ward-call-sheet-record-bty-youth"));
    expect(screen.getByTestId("ward-call-sheet-item-bty-youth-RF-001-chases")).toHaveTextContent("Asked 4 times");
    expect(screen.getByTestId("ward-call-sheet-bty-youth")).toHaveTextContent("No answer");
  });
});

describe("Handover carries open promises over (closing-the-loop package A)", () => {
  it("lists the seeded overdue promise and the callback due next shift, each linked to its referral", () => {
    inProvider(<HandoverPage />);
    const panel = screen.getByTestId("ward-handover-open-promises");
    const rf001 = within(panel).getByTestId("ward-handover-promise-RF-001");
    expect(rf001).toHaveTextContent("Promise overdue");
    expect(within(rf001).getByRole("link")).toHaveAttribute("href", referralBoardHref("RF-001"));
    expect(within(panel).getByTestId("ward-handover-promise-RF-005")).toHaveTextContent("next callback");
  });
});
