// src/components/ward-management/movements/movements-derivations.ts
//
// The computation behind Ward Flow's merged Movements screen (MERGE 03, folding `movements` and
// `transport`). Design lock: docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md §5.
//
// The two folded screens showed the same patients at two points of one journey — the stage a
// patient's placement has reached (`MovementsView`, `ward-management-modes.tsx`), and, once a
// vehicle is involved, where that vehicle has got to (`LiveTracker`, `tracker/live-tracker.tsx`).
// `journeyStages` answers the first question and `transportLegs`/`transportCounts` answer the
// second; nothing here re-derives what a stage or a transport leg IS — both borrow the real
// vocabulary (`stageCopy`, `transportLeg`) so this screen can never quietly disagree with the
// screens it replaces about what a given patient's state actually is.
import { clockState, dayOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { isOpen, stageCopy, transportLeg, type TransportLeg } from "@/components/ward-management/ward-derivations";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import {
  MOVEMENT_STAGES,
  type DeclineReason,
  type HealthService,
  type Movement,
  type MovementId,
  type MovementStage,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";

/**
 * Plain-English gloss for each stage, one line, coordinator-facing. `stageCopy` (ward-derivations.ts)
 * only carries `label`/`shortLabel` — display text, not an explanation of what the stage MEANS — so
 * this is new information rather than a second copy of something that already exists. Keyed by
 * `MovementStage` so a future stage is a compile error here, the same discipline `stageCopy` itself
 * uses.
 */
const STAGE_BLURBS: Record<MovementStage, string> = {
  placement_requested: "A destination has been asked for; nothing has responded yet.",
  destination_review: "At least one unit is weighing up whether it can take this patient.",
  accepted_awaiting_bed: "A unit has agreed in principle, but no bed has been pulled yet.",
  pulled: "A bed is being held for this patient, and the hold has a time limit.",
  handover_ready: "Bed and paperwork are ready; only the physical move is outstanding.",
  moving: "A vehicle has collected the patient and the move is under way.",
  arrived: "The patient has arrived — this leg of the journey is complete.",
};

export type JourneyStage = {
  id: MovementStage;
  label: string;
  blurb: string;
  /** Every movement at this stage, longest-waiting first (design lock §5.4) — except a movement
   *  whose legal detention authority is breached or running out, which sorts first regardless of
   *  wait. See `isExpiringLegalAuthority` below; that exception is what "outranks everything"
   *  means in the design lock and it is not scoped to the Delays screen alone. */
  movements: Movement[];
};

/**
 * "Is this movement's legal authority to be detained already breached, or about to run out" — the
 * one exception design lock §5.4 names as outranking wait order everywhere in this fold, not only
 * on the Delays screen. Mirrors the judgement `delayGroups` (`delays/delays-derivations.ts`) makes
 * for its own `legal_breached`/`legal_expiring` causes: "running out" reads as `clockState`
 * `"breached"` or `"critical"` (under an hour, or already past), and deliberately excludes `"due"`
 * (under three hours) for the same reason that file gives — a band wide enough to catch a third of
 * the fixture points nowhere. Written again here, rather than imported, because `delayGroups` does
 * not export this as its own predicate; kept to the identical two-state reading so the two screens
 * cannot silently start disagreeing about which patients are actually running out of time.
 *
 * A movement with no `legalForm.dueAt` at all (every Form 1A and 3B in this model) has no legal
 * clock to be running out, so it never qualifies — absence is not urgency.
 */
function isExpiringLegalAuthority(movement: Movement, now: Instant): boolean {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return false;
  const state = clockState(dueAt, now);
  return state === "breached" || state === "critical";
}

/** The shared ordering for both lists this file returns: an expiring legal authority first,
 *  regardless of anything else, then longest-waiting (earliest `openedAt`) first. */
function byUrgencyThenWait(a: Movement, b: Movement, now: Instant): number {
  const aUrgent = isExpiringLegalAuthority(a, now);
  const bUrgent = isExpiringLegalAuthority(b, now);
  if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
  return a.openedAt - b.openedAt;
}

/**
 * One entry per `MOVEMENT_STAGES` member, in that order, EMPTY GROUPS INCLUDED (design lock §5.2:
 * absence is stated, never blank — a stage with nobody in it is a fact a coordinator reads, unlike
 * the Delays screen's causes, where an empty cause is not a fact worth a row). `MOVEMENT_STAGES.map`
 * rather than filtering movements first is what guarantees every stage appears even at zero.
 *
 * No `isOpen` filter, deliberately: the board this replaces (`MovementsView`) never filtered by it
 * either — `stageSummaries` counts every movement regardless of closure, and a movement that closed
 * without proceeding still occupies whatever stage it reached, which is exactly what this board is
 * for showing. Introducing a filter the folded screen never had would be a behaviour change, not a
 * fold.
 *
 * Group headings count PEOPLE, not rows (§5.3): a `MovementStage` is a single field on `Movement`,
 * so a movement is at exactly one stage at once and `movements.length` on the returned group already
 * counts people — unlike the Delays screen, where one patient can carry several delay causes at
 * once and a naive per-cause count would double it.
 */
/**
 * 🔴 **WHY TWO TOTALS ON ONE PAGE DO NOT AGREE, STATED ON THE PAGE RATHER THAN LEFT TO ARITHMETIC.**
 *
 * The board reads "50 moves" at the top and "8 of 43 open moves" at the bottom. Both are correct —
 * the first counts every move, the second only the open ones — and **nothing accounted for the
 * seven between them.** Not false, and a careful reader can work it out; but two totals that do not
 * agree, with no explanation, is what makes somebody doubt a whole screen.
 *
 * Raised by Ward Builder Two as the second half of the `WF-008` report, and it survived the fix to
 * the row: the owner's ruling was about the ROW, and extending it to the counts would have been
 * deciding something he had not been asked. He was then asked, and approved a line derived from the
 * data (2026-09-05).
 *
 * ⚠️ **COMPUTED, NOT TYPED, AND THAT IS THE WHOLE POINT.** Every figure in the returned sentence
 * comes from the same array the totals come from, so the explanation cannot drift from the numbers
 * it explains. A hand-written "6 have arrived and 1 did not proceed" would be true today and become
 * a false statement the first time the seed changes, with nothing to notice —
 * exactly the class of defect this page has already produced once.
 */
export function totalsReconciliation(movements: Movement[]): string | undefined {
  const open = movements.filter(isOpen);
  const arrived = movements.filter((movement) => movement.stage === "arrived");
  const abandoned = movements.filter((movement) => movement.closure && movement.stage !== "arrived");
  const accounted = arrived.length + abandoned.length;

  // Nothing to explain when the totals agree. An explanation of a zero difference would be noise,
  // and worse, it would read as though something were missing.
  if (movements.length === open.length) return undefined;

  const parts: string[] = [];
  if (arrived.length > 0) parts.push(`${arrived.length} ${arrived.length === 1 ? "has" : "have"} arrived`);
  if (abandoned.length > 0) parts.push(`${abandoned.length} did not proceed`);

  return reconciliationSentence({
    total: movements.length,
    open: open.length,
    accounted,
    parts,
  });
}

/**
 * 🔴 **THE ARITHMETIC, SPLIT OUT SO ITS SAFETY BRANCH CAN ACTUALLY BE REACHED BY A TEST.**
 *
 * ⚠️ **THE BRANCH BELOW IS UNREACHABLE THROUGH `totalsReconciliation`, AND I HAD ITS RATIONALE
 * WRONG.** Ward Builder Two proved it exhaustively, and I re-ran the enumeration: across all 14
 * (stage × closure) combinations, every movement lands in **exactly one** of arrived / abandoned /
 * open — none in zero, none in two. So the three sets partition the space, `accounted` is
 * `total - open` by construction, and the comparison compared a quantity with itself.
 *
 * **My comment claimed it caught "a closed movement at a stage this function does not enumerate".
 * That cannot happen:** `abandoned` is `closure && stage !== "arrived"`, which enumerates no stages
 * at all and therefore catches every non-arrived stage that exists or ever will. A new stage cannot
 * escape it.
 *
 * ⚠️ **WHAT IT REALLY DEFENDS AGAINST IS A FUTURE EDIT TO `isOpen`.** If `isOpen` ever narrows —
 * excluding some further state — `open` shrinks, `total - open` grows past `arrived + abandoned`,
 * and this branch fires correctly rather than printing a sentence that explains less than it
 * appears to. **The code was right and the reason beside it was wrong**, which is the combination
 * that stops the next person re-deriving either.
 *
 * **AND THAT IS WHY THE ARITHMETIC IS A SEPARATE FUNCTION.** A safeguard no test can exercise is
 * indistinguishable from one that does not work, and would not be missed if a refactor deleted it.
 * Taking the four counts as plain numbers makes the imbalance directly constructible — no injected
 * predicates, no fixture gymnastics, two lines of test.
 */
export function reconciliationSentence({
  total,
  open,
  accounted,
  parts,
}: {
  total: number;
  open: number;
  accounted: number;
  parts: readonly string[];
}): string {
  const unexplained = total - open;
  if (accounted !== unexplained) {
    return `${total} moves in all and ${open} still open. The difference is not fully accounted for here — ${accounted} of ${unexplained} explained.`;
  }
  return `${total} moves in all, ${open} still open — ${parts.join(" and ")}.`;
}

export function journeyStages(movements: Movement[], now: Instant): JourneyStage[] {
  return MOVEMENT_STAGES.map((id) => ({
    id,
    label: stageCopy[id].label,
    blurb: STAGE_BLURBS[id],
    movements: movements.filter((movement) => movement.stage === id).sort((a, b) => byUrgencyThenWait(a, b, now)),
  }));
}

/**
 * The transport states a leg on THIS screen can actually be in.
 *
 * ⚠️ **DERIVED FROM `transportLeg`'s OWN UNION (`ward-derivations.ts`), NEVER RE-SPELLED HERE.**
 * Until Ward Lead's ruling of 2026-09-05 this module carried a SECOND type also called
 * `TransportLeg` — a row object whose `state` was a hand-written four-value shape
 * (`booked | en_route | arrived | cancelled`) — plus a private `collapsedTransportState` that
 * re-implemented `transportLeg`'s precedence chain to produce it. Its comment said the order of
 * the checks was "copied exactly so the two functions can never disagree", and that is precisely
 * the guarantee a copy cannot give: nothing failed if one was edited and the other was not. A
 * stamp added to `TransportJob` would have been honoured by one screen and ignored by the other,
 * and two boards would have disagreed about where a patient's vehicle had got to, in silence.
 *
 * ⚠️ **`"Requested"` IS EXCLUDED BECAUSE THIS SCREEN CANNOT PRODUCE IT, not because it is
 * uninteresting.** `transportLegs` below drops every job with no `acceptedAt`, so a job still at
 * `"Requested"` never reaches a row here. Leaving it in would put a permanently-empty `Requested`
 * bucket in `transportCounts`, and `WardBar` names every segment INCLUDING the zeroes in its
 * `aria-label` — so a screen-reader user would be read out a category this module has no way of
 * ever filling. That is a different thing from `Cancelled` and `En route`, which are legitimately
 * zero in today's fixture but which the reducer can genuinely produce (`CANCEL_TRANSPORT`,
 * `TRANSPORT_EN_ROUTE`).
 *
 * `Exclude` rather than a re-spelt list, so the compiler is the catcher: add a sixth leg to
 * `transportLeg`'s union and the three `Record` literals over this type — here, and
 * `LEG_STATE_LABEL`/`LEG_STATE_LEVEL` in `movements-screen.tsx` — stop compiling until somebody
 * decides where it belongs and what it is called on screen.
 */
export type MovementLegState = Exclude<TransportLeg, "Requested"> | "Cancelled";

export type TransportLegRow = {
  movement: Movement;
  state: MovementLegState;
  provider: string;
  bookedAt: Instant;
  minutesSinceBooked: number;
};

/**
 * Only movements that actually carry a transport record AND that a provider has actually accepted.
 *
 * ⚠️ **THOSE ARE TWO DIFFERENT FACTS, AND THE SECOND IS WHAT "BOOKED" MEANS.** `tracker-derivations.ts`
 * records the real gap this leans on: `BOOK_TRANSPORT` (`ward-flow-reducer.ts`) can create a
 * `TransportJob` carrying no timestamp at all — `{ id, provider, escortRequired }` and nothing
 * else — so "a transport record exists" does not mean "somebody booked it". `bookedAt` on this
 * type is `Instant`, not optional, and there is no honest instant to put there for a job nobody has
 * accepted yet. Rather than fabricate one (or silently reuse the movement's own `openedAt`, which
 * would answer a different question while reading as plausible — the same substitution
 * `elapsedLabel`'s own callers are warned against), a job still sitting at "Requested" is left out
 * of this list entirely.
 *
 * ⚠️ **`bookedAt === undefined` AND `state === "Requested"` ARE NOT THE SAME TEST, WHICH IS WHY BOTH
 * ARE WRITTEN OUT.** They agree on the ordinary case and diverge on one the reducer can genuinely
 * reach: `BOOK_TRANSPORT` writes no timestamps, and `CANCEL_TRANSPORT` requires no `acceptedAt` —
 * it refuses only a closed movement, an already-cancelled job, an arrived one and a collected one.
 * So a job booked and then cancelled before anyone accepted it carries `cancelledAt` and no
 * `acceptedAt`, and `transportLeg` reports it as `"Cancelled"`, not `"Requested"`. **The
 * `bookedAt` check is the one that excludes it**; the `"Requested"` check would let it through, and
 * there is still no honest instant to put in `bookedAt` for it. Pinned by its own test rather than
 * left to this paragraph.
 *
 * The `"Requested"` check earns its place the other way round: it is what narrows
 * `transportLeg`'s return to `MovementLegState`, so removing it does not change behaviour — it
 * stops the file compiling. The type checker is that clause's test, and it is the reason the row
 * type can promise a non-optional `bookedAt` at all.
 *
 * Today's fixture never exercises either exclusion: every hand-authored and generated transport job
 * in `ward-movements.ts` already carries an `acceptedAt`, so nothing is silently dropped from the
 * current screen — but a live session that books a job through the reducer and has not yet had it
 * accepted will correctly show nothing here for that patient until it is, rather than a row with a
 * fabricated "booked just now".
 *
 * No `isOpen` filter: `LiveTracker`, the screen this replaces, applied one, but this function takes
 * whichever `movements` list the caller passes (open or not) so the merged screen can decide that
 * for itself rather than have the choice buried in this derivation — the same shape `bedKindGaps`
 * uses, where the open/closed filter lives at the call site.
 *
 * Sorted the same way as `journeyStages`: an expiring legal authority first, then longest since
 * booked. These are the same patients as the stage strip above, and a coordinator reading both
 * should never see one order on one panel and a different order on the other for the same person.
 */
export function transportLegs(movements: Movement[], now: Instant): TransportLegRow[] {
  const legs: TransportLegRow[] = [];
  for (const movement of movements) {
    const transport = movement.transport;
    const bookedAt = transport?.acceptedAt;
    const state = transportLeg(transport);
    if (transport === undefined || bookedAt === undefined || state === undefined || state === "Requested") continue;
    legs.push({
      movement,
      state,
      provider: transport.provider,
      bookedAt,
      minutesSinceBooked: now - bookedAt,
    });
  }
  return legs.sort((a, b) => byUrgencyThenWait(a.movement, b.movement, now));
}

/**
 * A tally over exactly the legs passed in — never recomputed from `movements` independently, so it
 * can never disagree with the list sitting beside it on screen. Every state `MovementLegState`
 * admits is always present, at zero if nothing is in it: `legs` is a list this module already built
 * in full, not a feed that might be sampled or partial, so `0` here is a real count rather than the
 * fabricated-zero case `networkWardRows.freeing` guards against — there is nothing left this
 * function could fail to know.
 *
 * The keys ARE the canonical leg names, so this record cannot drift from `transportLeg`'s
 * vocabulary; what a coordinator READS for each one is decided once, in `movements-screen.tsx`.
 */
export function transportCounts(legs: TransportLegRow[]): Record<MovementLegState, number> {
  const counts: Record<MovementLegState, number> = {
    Accepted: 0,
    "En route": 0,
    Collected: 0,
    Arrived: 0,
    Cancelled: 0,
  };
  for (const leg of legs) counts[leg.state] += 1;
  return counts;
}

/**
 * One row per (origin ED, accepted unit, stage) combination that at least one OPEN movement is
 * actually in — a corridor's live load, not its history. A corridor is exactly what
 * `Movement.originEdId` and `Movement.acceptedUnitId` already say: the ED a patient physically
 * started at, and the unit that has accepted them. Nothing here computes, infers or checks a
 * catchment/home-area relationship between the two — that would be reading a fact into the record
 * that is not there, and the model deliberately holds no such field.
 *
 * ⚠️ **FILTERED TO `isOpen`, AND THAT IS THE ONLY FILTER.** An arrived or otherwise closed movement
 * is no longer travelling this corridor — counting it would report load a coordinator cannot act
 * on, the same distinction `transportLegs`' sibling `isOpen`-at-the-call-site pattern makes
 * elsewhere in this fold. No timestamp is read anywhere below: a corridor's load is a fact about
 * where movements currently sit, not about when they got there, so nothing here can go stale
 * between one render and the next the way a `now`-dependent figure could.
 *
 * ⚠️ **A MOVEMENT WITHOUT `acceptedUnitId` FORMS NO CORRIDOR, AND THAT IS STRUCTURAL, NOT A
 * FILTER.** `CorridorCount.acceptedUnitId` is a real string, because a corridor is origin-to-
 * destination and a movement still awaiting acceptance has no destination yet — there is no
 * dropped row here to mark absent, because there is no corridor for it to be a row of. It is still
 * counted everywhere else this fold already accounts for it (`journeyStages`, `totalsReconciliation`);
 * this function only answers "how many, on which corridor, at which stage", not "how many
 * movements exist".
 *
 * **An empty corridor is absent, never a row of zero**: a (origin, destination, stage) triple with
 * no open movement in it produces no entry at all, because nothing here enumerates every possible
 * triple up front — each row is built only when a real movement puts something in it.
 */
export type CorridorCount = {
  originEdId: string;
  acceptedUnitId: string;
  stage: MovementStage;
  count: number;
};

export function corridorCounts(movements: Movement[]): CorridorCount[] {
  const rows = new Map<string, CorridorCount>();
  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const acceptedUnitId = movement.acceptedUnitId;
    if (acceptedUnitId === undefined) continue;

    const key = `${movement.originEdId} ${acceptedUnitId} ${movement.stage}`;
    const existing = rows.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      rows.set(key, { originEdId: movement.originEdId, acceptedUnitId, stage: movement.stage, count: 1 });
    }
  }
  return Array.from(rows.values());
}

