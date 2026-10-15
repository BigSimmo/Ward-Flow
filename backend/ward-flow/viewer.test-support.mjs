/** The statewide coordinator view a bootstrap account gets from `store.viewer()`. */
export const STATEWIDE_VIEW = Object.freeze({
  status: "ok",
  version: 8,
  membershipId: null,
  access: { role: "coordinator", scope: { kind: "statewide" } },
  grants: [],
  recentGrant: false,
});

/**
 * A fake store's `viewer()`: accounts named in WARD_COORDINATOR_USER_IDS work as the statewide
 * coordinator, and nobody else holds a role.
 */
export async function bootstrapViewer(actorId, { bootstrap = false } = {}) {
  return bootstrap ? { ...STATEWIDE_VIEW, actorId } : { status: "none" };
}
