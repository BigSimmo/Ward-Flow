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
