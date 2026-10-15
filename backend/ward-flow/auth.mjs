/**
 * Shared by every sign-in adapter: the identity provider could not be reached or answered
 * unexpectedly. Callers report 503 for this and 401 for any other authentication failure.
 */
export class VerifierUnavailableError extends Error {}
