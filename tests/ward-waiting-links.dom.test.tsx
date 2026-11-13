// B4 (Josh, 19 Oct 2026): the Delays board's saved views, and the screens that link into them.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { ShiftSummary } from "@/components/ward-management/search/patient-census-view";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);

const withProvider = (children: ReactNode) =>
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
const shownCount = () => screen.getByTestId("delays-shown-count").textContent ?? "";

describe("the Delays board's saved views", () => {
  it("opens on the view a link names, narrowed, with the chip pressed", () => {
    window.history.replaceState(null, "", "/ward-flow/waiting?view=form");
    withProvider(<DelaysScreen />);
    expect(screen.getByTestId("delays-view-form")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("delays-view-form")).toHaveTextContent("Form due within 3h");
    const [shown, total] = shownCount().split(" of ").map(Number);
    expect(shown).toBeLessThan(total!);
  });

  it("keeps one view at a time and writes it to the address", () => {
    window.history.replaceState(null, "", "/ward-flow/waiting");
    withProvider(<DelaysScreen />);
    fireEvent.click(screen.getByTestId("delays-view-needs-me"));
    fireEvent.click(screen.getByTestId("delays-view-handover"));
    expect(screen.getByTestId("delays-view-needs-me")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("delays-view-handover")).toHaveAttribute("aria-pressed", "true");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("handover");
    fireEvent.click(screen.getByTestId("delays-view-handover"));
    expect(new URLSearchParams(window.location.search).get("view")).toBeNull();
  });

  it("names the next-hour chip's noun", () => {
    // Page tops (Josh, 9 Nov 2026): the Form due figure left the top; the hour chip names what it counts.
    window.history.replaceState(null, "", "/ward-flow/waiting");
    withProvider(<DelaysScreen />);
    expect(screen.queryByTestId("delays-stat-due")).toBeNull();
    const next = screen.queryByTestId("delays-hero-next8");
    if (next) expect(next).toHaveTextContent(/^Next over 8h/u);
  });

  it("counts the referrals not yet on the list, with a link to Referrals", () => {
    window.history.replaceState(null, "", "/ward-flow/waiting");
    withProvider(<DelaysScreen />);
    const line = screen.getByTestId("delays-referrals-line");
    const queued = referralQueueOrder(seedWardFlowState().referrals).length;
    expect(line).toHaveTextContent(queued === 0 ? "No referrals" : `${queued} referral`);
    expect(within(line).getByRole("link", { name: "Open Referrals" })).toHaveAttribute("href", "/ward-flow/referrals");
  });
});

describe("screens link into a view", () => {
  // Movements' "All in Waiting" link went with its Tier 1 card (Movements redesign, 1 Nov 2026, Q102).

  it("Handover opens For handover", () => {
    withProvider(<HandoverPage />);
    fireEvent.click(screen.getByRole("button", { name: "More handover actions" }));
    expect(screen.getByRole("link", { name: "Open in Waiting" })).toHaveAttribute(
      "href",
      "/ward-flow/waiting?view=handover",
    );
  });

  // Q376: the Flow card is the queue's one layout; it has no Form due filter, so it always opens Waiting.
  it("Home's queue opens Waiting", () => {
    const state = seedWardFlowState();
    render(
      <PriorityQueue
        movements={state.movements.slice(0, 5)}
        now={NOW_ANCHOR}
        selectedId={undefined}
        onSelect={() => {}}
        filterEdId={undefined}
        onClearFilter={() => {}}
      />,
    );
    const link = () => screen.getByRole("link", { name: "Open in Waiting" });
    expect(link()).toHaveAttribute("href", "/ward-flow/waiting");
  });

  it("Home's passed-form mark reads the current due time, as the Delays view does", () => {
    const base = seedWardFlowState().movements.find(
      (movement) => movement.legalForm !== undefined && movement.legalStatus !== "Voluntary",
    )!;
    const due: Movement = {
      ...base,
      closure: undefined,
      examination: undefined,
      legalForm: { ...base.legalForm!, code: "1A", dueAt: NOW_ANCHOR - 30 },
    };
    // A1 (13 Nov 2026): the examination alone ends nothing, so the due time still counts after it.
    const examined: Movement = { ...due, examination: { ...base.examination, outcome: "inpatient_order" } as never };
    // A person recorded the form ended, so its old due time no longer counts (as on Delays).
    const ended: Movement = { ...examined, legalForm: { ...due.legalForm!, endedBy: "form_3e" } };
    const queue = (movement: Movement) =>
      render(
        <PriorityQueue
          movements={[movement]}
          now={NOW_ANCHOR}
          selectedId={undefined}
          onSelect={() => {}}
          filterEdId={undefined}
          onClearFilter={() => {}}
        />,
      );
    queue(due);
    expect(screen.getByTestId(`ward-queue-row-${due.id}`)).toHaveTextContent(/Form 1A/u);
    cleanup();
    queue(examined);
    expect(screen.getByTestId(`ward-queue-row-${examined.id}`)).toHaveTextContent(/Form 1A/u);
    cleanup();
    queue(ended);
    expect(screen.getByTestId(`ward-queue-row-${ended.id}`)).not.toHaveTextContent(/Form 1A/u);
  });

  it("the Patients shift panel opens the whole list", () => {
    render(
      <ShiftSummary
        rows={[]}
        closedToday={[]}
        now={NOW_ANCHOR}
        dayZero={new Date(0)}
        highlight={null}
        highlightCounts={{ long: 0, form: 0, edd: 0, aed: 0 } as never}
        onSelect={() => {}}
        onHighlight={() => {}}
        onHistory={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Waiting list" })).toHaveAttribute("href", "/ward-flow/waiting");
  });
});