export type RefusedCorridorCount = {
  originEdId: string;
  unitId: string;
  count: number;
  reasons: DeclineReason[];
};

/**
 * Same-day refusals grouped by the origin and the ward that declined. These rows deliberately do
 * not carry a journey stage: a decline records no stage of its own, and borrowing the movement's
 * later stage would make a historical refusal look current. The timestamp and controlled reason
 * come directly from each `Decline` record.
 */
export function refusedCorridorCounts(movements: Movement[], now: Instant): RefusedCorridorCount[] {
  const rows = new Map<string, RefusedCorridorCount>();
  for (const movement of movements) {
    for (const decline of movement.declines) {
      if (decline.at > now || dayOf(decline.at) !== dayOf(now)) continue;
      const key = `${movement.originEdId} ${decline.unitId}`;
      const existing = rows.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.reasons.includes(decline.reason)) existing.reasons.push(decline.reason);
      } else {
        rows.set(key, {
          originEdId: movement.originEdId,
          unitId: decline.unitId,
          count: 1,
          reasons: [decline.reason],
        });
      }
    }
  }
  return Array.from(rows.values()).sort(
    (a, b) => b.count - a.count || a.originEdId.localeCompare(b.originEdId) || a.unitId.localeCompare(b.unitId),
  );
}

