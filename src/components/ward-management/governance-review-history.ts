import type { AuditEvent, AuditReview } from "./ward-audit";

/**
 * Each audit event's reviews, oldest first, found by one pass over the reviews. The register asked
 * for an event's history several times per row, and each ask scanned every review, so the work grew
 * with events times reviews as the audit trail grew (performance audit WF-25, 11 November 2026).
 * A review belongs to an event only in the same world generation, as before.
 */
export function reviewHistoryLookup(
  reviews: readonly AuditReview[],
): (event: Pick<AuditEvent, "id" | "generation">) => readonly AuditReview[] {
  const byGeneration = new Map<number, Map<string, AuditReview[]>>();
  for (const review of reviews) {
    let byEvent = byGeneration.get(review.generation);
    if (!byEvent) byGeneration.set(review.generation, (byEvent = new Map()));
    const list = byEvent.get(review.eventId);
    if (list) list.push(review);
    else byEvent.set(review.eventId, [review]);
  }
  return (event) => byGeneration.get(event.generation)?.get(event.id) ?? [];
}
