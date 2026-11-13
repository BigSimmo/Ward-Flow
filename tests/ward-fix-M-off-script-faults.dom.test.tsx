import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { alertActionFor } from "@/components/ward-management/alerts/alerts-model";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { askWardsHref } from "@/components/ward-management/movements/movement-next-step";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Fix worker M (13 Nov 2026), Audit 12/14 handover, after-demo items. Synthetic records only.
 * A14-12: a row in the Discharges page's slipped-dates list opened "This record could not be opened".
 * A14-13: "Find a bed" on a "Multiple destinations declined" alert linked to Home, so on Home it did nothing.
 * K37: a "Change" control beside the ED row's "No transport needed" badge, no confirm step.
 */

afterEach(cleanup);

describe("A14-12: every row in the slipped-dates list opens a record", () => {
  it("never shows the could-not-be-opened panel", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const card = screen.getByTestId("ward-discharge-slipping");
    const showAll = within(card).queryByRole("button", { name: /^Show all/u });
    if (showAll) fireEvent.click(showAll);
    const ids = within(card)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-testid")!.replace("ward-discharge-slipping-", ""));
    // Anti-vacuity: the seed has slipped stays, so the walk below has rows to press.
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const row = within(screen.getByTestId(`ward-discharge-slipping-${id}`)).getByRole("button");
      act(() => fireEvent.click(row));
      const drawer = screen.getByTestId("ward-discharge-detail");
      expect(drawer.textContent).not.toContain("could not be opened");
      act(() => fireEvent.keyDown(window, { key: "Escape" }));
      // An opened record moves to Admission records; go back to Now for the next row.
      const now = screen.queryByRole("tab", { name: /^Now/u });
      if (now && now.getAttribute("aria-selected") !== "true") act(() => fireEvent.click(now));
    }
  });
});

describe("A14-13: Find a bed on a declined alert goes to that person's Ask wards step", () => {
  it("links the movement's Patient page with Ask wards open, never Home", () => {
    const item = {
      id: `${INBOX_CATEGORIES.destinations_declined.idPrefix}WF-003`,
      kind: INBOX_CATEGORIES.destinations_declined.kind,
      title: "Multiple destinations declined",
      detail: "WF-003 · 3 destinations have declined",
      movementId: "WF-003",
    } as unknown as InboxItem;
    const action = alertActionFor(item, { displayName: "Synthetic", umrn: "UM000000", from: "Ward" });
    expect(action).toMatchObject({ kind: "link", label: "Find a bed" });
    expect(action.kind === "link" ? action.href : "").toBe(askWardsHref("WF-003"));
    expect(askWardsHref("WF-003")).toBe(`${movementHref("WF-003")}?taskAction=refer`);
    expect(action.kind === "link" ? action.href : "").not.toBe("/ward-flow");
  });
});

describe("K37: Change beside the No transport needed badge", () => {
  it("records transport needed in one press and brings the booking steps back", () => {
    const MOVEMENT = "WF-011";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-ed-unfold-${MOVEMENT}`));
    fireEvent.click(screen.getByTestId(`ward-ed-no-transport-needed-${MOVEMENT}`));
    const badge = screen.getAllByTestId(`ward-ed-no-transport-badge-${MOVEMENT}`)[0]!;
    const change = within(badge).getByTestId(`ward-ed-no-transport-change-${MOVEMENT}`);
    expect(change).toHaveTextContent("Change");
    fireEvent.click(change);
    // No confirm step: the badge goes at once.
    expect(screen.queryByTestId(`ward-ed-no-transport-badge-${MOVEMENT}`)).toBeNull();
    expect(screen.queryByRole("dialog", { name: /transport/iu })).toBeNull();
    // The row offers both answers again, and the booking step is there.
    const unfold = screen.getByTestId(`ward-ed-unfold-${MOVEMENT}`);
    if (unfold.getAttribute("aria-expanded") !== "true") fireEvent.click(unfold);
    expect(screen.getByTestId(`ward-ed-no-transport-needed-${MOVEMENT}`)).toBeInTheDocument();
    expect(screen.getByTestId(`ward-ed-book-transport-toggle-${MOVEMENT}`)).toHaveTextContent("Log transport booking");
  });
});
