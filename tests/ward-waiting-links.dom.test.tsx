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
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
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
    window.history.replaceState(null, "", "/ward-flow/delays?view=form");
    withProvider(<DelaysScreen />);
    expect(screen.getByTestId("delays-view-form")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("delays-view-form")).toHaveTextContent("Form due within 3 h");
    const [shown, total] = shownCount().split(" of ").map(Number);
    expect(shown).toBeLessThan(total!);
  });

  it("keeps one view at a time and writes it to the address", () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    withProvider(<DelaysScreen />);
    fireEvent.click(screen.getByTestId("delays-view-needs-me"));
    fireEvent.click(screen.getByTestId("delays-view-handover"));
    expect(screen.getByTestId("delays-view-needs-me")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("delays-view-handover")).toHaveAttribute("aria-pressed", "true");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("handover");
    fireEvent.click(screen.getByTestId("delays-view-handover"));
    expect(new URLSearchParams(window.location.search).get("view")).toBeNull();
  });

  it("names the 1 hour chip's noun", () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    withProvider(<DelaysScreen />);
    expect(screen.getByTestId("delays-stat-due")).toHaveTextContent("Form due within 1 h");
  });

  it("counts the referrals not yet on the list, with a link to Referrals", () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    withProvider(<DelaysScreen />);
    const line = screen.getByTestId("delays-referrals-line");
    const queued = referralQueueOrder(seedWardFlowState().referrals).length;
    expect(line).toHaveTextContent(queued === 0 ? "No referrals" : `${queued} referral`);
    expect(within(line).getByRole("link", { name: "Open Referrals" })).toHaveAttribute("href", "/ward-flow/referrals");
  });
});

describe("screens link into a view", () => {
  it("Movements' Needs you opens Needs me now", () => {
    withProvider(<MovementsScreen />);
    const head = screen.getByTestId("movements-needs-you");
    expect(within(head).getByRole("link", { name: "All in Delays" })).toHaveAttribute(
      "href",
      "/ward-flow/delays?view=needs-me",
    );
  });

  it("Handover opens For handover", () => {
    withProvider(<HandoverPage />);
    expect(screen.getByRole("link", { name: "Open in Delays" })).toHaveAttribute(
      "href",
      "/ward-flow/delays?view=handover",
    );
  });

  it("Home's queue opens Form due while Form due is on", () => {
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
    const link = () => screen.getByRole("link", { name: "Open in Delays" });
    expect(link()).toHaveAttribute("href", "/ward-flow/delays");
    fireEvent.click(screen.getByRole("button", { name: /Form due/u }));
    expect(link()).toHaveAttribute("href", "/ward-flow/delays?view=form");
  });

  it("Home's Form due reads the current due time, as the Delays view does", () => {
    const base = seedWardFlowState().movements.find(
      (movement) => movement.legalForm !== undefined && movement.legalStatus !== "Voluntary",
    )!;
    const due: Movement = {
      ...base,
      closure: undefined,
      examination: undefined,
      legalForm: { ...base.legalForm!, code: "1A", dueAt: NOW_ANCHOR + 30 },
    };
    // The form ended at the examination, so its old due time no longer counts (as on Delays).
    const ended: Movement = { ...due, examination: { ...base.examination, outcome: "inpatient_order" } as never };
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
    fireEvent.click(screen.getByRole("button", { name: /Form due/u }));
    expect(screen.queryByText("Nothing due soon")).toBeNull();
    cleanup();
    queue(ended);
    fireEvent.click(screen.getByRole("button", { name: /Form due/u }));
    expect(screen.getByText("Nothing due soon")).toBeInTheDocument();
  });

  it("the Patients shift panel opens the whole list", () => {
    render(
      <ShiftSummary
        rows={[]}
        closedToday={[]}
        now={NOW_ANCHOR}
        highlight={null}
        highlightCounts={{ long: 0, form: 0, edd: 0, aed: 0 } as never}
        onSelect={() => {}}
        onHighlight={() => {}}
        onHistory={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Waiting list in Delays" })).toHaveAttribute("href", "/ward-flow/delays");
  });
});
