import type { LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { searchWardFlow, shouldDeriveSearchTasks } from "@/components/ward-management/search/ward-smart-search";
import type { InboxItem } from "@/components/ward-management/ward-derivations";

// Synthetic inbox rows worded like the real derivations ("Bed pull expired", "Transport awaiting departure").
const icon = (() => null) as unknown as LucideIcon;
const task = (id: string, title: string): InboxItem => ({
  id,
  tone: "danger",
  icon,
  title,
  detail: "WF-0001 · synthetic",
  owner: "Coordinator",
  movementId: "WF-0001",
});

const rows = [task("bed-pull-WF-0001", "Bed pull expired"), task("transport-WF-0001", "Transport awaiting departure")];

function searchTasks(query: string) {
  return searchWardFlow({ query, patients: [], movements: [], units: [], precomputedTasks: rows }).tasks;
}

describe("search keeps the inbox for words the task titles are written in", () => {
  it.each(["bed", "pull", "transport", "tran", "legal", "departure"])("derives tasks for %s", (query) => {
    expect(shouldDeriveSearchTasks(query)).toBe(true);
  });

  it("finds the bed-pull action when a staff member searches 'bed'", () => {
    expect(searchTasks("bed").map((result) => result.task.title)).toEqual(["Bed pull expired"]);
  });

  it("finds the transport action when a staff member searches 'transport'", () => {
    expect(searchTasks("transport").map((result) => result.task.title)).toEqual(["Transport awaiting departure"]);
  });

  it("still skips the inbox for an ordinary name, which is what the gate is for", () => {
    expect(shouldDeriveSearchTasks("Smith")).toBe(false);
    expect(shouldDeriveSearchTasks("Bedford")).toBe(false);
    expect(shouldDeriveSearchTasks("Be")).toBe(false);
    expect(searchTasks("Smith")).toEqual([]);
  });
});
