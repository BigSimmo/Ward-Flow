import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 5 on screen: record an action from the agenda, then mark it done. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("bed meeting agenda", () => {
  it("records a picked action against a person on the agenda and marks it done", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "0 done in the last day · 0 overdue · 0 still open",
    );
    const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
    fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);

    const recordButton = screen.getByTestId("bed-meeting-action-record");
    expect(recordButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByTestId("bed-meeting-action-kind"), { target: { value: "book_transport" } });
    fireEvent.click(recordButton);

    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent("0 overdue · 1 still open");
    const list = screen.getByTestId("bed-meeting-action-list");
    expect(within(list).getByText(/Book transport/)).toBeInTheDocument();
    expect(within(waits).getByText("Agreed: Book transport")).toBeInTheDocument();

    fireEvent.click(within(list).getByTestId("bed-meeting-action-done"));
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "1 done in the last day · 0 overdue · 0 still open",
    );
  });
});
