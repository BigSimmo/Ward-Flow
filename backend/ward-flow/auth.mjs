// @ts-check
/**
 * Shared by every sign-in adapter: the identity provider could not be reached or answered
 * unexpectedly. Callers report 503 for this and 401 for any other authentication failure.
 */
export class VerifierUnavailableError extends Error {}

/**
 * Too many sign-in checks from one client address (or in total) needed the identity provider.
 * A kind of VerifierUnavailableError, so a caller that knows only that still answers 503; the
 * shared API answers 429 with Retry-After.
 */
export class VerifierRateLimitedError extends VerifierUnavailableError {}

/**
 * The bootstrap coordinators (WARD_COORDINATOR_USER_IDS) at `at`: none once their end date
 * (WARD_COORDINATOR_UNTIL) has passed, so they stop working without a restart (H-0057).
 * @param {{ coordinatorIds?: string[], coordinatorUntil?: number | null }} config
 * @returns {string[]}
 */
export function bootstrapCoordinators(config, at = Date.now()) {
  const until = config.coordinatorUntil;
  return typeof until === "number" && Number.isFinite(until) && at >= until ? [] : (config.coordinatorIds ?? []);
}
