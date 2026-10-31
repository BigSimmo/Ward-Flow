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

// Decision 46: the site bed manager reads the agenda only. Off by default, so the desk is the coordinator's.
const desk = vi.hoisted(() => ({ readOnly: false }));
vi.mock("@/components/ward-management/shell/ward-access-store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ward-management/shell/ward-access-store")>();
  return {
    ...original,
    useEffectiveWardAccess: () => {
      const access = original.useEffectiveWardAccess();
      return desk.readOnly ? { ...access, role: "bed_manager" as const } : access;
    },
  };
});

describe("bed meeting agenda", () => {
  it("offers a site bed manager no Action or Done, only the agenda to read (decision 46)", () => {
    desk.readOnly = true;
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <BedMeetingAgendaScreen />
        </WardFlowProvider>,
      );
      expect(screen.getByTestId("bed-meeting-agenda-ed-waits")).toBeInTheDocument();
      expect(screen.queryByTestId("bed-meeting-add-action")).toBeNull();
      expect(screen.queryByTestId("bed-meeting-action-done")).toBeNull();
      expect(screen.getByText(/Read only\. The bed coordinator records and completes actions\./)).toBeInTheDocument();
    } finally {
      desk.readOnly = false;
    }
  });

  it("records a picked action against a person on the agenda and marks it done", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "No actions waiting from earlier meetings",
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

    // The open kind is not offered again for the same person, so the reducer never has to refuse it.
    fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);
    const kinds = within(screen.getByTestId("bed-meeting-action-kind")).getAllByRole("option");
    expect(kinds.map((option) => option.getAttribute("value"))).not.toContain("book_transport");
    expect(kinds.length).toBeGreaterThan(1);

    fireEvent.click(within(list).getByTestId("bed-meeting-action-done"));
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "No actions waiting from earlier meetings · 1 done in the last day",
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

  it("opens the same bed meeting sheet as Capacity and starts the meeting on the TV (core pages redesign)", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Agenda");
    expect(screen.getByTestId("agenda-start-meeting")).toHaveAttribute("href", "/ward-flow/bed-meeting");
    fireEvent.click(screen.getByTestId("bed-meeting-sheet-open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("bed-meeting-sheet-print")).toBeInTheDocument();
    // The lists keep a small action button on every row, named for the person.
    const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
    const [first] = within(waits).getAllByTestId("bed-meeting-add-action");
    expect(first).toHaveAccessibleName(/^Add an action for /u);
  });
});
