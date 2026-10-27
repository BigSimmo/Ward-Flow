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