/**
 * **How long a movement has waited, in minutes — and the two arms are NOT the same measurement.**
 *
 * 🔴 **A CLOSED MOVEMENT'S WAIT STOPPED WHEN IT CLOSED.** Measuring it as `now - openedAt` would
 * keep a finished wait growing for the rest of the day and put a movement that ended in twenty
 * minutes at the top of a "longest waiting" order by the evening. **The screen already makes this
 * distinction visually** — `StageRow` renders a frozen clock reading *"in journey before it ended"*
 * for a closed movement and a running one for an open movement — **and an ordering that ignored it
 * would sort rows by a number the row beside it contradicts.**
 *
 * ⚠️ **THIS IS NOT A NEW CLINICAL CONCEPT AND MUST NOT BECOME ONE.** It is the elapsed time the row
 * already shows, expressed as a number so a list can be ordered by it. It introduces no threshold,
 * no banding and no judgement about whether a wait is too long.
 *
 * **Openness is read through `isOpen` rather than by testing `closure` here**, so this cannot drift
 * from the definition every other population on both screens uses.
 */
export function waitedMinutes(movement: Movement, now: Instant): number {
  return (isOpen(movement) ? now : (movement.closure?.at ?? now)) - movement.openedAt;
}

/**
 * The same movements, ordered longest wait first. **A stable order, and deliberately total:** ties
 * break on `id` so two movements opened in the same minute do not swap places between renders —
 * a list that reorders itself under an unchanged state is unreadable, and on this screen the state
 * changes every time the clock advances.
 *
 * ⚠️ **It does not filter.** The region this orders carries all fifty movements with the closed ones
 * marked (owner ruling, 2026-09-05, "MARK IT, DO NOT FILTER IT"), so an ordering that quietly
 * dropped the closed rows would reverse that ruling through the back door.
 *
 * 🔴 **AN EXPIRING LEGAL AUTHORITY OUTRANKS THE WAIT, AND IT IS NOT A FLOURISH — IT IS THE SAME
 * PRECEDENCE `journeyStages` ALREADY APPLIES** through `byUrgencyThenWait`. The first version of
 * this function omitted it, and the screen's footer sentence — *"an expiring legal authority
 * outranks every order above"* — would then have been TRUE under the stage order and FALSE under
 * this one, on the same screen, with the reader given no way to tell which order they were looking
 * at. **One sentence covering two orderings is only honest if both honour it.**
 */
