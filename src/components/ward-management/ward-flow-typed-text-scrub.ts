import { referralIntakeError, type ReferralIntakeDetails } from "./referrals/referral-submission";
import { isDischargeCriterion } from "./ward-discharge-criteria";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { isValidStoredWardFlowState } from "./ward-flow-storage-validation";
import {
  normaliseTypedText,
  TYPED_TEXT_NOT_KEPT,
  type TypedTextLedger,
  typedTextOf,
} from "./ward-flow-typed-text-ledger";

/**
 * THE DEVICE COPY OF A SESSION THAT HOLDS TYPED TEXT (Josh, 21 Oct 2026, fix plan item 2, option A).
 *
 * D-18 still holds: typed text never reaches browser storage. What changed is what happens once a
 * session holds some. Until now the whole save stopped and was cleared, so a refresh lost every
 * other change too. Now the provider keeps saving a copy built here, in which every typed value is
 * replaced by `TYPED_TEXT_NOT_KEPT`, so a refresh keeps the rest of the board.
 *
 * Two independent passes do the replacing, and a final check decides whether the copy is written:
 *
 * 1. **Typed fields.** `HUMAN_ONLY_TEXT_FIELDS` (and, for a world loaded from a scenario file,
 *    `MIXED_TEXT_FIELDS`) name every record field a typed-text event writes. A value there that is not
 *    the fixture's own text is replaced. This pass needs no knowledge of the session, so it also
 *    covers a loaded world, whose typed text came from another session.
 * 2. **Typed values.** The ledger holds every typed value this session dispatched, in memory only
 *    (`ward-flow-typed-text-ledger.ts`). Any string anywhere in the world that equals one, or
 *    contains one of at least `MIN_CONTAINED_LENGTH` characters, is replaced: an audit summary or a
 *    nested record that quotes typed text is caught even if no field list names it.
 * 3. **Default deny.** The copy is refused, and the caller stops saving as before, if any object key
 *    still carries a typed value, or if the copy would not pass the same restore fence a refresh
 *    applies (`isValidStoredWardFlowState`). A typed date of birth or initials cannot become the
 *    placeholder without failing that fence, so a session holding them stops saving, exactly as
 *    every typed session did before.
 *
 * The fixture's own prose is kept: it ships in the bundle, so it is not a disclosure, and blanking
 * it made every restored history read as missing (Opus finding F3, 2026-09-17).
 *
 * **Adding a typed field.** A new typed-text event needs its reviewed keys in `NOT_TYPED_KEYS`
 * (`ward-flow-typed-text-ledger.ts`, whose test keeps it equal to the typed-text list), a fixture in
 * `tests/helpers/ward-typed-text-fixtures.ts`, and its stored path below. A new typed field on an
 * existing record needs the fixture marker and the path. `tests/ward-flow-typed-text-scrub.test.ts`
 * fails until no marker survives.
 */

/** A typed value shorter than this is replaced only where a whole string equals it. */
export const MIN_CONTAINED_LENGTH = 4;

/**
 * Typed fields, as path suffixes: `[]` stands for any array position, and a leading `^` anchors the
 * path at the root of the world. A suffix also matches the copies the engine keeps of a record, so
 * `secondSignOff.name` covers the movement's override, its audit event and its undo record alike.
 * Pinned by `tests/ward-flow-typed-text-scrub.test.ts`, which dispatches every typed-text event with
 * marker text and proves these fields remove every marker.
 *
 * `HUMAN_ONLY_TEXT_FIELDS` hold nothing but typed text, so they are always replaced.
 */
export const HUMAN_ONLY_TEXT_FIELDS: readonly string[] = [
  "^patients[].umrn",
  "^patients[].givenName",
  "^patients[].familyName",
  "^patients[].dateOfBirth",
  "^patients[].suburb",
  "^referrals[].history",
  "sendingTeamName",
  "intake.catchment.teamName",
  "intake.reasonForReferral",
  "intake.legalStatus",
  "intake.medicalClearance.expectedAt",
  "intake.medicalClearance.contactName",
  "intake.medicalClearance.contactPhone",
  "intake.charts[].name",
  "intake.charts[].base64",
  "intake.referrer.name",
  "intake.referrer.email",
  "intake.referrer.phone",
  "intake.referrer.role",
  "intake.referrer.location",
  "intake.arrival.transport",
  "intake.arrival.reference",
  "intake.arrival.estimatedAt",
  "intake.needs.expectedArrival",
  "corrections[].note",
  "reassessmentNote",
  "reassessmentHistory[].note",
  "escalation.contact",
  "cadNumber",
  "trackingNumber",
  "uploadedForms[].formName",
  "uploadedForms[].fileName",
  "secondSignOff.name",
  "initials",
  "who",
  "^supportNotifications[].reason",
  "dischargeCriteria.items[].criterion",
];

