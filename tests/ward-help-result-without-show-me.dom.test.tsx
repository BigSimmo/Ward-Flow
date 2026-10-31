import { describe, expect, it, vi } from "vitest";

import { headerHelpRows, openHelpResult } from "@/components/ward-management/ward-global-search-help";

describe("a Help search answer with nowhere to go", () => {
  it("opens the desk's task in How do I… when Show me (and so Ask) is off, as on demo and live builds", () => {
    const rows = headerHelpRows("release a pulled bed", "coordinator").items;
    const row = rows.find((item) => item.id === "howto:release-pulled-bed");
    expect(row?.href).toBe("");
    const heard = vi.fn();
    window.addEventListener("ward-flow-open-help", heard);
    try {
      expect(openHelpResult(row!.id, "coordinator", false)).toBe(true);
      expect((heard.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
        view: "tasks",
        task: "release-pulled-bed",
      });
    } finally {
      window.removeEventListener("ward-flow-open-help", heard);
    }
  });
});
