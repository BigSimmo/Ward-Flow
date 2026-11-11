// @ts-check
// D-80 item 14 and M58: which break glass openings and covers given a coordinator may review,
// worked out per read or locked transaction for the workspace store (postgres.mjs).
import { ACCESS_COVER_MIGRATION, ROLE_ACCESS_MIGRATION } from "./migrations.mjs";
import { canonical } from "./workspace-shared.mjs";

/** A break glass opening's review id (`ward-break-glass-review-id.ts`) and the scope refusal. */
const BREAK_GLASS_REVIEW_PREFIX = "audit-break-glass-";
/** M58 (D-129): a cover given's review id names its ACCESS_COVER audit row. */
const COVER_REVIEW_PREFIX = "audit-cover-";
const OUTSIDE_PLACE = "This change names a record outside your role's place.";

export function createReviewAuthority({ pool, workspaceId, engine, readWorld }) {
  /**
   * D-80 item 14: the patient and journey ids in this desk's own part of the workspace, which are
   * the records whose openings it may review. `null` for the statewide coordinator: every record.
   * A break glass grant of the coordinator's own never widens it.
   */
  async function recordsInPlace(view, at) {
    if (engine.wholeNetwork(view.access)) return null;
    const stored = await readWorld(pool, "payload");
    if (!stored || !engine.validWorld(stored.payload)) return [];
    return placeRecords(stored.payload, view.access, at);
  }
  /** The ids `recordsInPlace` lists, from a world already in hand. */
  function placeRecords(world, access, at) {
    const { state } = engine.scopeWorld(world, access, at, []);
    const ids = [
      ...state.patients.map((patient) => patient.id),
      ...state.movements.flatMap((movement) => [movement.id, movement.patientId]),
      ...state.referrals.map((referral) => referral.patientId),
    ];
    return [...new Set(ids.filter((id) => typeof id === "string"))];
  }
  /**
   * D-80 item 14: a review mark on a break glass opening names an opening the workspace does not
   * hold, so the engine's scope check cannot look it up. Here the opening must exist in this
   * workspace and, below statewide, be of a record in the coordinator's own part of the workspace
   * (the same rule as reading the openings). Anything else is refused as outside the role's place.
   */
  function openingEventFor(world, event) {
    if (event?.type === "REVIEW_AUDIT_EVENT") return event.eventId;
    if (event?.type !== "UNDO_AUDIT_REVIEW" || typeof event.reviewId !== "string") return null;
    const reviews = world.state.auditReviews.filter((review) => review.id === event.reviewId);
    return reviews.length === 1 ? reviews[0].eventId : null;
  }
  const openingId = (eventId) => {
    if (typeof eventId !== "string" || !eventId.startsWith(BREAK_GLASS_REVIEW_PREFIX)) return null;
    const id = eventId.slice(BREAK_GLASS_REVIEW_PREFIX.length);
    return /^[1-9][0-9]{0,17}$/.test(id) ? id : null;
  };
  const coverId = (eventId) => {
    if (typeof eventId !== "string" || !eventId.startsWith(COVER_REVIEW_PREFIX)) return null;
    const id = eventId.slice(COVER_REVIEW_PREFIX.length);
    return /^[1-9][0-9]{0,17}$/.test(id) ? id : null;
  };
  // A caller cannot supply this authority through a view or command. Each row belongs to one
  // read/locked transaction; only the committed scoped reply parts survive that request.
  const reviewAuthorities = new WeakMap();
  async function prepareReviewAuthority(connection, row, view, event = null) {
    if (view?.access?.role !== "coordinator") return;
    const eventIds = engine.wholeNetwork(view.access)
      ? []
      : row.payload.state.auditReviews.map((review) => review.eventId);
    eventIds.push(openingEventFor(row.payload, event));
    const ids = [...new Set(eventIds.map(openingId).filter((id) => id !== null))];
    const openings = new Map();
    if (ids.length && view.version >= ROLE_ACCESS_MIGRATION) {
      const { rows } = await connection.query(
        "SELECT id::text AS id, patient_id FROM ward_flow.break_glass WHERE workspace_id=$1 AND data_mode='prototype' AND id = ANY($2::bigint[])",
        [workspaceId, ids],
      );
      for (const opening of rows) openings.set(String(opening.id), opening.patient_id);
    }
    // M58: a cover given is reviewed by its ACCESS_COVER audit row, inside the coordinator's place.
    const coverIds = [...new Set(eventIds.map(coverId).filter((id) => id !== null))];
    const covers = new Map();
    if (coverIds.length && view.version >= ACCESS_COVER_MIGRATION) {
      const { rows } = await connection.query(
        "SELECT sequence::text AS id, changes->>'role' AS role, changes->'scope' AS scope FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype' AND action='ACCESS_COVER' AND outcome='accepted' AND sequence = ANY($2::bigint[])",
        [workspaceId, coverIds],
      );
      for (const cover of rows) {
        const access = engine.parseAccess(cover.role, cover.scope);
        if (access) covers.set(String(cover.id), access.scope);
      }
    }
    reviewAuthorities.set(row, { openings, covers, scopes: new WeakMap() });
  }
  function reviewIdsFor(row, world, view, at) {
    if (view?.access?.role !== "coordinator" || engine.wholeNetwork(view.access)) return [];
    const authority = reviewAuthorities.get(row);
    if (!authority?.openings.size && !authority?.covers.size) return [];
    const scopeKey = JSON.stringify(canonical(view.access));
    const now = engine.worldNow(world, at);
    const cached = authority.scopes.get(world);
    if (cached?.scopeKey === scopeKey && cached.now === now) return cached.ids;
    // Grants never widen governance review authority. Re-evaluate the same opening map against
    // the actual world being projected, including an accepted command's resulting world.
    const own = new Set(placeRecords(world, view.access, at));
    const ids = [
      ...[...authority.openings]
        .filter(([, patientId]) => own.has(patientId))
        .map(([id]) => `${BREAK_GLASS_REVIEW_PREFIX}${id}`),
      ...[...authority.covers]
        .filter(([, scope]) => engine.scopeWithin(world, scope, view.access.scope))
        .map(([id]) => `${COVER_REVIEW_PREFIX}${id}`),
    ].sort();
    authority.scopes.set(world, { scopeKey, now, ids });
    return ids;
  }
  function breakGlassReviewRefusal(row, view, event, at) {
    const eventId = openingEventFor(row.payload, event);
    if (typeof eventId !== "string") return null;
    if (eventId.startsWith(COVER_REVIEW_PREFIX)) {
      const id = coverId(eventId);
      if (!id || !(view.version >= ACCESS_COVER_MIGRATION) || !reviewAuthorities.get(row)?.covers.has(id))
        return OUTSIDE_PLACE;
    } else if (!eventId.startsWith(BREAK_GLASS_REVIEW_PREFIX)) return null;
    else {
      const id = openingId(eventId);
      if (!id || !(view.version >= ROLE_ACCESS_MIGRATION) || !reviewAuthorities.get(row)?.openings.has(id))
        return OUTSIDE_PLACE;
    }
    if (engine.wholeNetwork(view.access)) return null;
    return reviewIdsFor(row, row.payload, view, at).includes(eventId) ? null : OUTSIDE_PLACE;
  }
  return { recordsInPlace, prepareReviewAuthority, reviewIdsFor, breakGlassReviewRefusal };
}
