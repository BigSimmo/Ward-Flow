import { describe, expect, it } from "vitest";
import { howToFor } from "@/components/ward-management/help/ward-help-access";
import { askHelp, closestHowTos, HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
const rules = HOW_TOS.find((entry) => entry.id === "rules")!;

describe("Help follows action scope as well as desk permissions", () => {
  it("fails closed for global rules without an explicit statewide coordinator scope", () => {
    expect(howToFor(rules, "coordinator")).toBe(false);
    expect(howToFor(rules, "coordinator", service)).toBe(false);
    expect(howToFor(rules, "admin", statewide)).toBe(false);
    expect(howToFor(rules, "coordinator", statewide)).toBe(true);
    expect(rules.answer).toContain("Only the statewide coordinator");
    expect(askHelp("change pull time limit", "coordinator").find((hit) => hit.howTo.id === "rules")?.forThisDesk).toBe(
      false,
    );
    expect(
      askHelp("change pull time limit", "coordinator", 6, statewide).find((hit) => hit.howTo.id === "rules")
        ?.forThisDesk,
    ).toBe(true);
    expect(
      closestHowTos("pull time limit", "coordinator", 20, service).find((hit) => hit.howTo.id === "rules")?.forThisDesk,
    ).toBe(false);
  });

  it.each([
    ["ed", "book-transport-ed", "Log transport booking", "home"],
    ["community", "book-transport-community", "Log transport booking", "home"],
    ["ward", "book-transport-ward", "Record transport booking", "movements"],
    ["coordinator", "book-transport", "Book transport", "movements"],
  ] as const)("gives %s its own supported booking instructions and destination", (role, id, label, go) => {
    const hits = askHelp("book transport", role);
    const own = hits.find((hit) => hit.howTo.title === "Book transport");
    expect(own?.forThisDesk).toBe(true);
    expect(own?.howTo.id).toBe(id);
    expect(own?.howTo.answer).toContain(label);
    expect(own?.howTo.go).toBe(go);
    expect(hits.filter((hit) => hit.howTo.title === "Book transport")).toHaveLength(1);
  });

  it("never turns an executive or admin search result into a transport action", () => {
    for (const role of ["executive", "admin"] as const) {
      const hits = askHelp("book transport", role).filter((hit) => hit.howTo.title === "Book transport");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((hit) => !hit.forThisDesk)).toBe(true);
    }
  });

  it("explains that a community team cancels its own booking within collection limits", () => {
    const own = askHelp("cancel transport", "community").find((hit) => hit.howTo.title === "Cancel transport");
    expect(own?.forThisDesk).toBe(true);
    expect(own?.howTo.id).toBe("cancel-transport-community");
    expect(own?.howTo.answer).toContain("another team's booking");
    expect(own?.howTo.answer).toContain("after collection");
  });
  it.each(["ed", "ward"] as const)("gives %s its narrow orphaned-job cancellation instructions", (role) => {
    const hits = askHelp("cancel transport", role).filter((hit) => hit.howTo.title === "Cancel transport");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.forThisDesk).toBe(true);
    expect(hits[0]?.howTo.id).toBe(`cancel-transport-${role}`);
    expect(hits[0]?.howTo.go).toBe("movements");
    expect(hits[0]?.howTo.answer).toContain("Transport booked with no bed pulled");
    expect(hits[0]?.howTo.answer).toContain("Cancel the transport job");
    expect(hits[0]?.howTo.answer).toContain("ordinary bookings");
    expect(hits[0]?.howTo.answer).toContain("No cancellation is possible after collection");
    if (role === "ward") {
      expect(hits[0]?.howTo.answer).toContain("sending ward recorded as booker");
      expect(hits[0]?.howTo.answer).toContain("receiving the patient is not enough");
    } else expect(hits[0]?.howTo.answer).toContain("a referral your ED sent");
  });
});
