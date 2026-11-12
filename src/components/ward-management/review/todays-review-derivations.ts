import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import type { DeclineEntry, InboxItem } from "@/components/ward-management/ward-derivations";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import type { Rejection } from "@/components/ward-management/ward-model";

/**
 * TODAY'S REVIEW (Josh, Home notes 4, issue 4, 9 Nov 2026): the four Home registers (Exceptions,
 * Declines, Overrides, Refused) become one page with two parts: what to settle before handover, and
 * everything off-plan today in one list, newest first, with repeats grouped so patterns stand out.
 *
 * Everything here is read from records the app already keeps. Nothing is authored and nothing is
 * stored by this file: an override's "Reviewed" is the governance review the coordinator already
 * records (`REVIEW_AUDIT_EVENT`, coordinator only, which matches Josh's ruling of 9 Nov 2026 that
 * any coordinator on shift may mark an override reviewed).
 */

type ReviewKind = "decline" | "override" | "stopped" | "problem";

export type ReviewFilter = "all" | ReviewKind;

/** One line in "Everything today". `members` is set on a grouped line (two or more from one ward). */
export type ReviewEvent =
  | { kind: "decline"; id: string; at: Instant; unitId: string; members: DeclineEntry[] }
  | { kind: "override"; id: string; at: Instant; event: AuditEvent; reviewed: boolean }
  | { kind: "stopped"; id: string; at: Instant; rejection: Rejection }
  | { kind: "problem"; id: string; at: Instant | undefined; item: InboxItem };

export type ReviewTodo =
  | { kind: "override"; id: string; event: AuditEvent; done: boolean }
  | { kind: "repeat-declines"; id: string; unitId: string; reason: string | undefined; count: number }
  | { kind: "open-problems"; id: string; count: number };

export type TodaysReviewInput = {
  declines: readonly DeclineEntry[];
  /** The governance log as the coordinator reads it (captured and synthetic seed entries). */
  auditEvents: readonly AuditEvent[];
  auditReviews: readonly AuditReview[];
  rejections: readonly Rejection[];
  /** The open task list, as Home's own count reads it. These are open now, not "today". */
  problems: readonly InboxItem[];
  /** The world generation the reviews belong to: a review from an earlier generation does not count. */
  generation: number;
  now: Instant;
};

export type TodaysReview = {
  todos: ReviewTodo[];
  events: ReviewEvent[];
  /** Lines per filter chip: a ward's declines are one grouped line. */
  counts: Record<ReviewFilter, number>;
  /** Today's declines one by one, for the headline figure (a grouped line holds several). */
  declineCount: number;
};

/** A ward declining this many times today for the same reason is worth raising at the bed meeting. */
export const REPEAT_DECLINE_THRESHOLD = 3;

const isToday = (at: Instant | null | undefined, now: Instant): at is Instant =>
  typeof at === "number" && at <= now && dayOf(at) === dayOf(now);

function isReviewed(event: AuditEvent, reviews: readonly AuditReview[]): boolean {
  // Reviews are appended, so the latest decision for this event and generation is the one that stands.
  const latest = reviews
    .filter((review) => review.eventId === event.id && review.generation === event.generation)
    .at(-1);
  return latest?.decision === "reviewed";
}

export function todaysReview(input: TodaysReviewInput): TodaysReview {
  const { now } = input;

  const declinesToday = input.declines.filter((entry) => isToday(entry.decline.at, now));
  const byUnit = new Map<string, DeclineEntry[]>();
  for (const entry of declinesToday) {
    const list = byUnit.get(entry.decline.unitId) ?? [];
    list.push(entry);
    byUnit.set(entry.decline.unitId, list);
  }

  const overridesToday = input.auditEvents.filter(
    (event) => event.category === "override" && event.generation === input.generation && isToday(event.at, now),
  );
  const stoppedToday = input.rejections.filter((rejection) => isToday(rejection.at, now));

  const events: ReviewEvent[] = [];
  for (const [unitId, members] of byUnit) {
    const newestFirst = [...members].sort((a, b) => b.decline.at - a.decline.at);
    events.push({
      kind: "decline",
      // Keyed by ward and its newest decline, never by a patient link (archived D-14).
      id: `decline-${unitId}-${newestFirst[0]!.decline.at}`,
      at: newestFirst[0]!.decline.at,
      unitId,
      members: newestFirst,
    });
  }
  for (const event of overridesToday) {
    events.push({
      kind: "override",
      id: `override-${event.id}`,
      at: event.at as Instant,
      event,
      reviewed: isReviewed(event, input.auditReviews),
    });
  }
  for (const rejection of stoppedToday) {
    events.push({ kind: "stopped", id: `stopped-${rejection.id}`, at: rejection.at, rejection });
  }
  for (const item of input.problems) {
    events.push({ kind: "problem", id: `problem-${item.id}`, at: item.since, item });
  }
  // Newest first; an open problem with no recorded start sits after the timed lines, in list order.
  events.sort((a, b) => (b.at ?? Number.NEGATIVE_INFINITY) - (a.at ?? Number.NEGATIVE_INFINITY));

  const todos: ReviewTodo[] = [];
  for (const event of [...overridesToday].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))) {
    todos.push({
      kind: "override",
      id: `todo-override-${event.id}`,
      event,
      done: isReviewed(event, input.auditReviews),
    });
  }
  for (const [unitId, members] of byUnit) {
    const byReason = new Map<string | undefined, number>();
    for (const entry of members) byReason.set(entry.decline.reason, (byReason.get(entry.decline.reason) ?? 0) + 1);
    for (const [reason, count] of byReason) {
      // An ED's copy carries no reason (D-80), so "the same reason" is only claimed when one is recorded.
      if (reason !== undefined && count >= REPEAT_DECLINE_THRESHOLD) {
        todos.push({ kind: "repeat-declines", id: `todo-declines-${unitId}-${reason}`, unitId, reason, count });
      }
    }
  }
  if (input.problems.length > 0) {
    todos.push({ kind: "open-problems", id: "todo-open-problems", count: input.problems.length });
  }

  const counts: Record<ReviewFilter, number> = { all: events.length, decline: 0, override: 0, stopped: 0, problem: 0 };
  let declineCount = 0;
  for (const event of events) {
    counts[event.kind] += 1;
    if (event.kind === "decline") declineCount += event.members.length;
  }

  return { todos, events, counts, declineCount };
}

/**
 * Overrides still waiting for a review. Only an override has a recorded "done": repeated declines and
 * open problems are pointers to the bed meeting and Handover, and stay until the records change.
 */
export function overridesToReview(todos: readonly ReviewTodo[]): number {
  return todos.filter((todo) => todo.kind === "override" && !todo.done).length;
}
