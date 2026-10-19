import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * v10 pass 3 (10 Oct 2026): a page step is recorded at once and its toast offers Undo, which
 * takes it back through the engine's own undo event (handover sign-off, transport stage).
 */
afterEach(cleanup);

describe("Handover sign-off with Undo", () => {
  it("records the sign-off and Undo takes it back", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HandoverPage />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-handover-sign-off-button"));
    expect(screen.getByTestId("ward-handover-hero-sign-off")).toHaveTextContent("Signed 10:42");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("ward-handover-hero-sign-off")).not.toHaveTextContent("Signed 10:42");
    expect(screen.getByText("Sign-off undone.")).toBeInTheDocument();
  });
});

describe("Transport stage step with Undo", () => {
  it("records en route on WF-005 and the toast's Undo puts it back at Accepted", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    const select = screen.queryByTestId("ward-officer-select-WF-005");
    if (select) fireEvent.click(select);
    fireEvent.click(screen.getByTestId("ward-officer-enroute-WF-005"));
    expect(screen.getByTestId("ward-officer-stepper-WF-005")).toHaveAttribute(
      "aria-label",
      "Transport stage: En route, next collected",
    );

    const undo = await screen.findByTestId("ward-officer-toast-undo");
    await act(async () => fireEvent.click(undo));
    expect(screen.getByTestId("ward-officer-stepper-WF-005")).toHaveAttribute(
      "aria-label",
      "Transport stage: Accepted, next en route",
    );
    expect(screen.getByText("Undone. Back as it was.")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-officer-toast-undo")).not.toBeInTheDocument();
  });
});
