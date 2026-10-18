import { describe, expect, it } from "vitest";

import { inboxItemsForRole, inboxOwnerRoles } from "@/components/ward-management/ward-act-now-items";
import type { InboxItem } from "@/components/ward-management/ward-derivations";

// Top 25 item 6: Needs you holds the signed in role's own task rows.
function item(id: string, owner: string): InboxItem {
  return { id, owner, title: id, detail: "", tone: "warning", movementId: `WF-${id}` } as unknown as InboxItem;
}

const items = [
  item("a", "Sending team"),
  item("b", "Nurse in charge"),
  item("c", "Bed coordinator"),
  item("d", "ED or ward"),
  item("e", "Ward 7 North"),
  item("f", "Josh"),
];

describe("Needs you for the signed in role", () => {
  it("places each owner's words on the roles they mean, and nothing it cannot place", () => {
    expect(inboxOwnerRoles("Sending team")).toEqual(["ed"]);
    expect(inboxOwnerRoles("Accepting ward")).toEqual(["ward"]);
    expect(inboxOwnerRoles("ED or ward").sort()).toEqual(["ed", "ward"]);
    expect(inboxOwnerRoles("Ward 7 North", ["Ward 7 North"])).toEqual(["ward"]);
    expect(inboxOwnerRoles("Josh")).toEqual([]);
  });

  it("filters to the role, and the coordinator is never limited", () => {
    expect(inboxItemsForRole(items, "ed").map((row) => row.id)).toEqual(["a", "d"]);
    expect(inboxItemsForRole(items, "ward", ["Ward 7 North"]).map((row) => row.id)).toEqual(["b", "d", "e"]);
    expect(inboxItemsForRole(items, "coordinator")).toHaveLength(items.length);
    expect(inboxItemsForRole(items, "officer")).toEqual([]);
  });
});
