/** What the record-access route returns to a coordinator (D-80 item 14), split from ward-shared-client.ts. */
/** One record opening from the server's access log. `minutes` is when, from the server's now. */
export type SharedRecordView = {
  id: number | string;
  actor_id: string;
  actor_role: string;
  actor_scope: unknown;
  patient_id: string;
  surface: string;
  minutes?: number | null;
};
/**
 * D-80 item 14: a break glass opening, as the server lists it for a
 * coordinator. Times are minutes from the server's now.
 */
export type SharedBreakGlassOpening = {
  id: string;
  actor_role: string;
  actor_scope: unknown;
  patient_id: string;
  reason: string;
  minutes: { opened: number; until: number };
};
/**
 * Master audit M58 (D-125): a cover given, as the server lists it for a coordinator's review list.
 * `actor_*` is the giver's desk, `role` and `scope` the cover. Times are minutes from the server's now.
 */
export type SharedCoverGiven = {
  id: string;
  actor_role: string;
  actor_scope: unknown;
  role: string;
  scope: unknown;
  reason: string | null;
  minutes: { given: number; until: number };
};
/** The record-access route's whole answer to a coordinator. */
export type SharedRecordAccess = {
  views: SharedRecordView[];
  openings: SharedBreakGlassOpening[];
  covers: SharedCoverGiven[];
};
