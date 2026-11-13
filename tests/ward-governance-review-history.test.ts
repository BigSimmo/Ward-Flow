import { describe, expect, it } from "vitest";

import { reviewHistoryLookup } from "@/components/ward-management/governance-review-history";
import type { AuditReview } from "@/components/ward-management/ward-audit";

// Performance audit WF-25 (11 November 2026): the governance register looked up each event's reviews
// by scanning every review, several times per row. The lookup is now built in one pass and keeps the
// same answer: the event's own reviews in that world generation, oldest first. Synthetic ids only.

const review = (id: string, eventId: string, generation: number, decision: AuditReview["decision"]): AuditReview => ({
  id,
  eventId,
  generation,
  at: 0 as AuditReview["at"],
  byRole: "coordinator",
  decision,
});

describe("governance review history lookup", () => {
  const reviews = [
    review("r1", "E-1", 1, "follow-up-required"),
    review("r2", "E-2", 1, "reviewed"),
    review("r3", "E-1", 2, "reviewed"),
    review("r4", "E-1", 1, "reviewed"),
  ];

  it("gives the same reviews, in the same order, as filtering every review", () => {
    const historyFor = reviewHistoryLookup(reviews);
    for (const event of [
      { id: "E-1", generation: 1 },
      { id: "E-1", generation: 2 },
      { id: "E-2", generation: 1 },
      { id: "E-3", generation: 1 },
    ]) {
      expect(historyFor(event)).toEqual(
        reviews.filter((entry) => entry.eventId === event.id && entry.generation === event.generation),
      );
    }
    expect(historyFor({ id: "E-1", generation: 1 }).at(-1)?.decision).toBe("reviewed");
  });

  it("reads the reviews once, however many events ask", () => {
    let reads = 0;
    const counted = {
      *[Symbol.iterator]() {
        for (const entry of reviews) {
          reads += 1;
          yield entry;
        }
      },
    } as unknown as readonly AuditReview[];
    const historyFor = reviewHistoryLookup(counted);
    for (let index = 0; index < 50; index += 1) historyFor({ id: `E-${index}`, generation: 1 });
    expect(reads).toBe(reviews.length);
  });
});