/**
 * Fields the engine also writes its own words into. In a live session the ledger finds the typed
 * values in them, so the engine's words stay. A world loaded from a file has no ledger, so these are
 * replaced as well, and a loaded world's own engine wording here reads as not kept after a refresh.
 */
export const MIXED_TEXT_FIELDS: readonly string[] = [
  "^movements[].blocker",
  "^movements[].closure.reason",
  "^broadcastAlerts[].title",
  "^broadcastAlerts[].message",
  "^broadcastAlerts[].targetScopeLabel",
  "^broadcastAlerts[].dispatchedByName",
];

type PathRule = { anchored: boolean; segments: readonly string[] };

function parseRule(rule: string): PathRule {
  const anchored = rule.startsWith("^");
  const segments = (anchored ? rule.slice(1) : rule)
    .split(".")
    .flatMap((part) => (part.endsWith("[]") ? [part.slice(0, -2), "[]"] : [part]));
  return { anchored, segments };
}

const HUMAN_ONLY_RULES = HUMAN_ONLY_TEXT_FIELDS.map(parseRule);
const MIXED_RULES = MIXED_TEXT_FIELDS.map(parseRule);

function matchesRule(path: readonly string[], rule: PathRule): boolean {
  const { segments } = rule;
  if (rule.anchored ? path.length !== segments.length : path.length < segments.length) return false;
  const offset = path.length - segments.length;
  return segments.every((segment, index) => path[offset + index] === segment);
}

/**
 * Every scenario's seeded world, supplied by the caller (the provider passes its own seeds), so this
 * module imports neither the reducer nor the scenarios.
 */
export type FixtureWorlds = () => readonly WardFlowState[];

let fixtureText: { from: FixtureWorlds; strings: ReadonlySet<string> } | undefined;

/** Every string in every seeded world, normalised. Built once per source, on first use. */
function fixtureStrings(worlds: FixtureWorlds): ReadonlySet<string> {
  if (fixtureText?.from === worlds) return fixtureText.strings;
  const strings = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") strings.add(normaliseTypedText(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  worlds().forEach(visit);
  fixtureText = { from: worlds, strings };
  return strings;
}

/**
 * Pass 1 alone: every typed field that is not fixture text becomes the placeholder. `loadedWorld`
 * adds the mixed fields, for a world whose typed values this session never saw.
 */
export function scrubTypedTextFields(state: WardFlowState, worlds: FixtureWorlds, loadedWorld = false): WardFlowState {
  const rules = loadedWorld ? [...HUMAN_ONLY_RULES, ...MIXED_RULES] : HUMAN_ONLY_RULES;
  const fixture = fixtureStrings(worlds);
  // Fixture text ships in the bundle, and a fixed-list discharge criterion is chosen, not typed.
  const keptAsIs = (value: string, path: readonly string[]): boolean =>
    value.trim() === "" ||
    fixture.has(normaliseTypedText(value)) ||
    (path.at(-1) === "criterion" && isDischargeCriterion(value));
  const visit = (value: unknown, path: string[]): unknown => {
    if (typeof value === "string")
      return keptAsIs(value, path) || !rules.some((rule) => matchesRule(path, rule)) ? value : TYPED_TEXT_NOT_KEPT;
    if (Array.isArray(value)) return value.map((entry) => visit(entry, [...path, "[]"]));
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, visit(entry, [...path, key])]));
    return value;
  };
  return keepHoldableIntakes(visit(state, []) as WardFlowState);
}

/** Optional intake times and file contents: a placeholder cannot stand in for these, so they go. */
const OPTIONAL_PATTERNED_INTAKE = [
  ["medicalClearance", "expectedAt"],
  ["arrival", "estimatedAt"],
  ["needs", "expectedArrival"],
] as const;

