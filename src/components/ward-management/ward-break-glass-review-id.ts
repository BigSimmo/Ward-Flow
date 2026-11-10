/**
 * **A BREAK GLASS OPENING'S REVIEW ID (D-80 item 14).** The coordinator's Governance review list
 * holds break glass openings beside the captured audit entries, and marks them Reviewed or
 * Follow-up with the same `REVIEW_AUDIT_EVENT`. An opening is not in the workspace: the shared
 * server keeps it in its own append-only table, and the local demo derives synthetic ones. So its
 * review names it by this id alone: the server's row number, or a demo opening's own key.
 *
 * Kept in its own small file so the reducer, the stored-state check and the access rules can read
 * it without loading the Governance screen.
 */
export const BREAK_GLASS_REVIEW_PREFIX = "audit-break-glass-";
/**
 * Master audit M58 (D-125): each cover given joins the same list, kept outside the workspace like an
 * opening (the server's audit row number, or a demo cover's own key), so it is named the same way.
 */
export const COVER_REVIEW_PREFIX = "audit-cover-";

const REVIEW_ID = /^audit-(?:break-glass|cover)-[a-z0-9-]{1,40}$/;

/** True for the review id of a break glass opening or of a cover given. */
export function isBreakGlassReviewId(id: unknown): id is string {
  return typeof id === "string" && REVIEW_ID.test(id);
}
