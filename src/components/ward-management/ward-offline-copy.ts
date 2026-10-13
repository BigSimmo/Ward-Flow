/*
 * Server-safe copy (no "use client"): the ward layout, a Server Component, passes this to the toast
 * provider, and client screens read the same words.
 */

/** A1-18 / A2-21 / A3-22 (audit 13 Oct 2026): what an action recorded while offline adds to its toast. */
export const WARD_OFFLINE_SAVED_NOTE = "Saved on this device. Not sent while offline.";
