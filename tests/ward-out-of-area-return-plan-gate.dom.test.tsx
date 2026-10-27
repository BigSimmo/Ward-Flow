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

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard admissions={wardAdmissions} />
    </WardFlowProvider>,
  );
}

describe("out-of-area return plan — Send to ward gate and Mark ward agreed wiring", () => {
  it("keeps Send to ward disabled with the block reason while the return plan is incomplete", () => {
    renderBoard();
    const first = entries[0]!;
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    const sendBtn = screen.getByTestId("ward-out-of-area-repat-send");
    expect(sendBtn).toHaveAttribute("aria-disabled", "true");
    expect(sendBtn).toHaveAttribute("title", "Answer the 6 left first.");
    fireEvent.click(sendBtn);
    expect(screen.queryByTestId("ward-out-of-area-recorded")).not.toBeInTheDocument();
  });

  it("enables Send to ward once required fields are filled, records pending return, and wires Mark ward agreed", () => {
    renderBoard();
    const first = entries[0]!;
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    fireEvent.click(within(screen.getByTestId("ward-out-of-area-repat-mode")).getByLabelText("Road"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-provider"), {
      target: { value: "Ambulance (St John)" },
    });
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-cad"), { target: { value: "CAD-7788" } });
    fireEvent.click(screen.getByLabelText("Voluntary"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-estimated-time"), { target: { value: "14:30" } });

    const sendBtn = screen.getByTestId("ward-out-of-area-repat-send");
    expect(sendBtn).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(sendBtn);

    const recorded = screen.getByTestId("ward-out-of-area-recorded");
    expect(recorded).toHaveTextContent("Not yet agreed");
    expect(recorded).toHaveTextContent("Awaiting the receiving ward");

    const markAgreedBtn = screen.getByTestId("ward-out-of-area-mark-ward-agreed");
    expect(markAgreedBtn).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(markAgreedBtn);

    expect(screen.getByTestId("ward-out-of-area-recorded")).toHaveTextContent("Agreed");
    expect(screen.getByTestId("ward-out-of-area-recorded")).toHaveTextContent("Movement opened");
    expect(screen.getByRole("link", { name: "Open movement" })).toBeInTheDocument();
  });
});
