import type { WardFlowState } from "./ward-flow-reducer";

/**
 * H-0731 (Josh, 27 Oct 2026): the parts of a patient's record that no list, board or drawer shows.
 * The shared workspace leaves them out of every desk's board, and the server sends them for one
 * patient only once it has logged that the desk opened that record (`logRecordView`). Kept in step
 * with `backend/ward-flow/record-detail.mjs`. The local demo holds them in its own board as before.
 */
const RECORD_DETAIL_FIELDS = ["address", "interpreterLanguage"] as const;

export type RecordDetail = Partial<Record<(typeof RECORD_DETAIL_FIELDS)[number], string>>;

/** The detail in a server reply, or null when it has none or anything in it is not plain text. */
export function parseRecordDetail(value: unknown): RecordDetail | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const detail: RecordDetail = {};
  for (const [key, field] of Object.entries(value)) {
    if (!(RECORD_DETAIL_FIELDS as readonly string[]).includes(key)) return null;
    if (typeof field !== "string" || field.length > 500) return null;
    detail[key as (typeof RECORD_DETAIL_FIELDS)[number]] = field;
  }
  return detail;
}

/** The board with each opened patient's detail put back. Unchanged when nothing applies. */
export function withRecordDetail<P extends { state: WardFlowState }>(
  payload: P,
  details: ReadonlyMap<string, RecordDetail>,
): P {
  if (details.size === 0 || !payload.state.patients.some((patient) => details.has(patient.id))) return payload;
  const patients = payload.state.patients.map((patient) => {
    const detail = details.get(patient.id);
    return detail ? { ...patient, ...detail } : patient;
  });
  return { ...payload, state: { ...payload.state, patients } };
}

/**
 * The detail one desk has been sent, for the access view it was sent under. The server's access
 * context names the account, desk, place and openings, so another desk starts empty, and a reply
 * that arrives after the view changed is not kept.
 */
export class RecordDetailHold {
  private details = new Map<string, RecordDetail>();
  private context: string | undefined;
  /** The board with the held detail put back, once the view it was sent under is checked. */
  apply<P extends { state: WardFlowState }>(payload: P, context: string | undefined): P {
    if (context !== this.context) this.details = new Map();
    this.context = context;
    return withRecordDetail(payload, this.details);
  }
  /** Keeps a logged opening's detail. True when it was kept, so the board should be drawn again. */
  take(reply: unknown, askedUnder: string | undefined): boolean {
    if (askedUnder !== this.context || !reply || typeof reply !== "object") return false;
    // `opened` is the person whose record the server logged as opened.
    const { opened, detail } = reply as { opened?: unknown; detail?: unknown };
    const parsed = parseRecordDetail(detail);
    if (typeof opened !== "string" || !parsed) return false;
    this.details = new Map(this.details).set(opened, parsed);
    return true;
  }
  /** The view the held detail belongs to. */
  get view(): string | undefined {
    return this.context;
  }
}
