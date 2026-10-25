// Closing-the-loop features (24 Oct 2026, package E): "Group duplicate alerts". Alerts naming one
// recorded journey, stay or person show as one grouped item; recorded order is kept and every alert
// stays reachable inside the item.
import { describe, expect, it } from "vitest";

import { groupLinkedAlerts, linkedRecordKey } from "@/components/ward-management/alerts/alert-linked-groups";
import { alertGroupOf, isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const row = (id: string, movementId = "") => ({ item: { id, movementId } });

describe("grouping alerts by recorded link", () => {
  it("keys a row by its journey, then the stay or person its id names, else nothing", () => {
    expect(linkedRecordKey(row("bed-pull-WF-1", "WF-1"))).toBe("movement:WF-1");
    expect(linkedRecordKey(row("transport-WF-1"))).toBe("movement:WF-1");
    expect(linkedRecordKey(row("awol-AD-7"))).toBe("admission:AD-7");
    expect(linkedRecordKey(row("planned-arrival-PA-1"))).toBeUndefined();
  });

  it("places one item where its first alert sat, keeps order, and counts the moved alerts", () => {
    const act = [row("a1", "WF-1"), row("a2", "WF-2"), row("a3", "WF-1")];
    const wait = [row("w1", "WF-3"), row("w2", "WF-2")];
    const { sections, shownEarlier } = groupLinkedAlerts([act, wait]);

    expect(sections[0]!.map((item) => (item.kind === "single" ? item.entry.item.id : item.key))).toEqual([
      "movement:WF-1",
      "movement:WF-2",
    ]);
    const first = sections[0]![0]!;
    expect(first.kind === "linked" && first.entries.map((entry) => entry.item.id)).toEqual(["a1", "a3"]);
    const second = sections[0]![1]!;
    expect(second.kind === "linked" && second.entries.map((entry) => entry.item.id)).toEqual(["a2", "w2"]);
    expect(second.kind === "linked" && second.sections).toEqual([0, 1]);
    expect(sections[1]!.map((item) => item.kind)).toEqual(["single"]);
    expect(shownEarlier).toEqual([0, 1]);
  });

  it("dissolves a group when the record has one alert left", () => {
    const before = groupLinkedAlerts([[row("a1", "WF-1"), row("a2", "WF-1")]]);
    expect(before.sections[0]!.map((item) => item.kind)).toEqual(["linked"]);
    const after = groupLinkedAlerts([[row("a1", "WF-1")]]);
    expect(after.sections[0]!.map((item) => item.kind)).toEqual(["single"]);
  });

  it("loses no alert: every queue row in the seeded demo appears exactly once", () => {
    const state = seedWardFlowState();
    const queue = taskItems(state, NOW_ANCHOR)
      .filter(isQueueItem)
      .map((item) => ({ item }));
    const sections = [
      queue.filter((entry) => alertGroupOf(entry.item) === "act"),
      queue.filter((entry) => alertGroupOf(entry.item) === "wait"),
      queue.filter((entry) => alertGroupOf(entry.item) === "running"),
    ];
    const shown = groupLinkedAlerts(sections).sections.flatMap((items) =>
      items.flatMap((item) => (item.kind === "single" ? [item.entry] : item.entries)),
    );
    expect(shown.map((entry) => entry.item.id).sort()).toEqual(queue.map((entry) => entry.item.id).sort());
  });
});
