import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

import { BedMeetingAgendaScreen } from "@/components/ward-management/bed-meeting/bed-meeting-agenda-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const submitted = vi.hoisted(() => ({
  raise: null as null | (() => WardCommandOutcome | Promise<WardCommandOutcome>),
}));
vi.mock("@/components/ward-management/ward-flow-raise", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-raise")>();
  return {
    ...actual,
    useWardRaise: (role: Parameters<typeof actual.useWardRaise>[0]) => {
      const raise = actual.useWardRaise(role);
      return (...args: Parameters<typeof raise>) =>
        args[0] === "RECORD_BED_MEETING_ACTION" && submitted.raise ? submitted.raise() : raise(...args);
    },
    // The agenda's recorder raises through the plain helper so its Undo can follow the same command.
    wardRaise: (...helper: Parameters<typeof actual.wardRaise>) => {
      const raise = actual.wardRaise(...helper);
      return (...args: Parameters<typeof raise>) =>
        args[0] === "RECORD_BED_MEETING_ACTION" && submitted.raise ? submitted.raise() : raise(...args);
    },
  };
});
afterEach(() => {
  submitted.raise = null;
});

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
  it("retains a refused action draft and closes only after the retry is accepted", async () => {
    let finish!: (outcome: WardCommandOutcome) => void;
    const send = vi.fn(
      () =>
        new Promise<WardCommandOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    submitted.raise = send;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-agenda-ed-waits")).getAllByTestId("bed-meeting-add-action")[0]!,
    );
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
    );
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    expect(screen.getByTestId("bed-meeting-action-form")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => finish({ commandId: "agenda", status: "refused", message: "This action already exists." }));
    expect(
      within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("This action already exists.");
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    await act(async () => finish({ commandId: "agenda-retry", status: "accepted" }));
    expect(screen.queryByTestId("bed-meeting-action-form")).toBeNull();
  });

  it("holds an uncertain action for its matching late confirmation", async () => {
    let finish!: (outcome: WardCommandOutcome) => void;
    const confirmation = new Promise<WardCommandOutcome>((resolve) => {
      finish = resolve;
    });
    const send = vi.fn((): WardCommandOutcome => ({ commandId: "agenda", status: "failed", confirmation }));
    submitted.raise = send;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-agenda-ed-waits")).getAllByTestId("bed-meeting-add-action")[0]!,
    );
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
    );
    await act(async () => fireEvent.click(screen.getByTestId("bed-meeting-action-record")));
    expect(screen.getByTestId("bed-meeting-action-record")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => finish({ commandId: "agenda", status: "accepted" }));
    expect(screen.queryByTestId("bed-meeting-action-form")).toBeNull();
  });

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
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
    );
    fireEvent.click(recordButton);

    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent("0 overdue · 1 still open");
    const list = screen.getByTestId("bed-meeting-action-list");
    expect(within(list).getByText(/Book transport/)).toBeInTheDocument();
    expect(within(waits).getByText("Book transport", { selector: "span" })).toBeInTheDocument();

    // The open kind is not offered again for the same person, so the reducer never has to refuse it.
    fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);
    const kinds = within(screen.getByTestId("bed-meeting-action-kind")).getAllByRole("button");
    expect(kinds.map((chip) => chip.textContent)).not.toContain("Book transport");
    expect(kinds.length).toBeGreaterThan(1);

    fireEvent.click(within(list).getByTestId("bed-meeting-action-done"));
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent(
      "No actions waiting from earlier meetings · 1 done in the last day",
    );
  });

  it("narrows the agenda to people with an open action when that chip is picked", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    const waits = screen.getByTestId("bed-meeting-agenda-ed-waits");
    fireEvent.click(within(waits).getAllByTestId("bed-meeting-add-action")[0]!);
    fireEvent.click(
      within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
    );
    fireEvent.click(screen.getByTestId("bed-meeting-action-record"));

    const filters = screen.getByTestId("bed-meeting-agenda-filters");
    fireEvent.click(within(filters).getByRole("button", { name: /With an action/ }));

    const narrowed = screen.getByTestId("bed-meeting-agenda-ed-waits");
    expect(within(narrowed).getByText("Book transport", { selector: "span" })).toBeInTheDocument();
    expect(within(narrowed).getAllByTestId("bed-meeting-add-action")).toHaveLength(1);
    expect(screen.queryByTestId("bed-meeting-agenda-holds")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bed-meeting-agenda-referrals")).not.toBeInTheDocument();
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
      fireEvent.click(
        within(screen.getByTestId("bed-meeting-action-kind")).getByRole("button", { name: "Book transport" }),
      );
      fireEvent.click(screen.getByTestId("bed-meeting-action-record"));
    }
    expect(screen.getByTestId("bed-meeting-action-summary")).toHaveTextContent("0 overdue · 2 still open");

    const list = screen.getByTestId("bed-meeting-action-list");
    const [first] = within(list).getAllByTestId("bed-meeting-action-done");
    const doneButtons = within(list).getAllByTestId("bed-meeting-action-done");
    const subjects = doneButtons.map((button) => {
      const row = button.closest("li")!;
      const actionAndSubject = within(row).getByText(/Book transport ·/u).textContent!;
      const subject = actionAndSubject.split(" · ").slice(1).join(" · ");
      expect(button).toHaveAccessibleName(`Done: Book transport for ${subject}`);
      expect(button).toHaveTextContent(/^Done$/u);
      return subject;
    });
    expect(new Set(subjects).size).toBe(2);
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

describe("bed meeting agenda group filter (B1 extended, 4 Nov 2026)", () => {
  it("narrows every list to a picked group, shows it as a pill, and clears", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingAgendaScreen />
      </WardFlowProvider>,
    );
    const rows = () => screen.getAllByTestId("bed-meeting-add-action").length;
    const before = rows();
    fireEvent.click(screen.getByTestId("bed-meeting-agenda-groups"));
    const panel = screen.getByTestId("bed-meeting-agenda-groups-panel");
    fireEvent.click(within(panel).getByRole("button", { name: /^Tier 1/u }));
    fireEvent.click(within(panel).getByRole("button", { name: "Done" }));
    const applied = screen.getByTestId("bed-meeting-agenda-groups-applied");
    expect(applied).toHaveTextContent("Tier 1");
    expect(rows()).toBeLessThan(before);
    expect(screen.getByTestId("bed-meeting-agenda-groups")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("bed-meeting-agenda-groups"));
    const again = screen.getByTestId("bed-meeting-agenda-groups-panel");
    fireEvent.click(within(again).getByRole("button", { name: /^Adult/u }));
    fireEvent.click(within(again).getByRole("button", { name: "Done" }));
    expect(screen.getByTestId("bed-meeting-agenda-referrals-hidden")).toHaveTextContent("left out");

    fireEvent.click(
      within(screen.getByTestId("bed-meeting-agenda-groups-applied")).getByRole("button", { name: "Clear" }),
    );
    expect(screen.queryByTestId("bed-meeting-agenda-groups-applied")).toBeNull();
    expect(rows()).toBe(before);
  });
});
