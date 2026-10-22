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
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent("No actions are waiting.");
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

    // The open kind is not offered again for the same person, so the reducer never has to refuse it.
    fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);
    const kinds = within(screen.getByTestId("bed-meeting-action-kind")).getAllByRole("option");
    expect(kinds.map((option) => option.getAttribute("value"))).not.toContain("book_transport");
    expect(kinds.length).toBeGreaterThan(1);

    fireEvent.click(within(list).getByTestId("bed-meeting-action-done"));
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "No actions are waiting · 1 done in the last day.",
    );
  });

  it("closes only the tapped action on a double click, never the next person's (Audit 7 NB-02)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
    for (const index of [0, 1]) {
      fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[index]!);
      fireEvent.change(screen.getByTestId("bed-meeting-action-kind"), { target: { value: "book_transport" } });
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    }
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent("0 overdue · 2 still open");

    const list = screen.getByTestId("bed-meeting-action-list");
    const [first] = within(list).getAllByTestId("bed-meeting-action-done");
    fireEvent.click(first!, { detail: 1 });
    // The row has gone, so the second click of the pair lands on the next person's Done.
    fireEvent.click(within(list).getAllByTestId("bed-meeting-action-done")[0]!, { detail: 2 });
    // A touch screen counts each tap as a first click, so the short pause catches that too.
    fireEvent.click(within(list).getAllByTestId("bed-meeting-action-done")[0]!, { detail: 1 });
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "1 done in the last day · 0 overdue · 1 still open",
    );
  });
});
