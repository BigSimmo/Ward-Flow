// H-0975 (workflow-speed audit WS-10, 26 Oct 2026): Home's "Waiting on others" links open the
// row's own record. "Chase transport" opens that patient's movement, never the general Movements
// list. A planned arrival has no movement, and its booking id stays out of every link.
import { describe, expect, it } from "vitest";

import { alertActionFor, alertKindOf, resolveAlertSubject } from "@/components/ward-management/alerts/alerts-model";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const subjectOf = (item: InboxItem) => {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => candidate.id === item.movementId);
  return resolveAlertSubject(movement, item.movementId, state, state.units);
};

describe("alert links open the row's own record", () => {
  it("Chase transport opens that patient's movement", () => {
    const item: InboxItem = {
      ...({} as InboxItem),
      id: `${INBOX_CATEGORIES.transport_awaiting_departure.idPrefix}WF-004`,
      movementId: "WF-004",
    };
    expect(alertKindOf(item.id)).toBe("transport");
    expect(alertActionFor(item, subjectOf(item))).toEqual({
      kind: "link",
      label: "Chase transport",
      href: movementHref("WF-004"),
    });
  });

  it("every seeded transport alert links to its own movement", () => {
    const state = seedWardFlowState();
    const transport = taskItems(state, NOW_ANCHOR).filter((item) => alertKindOf(item.id) === "transport");
    expect(transport.length).toBeGreaterThan(0);
    for (const item of transport) {
      const action = alertActionFor(item, subjectOf(item));
      expect(action).toEqual({ kind: "link", label: "Chase transport", href: movementHref(item.movementId) });
    }
  });

  it("a planned arrival keeps Open bookings on Capacity, with no booking id in the link", () => {
    const item: InboxItem = {
      ...({} as InboxItem),
      id: `${INBOX_CATEGORIES.planned_arrival_overdue.idPrefix}PA-1`,
      movementId: "",
      href: "/ward-flow/capacity",
      plannedAdmission: { id: "PA-1" } as InboxItem["plannedAdmission"],
    };
    expect(alertKindOf(item.id)).toBe("planned");
    expect(alertActionFor(item, { displayName: "Initials RK", umrn: "", from: "Ward" })).toEqual({
      kind: "link",
      label: "Open bookings",
      href: "/ward-flow/capacity",
    });
  });
});