/**
 * A referral intake whose typed values cannot all become the placeholder (a referrer's email and phone
 * are pattern checked, as is a clearance time) is left out of the device copy whole, so the referral
 * itself is kept. Its fixed-list facts go with it until the restore fence accepts the placeholder.
 */
function keepHoldableIntakes(state: WardFlowState): WardFlowState {
  const referrals = state.referrals.map((referral) => {
    const intake = (referral as { intake?: Record<string, unknown> }).intake;
    if (!intake || referralIntakeError(intake as unknown as ReferralIntakeDetails) === null) return referral;
    const trimmed: Record<string, unknown> = { ...intake };
    for (const [group, field] of OPTIONAL_PATTERNED_INTAKE) {
      const inner = trimmed[group] as Record<string, unknown> | undefined;
      if (inner?.[field] !== TYPED_TEXT_NOT_KEPT) continue;
      const { [field]: _dropped, ...rest } = inner;
      void _dropped;
      trimmed[group] = rest;
    }
    if (Array.isArray(trimmed.charts))
      trimmed.charts = trimmed.charts.map((chart: Record<string, unknown>) => {
        if (chart.base64 !== TYPED_TEXT_NOT_KEPT) return chart;
        const { base64: _content, ...rest } = chart;
        void _content;
        return rest;
      });
    if (referralIntakeError(trimmed as unknown as ReferralIntakeDetails) === null)
      return { ...referral, intake: trimmed } as typeof referral;
    const { intake: _intake, ...rest } = referral as typeof referral & { intake?: unknown };
    void _intake;
    return rest as typeof referral;
  });
  return { ...state, referrals };
}

function matchesLedger(value: string, ledger: readonly string[]): boolean {
  const normalised = normaliseTypedText(value);
  return ledger.some(
    (typed) => normalised === typed || (typed.length >= MIN_CONTAINED_LENGTH && normalised.includes(typed)),
  );
}

/** The ledger without blank values or fixture text, normalised: what must not reach storage. */
function effectiveLedger(ledger: TypedTextLedger, worlds: FixtureWorlds): string[] {
  const fixture = fixtureStrings(worlds);
  return [...new Set(ledger.map(normaliseTypedText))].filter((typed) => typed !== "" && !fixture.has(typed));
}

/**
 * The world as it may be written to this device, or `null` when it cannot be written safely and the
 * caller must stop saving and clear what is stored.
 */
export function redactTypedTextForDevice(
  state: WardFlowState,
  ledger: TypedTextLedger,
  worlds: FixtureWorlds,
  loadedWorld = false,
): WardFlowState | null {
  const typed = effectiveLedger(ledger, worlds);
  let keyLeak = false;
  const replaceValues = (value: unknown): unknown => {
    if (typeof value === "string") return matchesLedger(value, typed) ? TYPED_TEXT_NOT_KEPT : value;
    if (Array.isArray(value)) return value.map(replaceValues);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => {
          if (matchesLedger(key, typed)) keyLeak = true;
          return [key, replaceValues(entry)];
        }),
      );
    return value;
  };
  // Checked in its stored form (JSON drops `undefined`, and a `File` becomes `{}`), exactly as the
  // restore fence will read it after a refresh.
  const stored: unknown = JSON.parse(
    JSON.stringify({ ...scrubTypedTextFields(state, worlds, loadedWorld), rejections: [] }),
  );
  const redacted = replaceValues(stored);
  if (keyLeak || !isValidStoredWardFlowState(redacted)) return null;
  return redacted;
}

/**
 * The device copy for a session that dispatched `events` carrying typed text (memory only, held by the
 * provider). `null` when one of them cannot be read, so nothing typed is ever guessed at.
 */
export function deviceCopyFromEvents(
  state: WardFlowState,
  events: readonly WardFlowEvent[],
  worlds: FixtureWorlds,
  loadedWorld = false,
): WardFlowState | null {
  const ledger: string[] = [];
  for (const event of events) {
    const typed = typedTextOf(event);
    if (typed === null) return null;
    ledger.push(...typed);
  }
  return redactTypedTextForDevice(state, ledger, worlds, loadedWorld);
}
