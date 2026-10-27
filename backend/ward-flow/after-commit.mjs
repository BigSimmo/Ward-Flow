// @ts-check
/**
 * P011 (Josh, Oct 27 2026, 9:41 PM and 10:12 PM AWST): work that need not hold the workspace lock
 * runs after the save commits, and per-step timings are logged without any patient data.
 */

/** Step names a command's timing log may carry; nothing else is ever logged with it. */
export const TIMING_STEPS = Object.freeze([
  "lock",
  "apply",
  "archive",
  "save",
  "push",
  "commit",
  "deliver",
  "archiveAfter",
]);

/**
 * A stopwatch for one command. `fields()` returns whole milliseconds per step, the action name
 * (a command type such as "CONFIRM_CAPACITY") and the HTTP status only: never a patient, bed,
 * record id, actor or payload.
 * @param {() => number} [now]
 */
export function commandTimer(now = () => performance.now()) {
  const started = now();
  let mark = started;
  /** @type {Record<string, number>} */
  const steps = {};
  return {
    /** @param {string} step */
    lap(step) {
      if (!TIMING_STEPS.includes(step)) return;
      const at = now();
      steps[step] = (steps[step] ?? 0) + Math.max(0, Math.round(at - mark));
      mark = at;
    },
    /** Restart the lap clock without counting the time since the last lap. */
    skip() {
      mark = now();
    },
    /**
     * @param {unknown} action
     * @param {unknown} status
     */
    fields(action, status) {
      return {
        event: "ward_backend_command_timing",
        action: typeof action === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(action) ? action : "unknown",
        status: Number.isSafeInteger(status) ? status : 0,
        totalMs: Math.max(0, Math.round(now() - started)),
        ...Object.fromEntries(TIMING_STEPS.filter((step) => step in steps).map((step) => [`${step}Ms`, steps[step]])),
      };
    },
  };
}

/**
 * Closed records leave the live workspace in their own short transaction after the save that
 * found them due has committed (P011 slice B, archiving half). It never throws: a failure is
 * logged and the committed save stands; the archive simply runs on the next eligible save. It
 * moves nothing when another save has landed since, for the same reason.
 * @param {{
 *   due: { revision: number } | null,
 *   run: (expectedRevision: number) => Promise<boolean>,
 *   log: (fields: Record<string, unknown>) => void,
 *   errorFields: (error: unknown) => Record<string, unknown>,
 * }} options
 * @returns {Promise<"none" | "archived" | "skipped" | "failed">}
 */
export async function archiveAfterCommit({ due, run, log, errorFields }) {
  if (!due) return "none";
  try {
    return (await run(due.revision)) ? "archived" : "skipped";
  } catch (error) {
    log({ event: "ward_backend_archive_after_commit_failure", ...errorFields(error) });
    return "failed";
  }
}
