/**
 * H-0731 (Josh, 27 Oct 2026): the parts of a patient's record that no list, board or drawer shows.
 * Every desk's board is sent without them, so a desk only holds them for a record the server has
 * logged it opening (`logView`). Kept in step with `src/components/ward-management/ward-shared-record-detail.ts`.
 */
export const RECORD_DETAIL_FIELDS = Object.freeze(["address", "interpreterLanguage"]);

/**
 * The world as a desk is sent it: the same object when no patient holds a detail field, otherwise
 * a copy whose patients leave them out. The world passed in is shared and never changed.
 * @template {{ state: { patients: any[] } }} W
 * @param {W} world
 * @returns {W}
 */
export function withoutRecordDetail(world) {
  const patients = world?.state?.patients;
  if (!Array.isArray(patients) || !patients.some(holdsDetail)) return world;
  return {
    ...world,
    state: {
      ...world.state,
      patients: patients.map((patient) => {
        if (!holdsDetail(patient)) return patient;
        const sent = { ...patient };
        for (const field of RECORD_DETAIL_FIELDS) delete sent[field];
        return sent;
      }),
    },
  };
}

/** The longest detail field the app takes (`parseRecordDetail`); a longer one is left out. */
const DETAIL_MAX_LENGTH = 500;

/**
 * One patient's detail fields, as recorded. Empty when none is recorded.
 * @param {any} patient
 * @returns {Record<string, string>}
 */
export function recordDetailOf(patient) {
  /** @type {Record<string, string>} */
  const detail = {};
  for (const field of RECORD_DETAIL_FIELDS) {
    const value = patient?.[field];
    if (typeof value === "string" && value.length <= DETAIL_MAX_LENGTH) detail[field] = value;
  }
  return detail;
}

/** @param {any} patient */
function holdsDetail(patient) {
  return !!patient && RECORD_DETAIL_FIELDS.some((field) => patient[field] !== undefined);
}
