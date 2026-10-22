import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * THE HOSPITAL FEED SEAM (smart features idea 11, 19 Oct 2026) — where a read-only feed of
 * admissions, transfers and discharges from a hospital's patient administration system would
 * arrive, built now and tested with invented messages so the work is ready when approvals exist.
 *
 * ⚠️ **NOTHING IS CONNECTED, AND NOTHING HERE CHANGES THE RECORD.** No network call, no event, no
 * write. `readFeedMessage` reads one message in the common HL7 version 2 ADT shape (segments split
 * by carriage returns, fields by `|`), and `previewFeedMessage` says what Ward Flow would do with it.
 * A person decides; the preview never acts.
 *
 * ⚠️ **SYNTHETIC ONLY, ENFORCED.** Ward Flow holds invented data (AGENTS.md hard rule 1). A message
 * whose record number is not in the synthetic `UMnnnnnn` form is refused before any other field is
 * read, so a real message pasted here goes no further. Real data needs the privacy impact
 * assessment, hosting approval, a data custodian and the health service's agreement first.
 *
 * Matching is by record number only, never by name or date of birth: a near-miss name is the classic
 * wrong-patient error. Legal status is never read from a feed; it stays typed by a person.
 */

/** The ADT trigger events this seam reads. Others are refused, not guessed at. */
const FEED_EVENTS = {
  A01: "admitted",
  A02: "transferred",
  A03: "discharged",
  // A04 is any registration (outpatient, emergency, pre-admission); PV1-2 says which.
  A04: "registered",
} as const;

type FeedEventCode = keyof typeof FEED_EVENTS;
type FeedEventKind = (typeof FEED_EVENTS)[FeedEventCode];

export type FeedMessage = {
  event: FeedEventKind;
  /** The sender's message control id (MSH-10), used to refuse a message received twice. */
  controlId: string;
  /** Synthetic record number, `UMnnnnnn`. */
  umrn: string;
  familyName: string;
  givenName: string;
  /** `YYYY-MM-DD`, as the message gave it. */
  dateOfBirth: string | undefined;
  /** Patient class, as given (PV1-2): `E` is an emergency attendance, `I` an inpatient. */
  patientClass: string;
  /** The message's point of care, room and bed, as given (PV1-3). Not mapped to a Ward Flow bed. */
  location: { pointOfCare: string; room: string; bed: string };
  /** `YYYYMMDDHHmm` from EVN-2, as given. */
  recordedAt: string | undefined;
};

export type FeedReadResult = { ok: true; message: FeedMessage } | { ok: false; reason: string };

const SYNTHETIC_UMRN = /^UM\d{6}$/;

function segments(text: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const fields = line.split("|");
    const name = fields[0]!;
    // MSH counts its own field separator as field 1, so shift it to line up with the standard.
    if (!found.has(name)) found.set(name, name === "MSH" ? ["MSH", "|", ...fields.slice(1)] : fields);
  }
  return found;
}

function component(field: string | undefined, index: number): string {
  return (field ?? "").split("^")[index]?.trim() ?? "";
}

function dateOfBirth(field: string | undefined): string | undefined {
  const digits = (field ?? "").trim();
  if (!/^\d{8}/.test(digits)) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** Reads one ADT message. Refuses anything it cannot read whole, or that is not synthetic. */
export function readFeedMessage(text: string): FeedReadResult {
  const found = segments(text);
  const msh = found.get("MSH");
  const pid = found.get("PID");
  if (!msh || !pid) return { ok: false, reason: "Not an ADT message: the MSH or PID segment is missing." };

  // PID-3, first repetition, first component: the record number. Checked before anything else.
  const umrn = component(pid[3]?.split("~")[0], 0);
  if (!SYNTHETIC_UMRN.test(umrn)) {
    return { ok: false, reason: "Refused: the record number is not a synthetic UMnnnnnn number." };
  }

  if (component(msh[9], 0) !== "ADT") {
    return { ok: false, reason: `Not read: message type ${component(msh[9], 0) || "missing"} is not ADT.` };
  }
  const code = component(msh[9], 1);
  if (!Object.hasOwn(FEED_EVENTS, code)) {
    return { ok: false, reason: `Not read: event ${code || "missing"} is not one this seam handles.` };
  }
  const pv1 = found.get("PV1");
  const evn = found.get("EVN");
  return {
    ok: true,
    message: {
      event: FEED_EVENTS[code as FeedEventCode],
      controlId: msh[10]?.trim() ?? "",
      umrn,
      familyName: component(pid[5], 0),
      givenName: component(pid[5], 1),
      dateOfBirth: dateOfBirth(pid[7]),
      patientClass: component(pv1?.[2], 0),
      location: {
        pointOfCare: component(pv1?.[3], 0),
        room: component(pv1?.[3], 1),
        bed: component(pv1?.[3], 2),
      },
      recordedAt: evn?.[2]?.trim() || undefined,
    },
  };
}

export type FeedPreview =
  | { kind: "known_person"; patientId: Patient["id"]; action: string; differences: string[] }
  | { kind: "new_person"; action: string };

const ACTIONS: Record<Exclude<FeedEventKind, "registered">, string> = {
  admitted: "Would suggest checking this admission against the ward's bed board.",
  transferred: "Would suggest checking the person's ward and bed.",
  discharged: "Would suggest checking the ward has recorded this discharge.",
};

/** A registration only matters to bed flow when it is an emergency attendance. */
function action(message: FeedMessage): string {
  if (message.event !== "registered") return ACTIONS[message.event];
  return message.patientClass === "E"
    ? "Would suggest checking whether this person needs a bed request."
    : "Would suggest nothing: this registration is not an emergency attendance.";
}

/**
 * What Ward Flow would do with a read message: match the person by record number only, and list
 * where the message's details differ from the record. Suggestions only; nothing is changed.
 */
export function previewFeedMessage(message: FeedMessage, patients: readonly Patient[]): FeedPreview {
  const patient = patients.find((candidate) => candidate.umrn === message.umrn);
  if (!patient) {
    return { kind: "new_person", action: `No person holds ${message.umrn}. ${action(message)}` };
  }
  const differences: string[] = [];
  if (message.familyName && message.familyName.toLowerCase() !== patient.familyName.toLowerCase()) {
    differences.push("Family name differs from the record");
  }
  if (message.givenName && message.givenName.toLowerCase() !== patient.givenName.toLowerCase()) {
    differences.push("Given name differs from the record");
  }
  if (message.dateOfBirth && message.dateOfBirth !== patient.dateOfBirth) {
    differences.push("Date of birth differs from the record");
  }
  return { kind: "known_person", patientId: patient.id, action: action(message), differences };
}