export function byLongestWait(movements: Movement[], now: Instant): Movement[] {
  return [...movements].sort(
    (a, b) =>
      Number(isExpiringLegalAuthority(b, now)) - Number(isExpiringLegalAuthority(a, now)) ||
      waitedMinutes(b, now) - waitedMinutes(a, now) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 48-HOUR BED MOVEMENT HORIZON DERIVATIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **REWRITTEN 2026-09-16 — THE PREVIOUS VERSION WAS A HAND-TYPED FICTION, NOT A DERIVATION.**
 * It built the chart from a literal `lanes` array — invented ambulance-service and air-retrieval
 * carrier names, invented bed numbers, invented ETAs, and a leave-of-absence category keyed to an
 * unregistered legal form code this model has never held any data for (not one of `1A`, `3B`,
 * `3D`, `4A` or `4C` in `ward-legal-forms.ts`'s `SELECTABLE_LEGAL_FORMS`) — keyed to real seed ids
 * and only patched afterwards by a "sync" step that could turn an ARRIVED movement into a rendered
 * DISCHARGE.
 * WF-001 (a placement request still sitting at Armadale ED, `ward-movements.ts`) was charted as
 * an RPH→Community discharge; WF-014 (in transit FSH ED→Ward 2K) was charted as Albany.
 *
 * ✅ **Every lane and every event below is read from the live `movements`/`units` it is given.**
 * There is no second, parallel account of what is moving where.
 *
 * **What a lane is.** One lane per receiving unit that at least one open movement has actually
 * been accepted into (`movement.acceptedUnitId`) — the same corridor identity `corridorCounts`
 * above already uses, so this chart cannot disagree with the corridor rail beside it about which
 * unit a movement is headed for. A movement with no accepted unit yet (`placement_requested`,
 * `destination_review`) has no destination to put a bar on, so it forms no lane and no event —
 * structural, not a filter, the same reasoning `corridorCounts`' own comment gives for
 * `acceptedUnitId`.
 *
 * **Why closed movements never appear.** `isOpen` excludes `stage === "arrived"` unconditionally
 * (`ward-derivations.ts`), so an arrived movement cannot reach this chart at all — which is what
 * actually fixes "arrival rendered as discharge": there is no discharge concept here for it to be
 * miscoded into. A horizon is a forward look at what is still travelling; an arrival is finished
 * travelling. Filtered inside this function, not by the caller — `movements-screen.tsx` passes the
 * full list, and `corridorCounts` right above already filters `isOpen` the same way for the same
 * reason.
 *
 * **What an event's timing is allowed to say.** This model holds no predicted arrival time, no
 * discharge date and no leave-of-absence record for any movement — searched, not assumed; see
 * `Movement`/`TransportJob` in `ward-model.ts`. The one real FUTURE instant this model does hold
 * for bed flow is `pullExpiresAt`, the deadline on a held bed. So an event bar spans from now to
 * that deadline only when the movement is `pulled` and the deadline has not yet passed; every
 * other event — including one already in transit — is rendered as a zero-width marker at "now",
 * because that is the most that can honestly be said about when it will resolve. Nothing here
 * invents a transit duration, an ETA or a discharge horizon.
 *
 * **What an event's type says.** `"transit"` for `moving` (the transport is actually under way).
 * `"delay"` only when a bed hold has actually lapsed — `pulled` with a past `pullExpiresAt` — the
 * same real fact `delayGroups`' `bed_pull_expired` cause reads elsewhere in this application, not
 * an invented "Hold (Bed Block)" story. Every other accepted-but-not-yet-moving stage
 * (`accepted_awaiting_bed`, `pulled` not yet expired, `handover_ready`) reads `"admit"` — working
 * toward being admitted to the unit that accepted it.
 *
 * **What is deliberately absent.** No carrier text unless `movement.transport?.provider` actually
 * exists. No bed number — this model carries no bed identifier on `Movement` at all, so the type
 * no longer carries a field for one rather than filling it with a fabricated string. No
 * unregistered legal-form leave-of-absence lane, no predicted-discharge lane, no Mental Health Act
 * deadline rendered as a movement time (a form's `dueAt` answers a different question — how long
 * the LEGAL authority to detain has left, not when the bed move itself resolves — so it is never
 * read here).
 */

/** The six states an event on this chart can honestly be in across the 48-hour bed horizon */
export type MovementHorizonEventType = "admit" | "transit" | "leave" | "disch" | "pred" | "delay";

export type MovementHorizonEvent = {
  id: MovementId;
  type: MovementHorizonEventType;
  startH: number;
  durH: number;
  origin: string;
  dest: string;
  /** `""` when the movement carries no transport — never a placeholder carrier name. */
  carrier: string;
  bed?: string;
  title: string;
  patientName?: string;
  ageBand?: string;
};

export type MovementHorizonLane = {
  id: string;
  name: string;
  /** `undefined` only if `unitId` resolves to no unit in `units` — this application's ordinary
   *  "cannot resolve" case (`wardLabel`), never a fabricated fourth service. */
  service: HealthService | undefined;
  events: MovementHorizonEvent[];
};

/** Same display title `delayGroups`' `bed_pull_expired` cause already uses
 *  (`delays/delays-derivations.ts`) for exactly this fact — a held bed whose reserved time has
 *  passed. Reused rather than re-worded, so this chart cannot describe the same fact differently. */
const BED_PULL_EXPIRED_TITLE = "Reserved time has passed, bed still held";

function horizonEventType(movement: Movement, now: Instant): MovementHorizonEventType {
  if (movement.stage === "moving") return "transit";
  if (movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt <= now) {
    return "delay";
  }
  return "admit";
}

/** Zero duration for every event except a live bed hold with real time left on it — see the
 *  module doc's "What an event's timing is allowed to say". The gantt already floors a bar's
 *  rendered width (`Math.max(..., 3.2)` in `movement-horizon-gantt.tsx`), so a zero-width event
 *  still paints as a visible marker rather than vanishing. */
function horizonEventTiming(movement: Movement, now: Instant): { startH: number; durH: number } {
  // A planned move time (`Movement.plannedMoveAt`) places the bar at that time; a plan already
  // passed stays at now rather than drawing into the past.
  if (movement.plannedMoveAt !== undefined && movement.stage !== "moving") {
    return { startH: Math.max(0, (movement.plannedMoveAt - now) / 60), durH: 0 };
  }
  if (movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt > now) {
    return { startH: 0, durH: (movement.pullExpiresAt - now) / 60 };
  }
  return { startH: 0, durH: 0 };
}

function horizonEvent(
  movement: Movement,
  destName: string,
  now: Instant,
  people?: HorizonPeople,
): MovementHorizonEvent {
  const type = horizonEventType(movement, now);
  const { startH, durH } = horizonEventTiming(movement, now);
  const ed = edById(movement.originEdId);
  return {
    id: movement.id,
    type,
    startH,
    durH,
    origin: departmentLabel(movement.originEdId, ed?.name),
    dest: destName,
    carrier: movement.transport?.provider ?? "",
    title: horizonEventTitle(movement, type, now),
    // Owner, 26 Sept 2026: bars carry the patient's name, not the WF journey number. Resolved only
    // through the linked patient; an unlinked move reads the resolver's own "Unknown Patient".
    patientName: people ? resolveSubjectPatient(movement, people).displayName : undefined,
  };
}

function horizonEventTitle(movement: Movement, type: MovementHorizonEventType, now: Instant): string {
  if (type === "delay") return BED_PULL_EXPIRED_TITLE;
  const stage = stageCopy[movement.stage].label;
  if (movement.plannedMoveAt === undefined || movement.stage === "moving") return stage;
  return `${stage} · planned ${formatInstantWithDay(movement.plannedMoveAt, now)}`;
}

/** What `deriveMovementHorizonLanes` needs to put a patient's name on each bar. */
export interface HorizonPeople {
  patients: readonly Patient[];
  referrals: readonly Referral[];
  movements: readonly Movement[];
}

export interface DeriveHorizonOptions {
  includeProjections?: boolean;
  /** When given, each bar is labelled with the linked patient's name. */
  people?: HorizonPeople;
}

export function deriveMovementHorizonLanes(
  movements: Movement[],
  units: Unit[],
  now: Instant,
  options?: DeriveHorizonOptions,
): MovementHorizonLane[] {
  const lanesByUnitId = new Map<string, MovementHorizonLane>();

  for (const movement of movements) {
    if (!isOpen(movement)) continue;
    const unitId = movement.acceptedUnitId;
    if (unitId === undefined) continue;

    let lane = lanesByUnitId.get(unitId);
    if (!lane) {
      const unit = units.find((candidate) => candidate.id === unitId);
      lane = {
        id: unitId,
        name: wardLabel(unitId, unit?.name),
        service: unit ? siteByCode(unit.siteCode)?.service : undefined,
        events: [],
      };
      lanesByUnitId.set(unitId, lane);
    }

    lane.events.push(horizonEvent(movement, lane.name, now, options?.people));
  }

  // Busiest lane first, so the coordinator sees the most-loaded receiving unit at the top; ties
  // break on name for a stable render (the same reason `byLongestWait` breaks ties on `id`).
  return Array.from(lanesByUnitId.values()).sort(
    (a, b) => b.events.length - a.events.length || a.name.localeCompare(b.name),
  );
}

