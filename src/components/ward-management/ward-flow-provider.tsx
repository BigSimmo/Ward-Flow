"use client";

import { clearWardFlowDraftCaches } from "./use-dirty-state-guard";
import { wardReferralInboxEntries, type WardReferralInboxEntry } from "./referrals/referral-inbox";
import type { LeavingDestination } from "./ward-admissions";

import {
  createContext,
  type Dispatch,
  Fragment,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  readOpenedDischargeRecord,
  selectDischargeRecords,
  selectDischargeRecord,
  safeCounter,
  validRecordActor,
  type DischargeOpenHandle,
  type DischargeRecord,
  type RecordRead,
  type WardRecordActor,
} from "./ward-discharge-records";
import { readAuditEvents, readAuditReviews, type AuditEvent, type AuditReview } from "./ward-audit";
import { forgetDowntimePack } from "./reports/downtime-pack";

import type { Instant } from "@/components/ward-management/ward-clock";
import { absoluteWallClockMinutes, applyDueSoonThresholds, demoDayZero } from "@/components/ward-management/ward-clock";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
  withInboxStreamADefaults,
} from "./ward-flow-storage-validation";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "./ward-patient-resolver";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { BroadcastAlert } from "./alerts/ward-broadcast-model";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type HandoverSignOffRecord,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type {
  BedRelease,
  LeaveBed,
  Movement,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { activateScenarioNetwork, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { eventLogEntryFor, type EventLogEntry } from "@/components/ward-management/ward-event-log";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  WARD_FLOW_TYPED_TEXT_EVENT_TYPES,
  findWardFlowEventTypeCoverageGaps,
  type AssertNever,
  type UnreviewedStringOrUnknownKeys,
} from "@/components/ward-management/ward-flow-persistence-classification";
import {
  buildScenarioFile,
  readScenarioFile,
  type ScenarioFileBuild,
} from "@/components/ward-management/ward-flow-scenario-file";

/**
 * The screens never see the raw reducer state or the clock's internal offsets — they see the
 * three collections plus a single resolved `now`, and the one way to raise an event.
 *
 * Task 12: `focusMovementId` is the one piece of UI-only state this context carries alongside
 * the reducer's own — "which patient is currently in view", set only by the coordinator
 * screen's own movement selection (`coordinator-screen.tsx`'s `selectMovement`). It exists here,
 * shared, rather than as `CoordinatorScreen`'s own local state, because `WardRoleSwitcher`
 * renders on every ward-management route (inside `ClinicalRail`) and needs to answer "where
 * does this patient's Ward/ED role live" regardless of which screen it is currently rendered
 * on — a route change swaps out the page under this shared layout, which would otherwise reset
 * a screen-local selection back to nothing on every hop. It is never read by the reducer and
 * never dispatched as an event: it is display/navigation state only, the same category as
 * `selectedUnitId`/`selectedEdId` already are on the coordinator screen, just lifted one level
 * because it now has more than one reader.
 */
type WardFlowContextValue = {
  worldGeneration: number;
  /** True once the saved session has been read (or declined). Before then the world is the seed. */
  sessionAdopted: boolean;
  recordWardDeparture(admissionId: string, actingUnitId: string, leavingDestination: LeavingDestination): void;
  readDischargeRecords(actor: WardRecordActor, unitId?: string): RecordRead<readonly DischargeRecord[]>;
  openDischargeRecord(actor: WardRecordActor, admissionId: string): DischargeOpenHandle;
  readDischargeRecord(
    actor: WardRecordActor,
    admissionId: string,
    handle: DischargeOpenHandle | null,
  ): RecordRead<DischargeRecord>;
  readAuditEvents(actor: WardRecordActor): RecordRead<readonly AuditEvent[]>;
  readAuditReviews(actor: WardRecordActor): RecordRead<readonly AuditReview[]>;
  movements: Movement[];
  units: Unit[];
  /** Task 5 (Phase 7, "The front door"): the referral board and match view need every front-door
   *  referral, live from reducer state — the same reasoning `bedReleases`/`leaveBeds` below
   *  already document for their own collections. Previously omitted: the intake form's own
   *  success banner (`referral-intake.tsx`) could not echo the referral it had just raised,
   *  because nothing on this context carried it. */
  referrals: Referral[];
  /** A recipient projection; other wards and their answers never leave this selector. */
  wardReferralInbox(unitId: string): WardReferralInboxEntry[];
  rejections: Rejection[];
  /** Task 11 (spec item 9): beds expected to free up, live from reducer state so a ward's own
   *  `FLAG_BED_RELEASE` shows up on every screen reading `unitCapacity()`'s `potential` figure. */
  bedReleases: BedRelease[];
  /** Task 3: beds occupied by someone on approved leave, live from reducer state so a ward's own
   *  `RECORD_LEAVE_BED`/`END_LEAVE_BED` shows up on every screen reading it. Never merged into
   *  availability (spec D4). */
  leaveBeds: LeaveBed[];
  /** Task 3, spec D12: every `REQUEST_CAPACITY_REFRESH` a coordinator has raised, live from
   *  reducer state. Records that somebody asked — nothing here ever changes a bed figure. */
  refreshRequests: { unitId: string; at: Instant; byRole: string }[];
  /** Handover sign-offs, role and time only (`RECORD_HANDOVER_SIGN_OFF`). Read by the Handover page's History. */
  handoverSignOffs: HandoverSignOffRecord[];
  /**
   * Who has acknowledged which inbox item, and who has completed which — live from reducer state so
   * the global tasks drawer shows the same answer on every route rather than each screen keeping
   * its own.
   *
   * ⚠️ **Exposed READ-ONLY, and the distinction between the two maps is a safety property, not a
   * naming choice.** Every category in `INBOX_CATEGORIES` is classified `kind: "fact"` by owner
   * ruling, so nothing is completable today: an acknowledgement records that a human has seen a
   * live clinical or legal fact and is on it, and **never removes the row or marks it resolved**.
   * The completion map exists because the machinery does, not because anything currently uses it.
   * **The gate is the reducer's own refusal in `COMPLETE_INBOX_ITEM`** — a component reading these
   * maps is displaying a decision, never making one.
   */
  inboxAcknowledgements: WardFlowState["inboxAcknowledgements"];
  inboxCompletions: WardFlowState["inboxCompletions"];
  /** Stream A, 9 Oct 2026: inbox row ownership and snooze histories, read-only like the two above. */
  inboxOwnership: WardFlowState["inboxOwnership"];
  inboxSnoozes: WardFlowState["inboxSnoozes"];
  /** Authored notices remain reducer-owned; Activity reads their existing audience and time. */
  notices: WardFlowState["notices"];
  morningRollupConfirmations: WardFlowState["morningRollupConfirmations"];
  /** The people in the beds - seeded occupants plus anyone who has ARRIVED during this session.
   *  Task 17, 2026-08-30: before this, arrival closed the movement and created no person, so a
   *  patient who reached a ward disappeared from every surface that filters to open movements. */
  /** The people. A patient exists before any referral and outlives every admission, so search can
   *  find somebody with nothing attached at all - which is the case the owner's flow turns on. */
  /** FD-23 / universal identity: resolve one explicit subject without exposing referral records,
   * destinations or history to ward-facing callers. Conflicting/missing links remain unknown. */
  resolvePatientIdentity(subject: Parameters<typeof resolveSubjectPatient>[0]): ResolvedPatientInfo;
  patients: Patient[];
  admissions: Admission[];
  now: Instant;
  /** The calendar day that `Instant` 0 falls on - local midnight of the day this session opened.
   *  An instant plus this is a real moment; an instant alone is only an offset. Screens that must
   *  say a DATE rather than a relative day read it from here so every surface agrees. */
  dayZero: Date;
  /** Which synthetic night is seeded — `ward-scenarios.ts`'s `WardScenario` — so a UI surface
   *  (`ward-demo-controls.tsx`'s scenario switch) can mark the active one without guessing it
   *  from `units` itself. */
  scenario: WardScenario;
  /** Task 5 of the audit-wiring plan, 2026-09-16: the coordinator-tunable figures (ED access
   *  target, parallel referral cap, pull hold), live from reducer state — see
   *  `WardFlowState.configuration`'s own doc comment. Read-only here; `SET_CONFIGURATION` is the
   *  only writer. */
  configuration: WardFlowState["configuration"];
  broadcastAlerts: BroadcastAlert[];
  /** Known future admissions (stream D). Optional so hand-built test contexts need not supply it. */
  plannedAdmissions?: WardFlowState["plannedAdmissions"];
  /** Advisory carer/PSP/MHAS notification records. Optional so hand-built test contexts need not supply it. */
  supportNotifications?: NonNullable<WardFlowState["supportNotifications"]>;
  /** Event log, step 1: every event dispatched this session (type, role, time, accepted, ids). */
  eventLog?: readonly EventLogEntry[];
  dispatch: Dispatch<WardFlowEvent>;
  focusMovementId: string | undefined;
  setFocusMovementId: Dispatch<SetStateAction<string | undefined>>;
  resetDemoState: () => void;
  /** Demo scenario files (`ward-flow-scenario-file.ts`): the whole synthetic world as a file the
   *  presenter downloads, and a loader that replaces this world with one read back from a file.
   *  Optional so hand-built test contexts need not supply them. */
  saveScenarioFile?: () => ScenarioFileBuild;
  loadScenarioFile?: (text: string) => { ok: true } | { ok: false; reason: string };
};

export type { WardFlowContextValue };
export const WardFlowContext = createContext<WardFlowContextValue | null>(null);
export const WardFlowClockContext = createContext<Instant | null>(null);

type WardFlowProviderProps = {
  children: ReactNode;
  /**
   * Pins the clock at this instant and stops it from ticking. Tests and any deterministic
   * render (screenshots, contract walks) pass this; the live app omits it so the clock reads
   * the wall clock once at mount and then advances only via the 30s tick interval, never by
   * re-reading the wall clock on every render.
   */
  initialNow?: Instant;
};

export const WARD_FLOW_DEMO_STORAGE_KEY = "ward-flow-demo-state-v1";

/**
 * ⚠️ **BUMP THIS WHENEVER THE STORED SHAPE CHANGES**, not only the key. Audit finding ISSUE-P1-83
 * (2026-09-16, defect 3): the version used to live only in the storage KEY's own "-v1" suffix, which
 * nothing ever read back — a shape change would have restored a stale-shaped object straight into
 * `useReducer` with no check at all. It now travels INSIDE the payload and is checked on every read
 * (`isValidDemoPayload`), so a version bump discards an old-shaped save rather than trusting it.
 *
 * 🔴 **BUMPED 2 → 3, 2026-09-17, Y4 privacy remediation.** Two independent shape changes land in the
 * same pass: the payload no longer carries `anchorOffsetMinutes` at all (see `tryReadDemoState`'s own
 * comment for why comparing it was the defect, not the fix), and `state.configuration` is now
 * validated on restore (`isValidStoredWardFlowState`) rather than trusted unchecked. A v2 save read
 * by this build would either be missing the fields the new checks require or carry an unvalidated
 * configuration — discarding it rather than reading either the old shape or an invented default is
 * this project's ordinary conservative-degradation rule, applied here as everywhere else.
 */
// v4 stores the synthetic clock and validates nested recovery records. v5 (2026-09-25): a bed
// release now names the admission it belongs to (`BedRelease.admissionId`, owner decision
// 2026-09-25) — a v4 save has no such field and no honest migration exists, so it is refused
// exactly like every other version mismatch above, never guessed or backfilled.
// v6 (2026-10-08): explicit deterioration/pause, recorded ATS and corroborated
// arrival/capacity conflicts; reciprocal runtime admission links are validated.
// Old automatic saves are refused rather than silently migrating clinical facts.
// v7 (2026-10-09, stream D): planned admissions and their id sequence are part of the state.
// A v6 save is the one exception to refusal (Josh, 9 Oct 2026): it gains an empty booking list
// (`migrateStoredWardFlowState`) and is then validated exactly as a v7 save.
const WARD_FLOW_DEMO_STORAGE_VERSION = WARD_FLOW_STORED_STATE_VERSION;

/**
 * What actually goes to `sessionStorage`. Carries the world's calendar day ALONGSIDE the state, not
 * only inside it, so a restore can refuse a save that no longer describes THIS world before it ever
 * touches the reducer — see `tryReadDemoState`'s own comment for why a mismatch here means discard,
 * never a silent timestamp shift.
 */
type WardFlowDemoPayload = {
  version: number;
  /** `dayZero.getTime()` at save — a calendar day, not a duration; compared for exact equality. */
  dayZero: number;
  /** Redundant with `state.worldGeneration`, and deliberately so: a payload where the two disagree
   *  is corrupt in a way a shape check alone would not catch, and is discarded rather than trusted. */
  worldGeneration: number;
  now: Instant;
  savedAtAbsolute: number;
  state: WardFlowState;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDemoPayload(value: unknown): value is WardFlowDemoPayload {
  if (!isPlainObject(value)) return false;
  if (typeof value.version !== "number") return false;
  if (typeof value.dayZero !== "number") return false;
  if (typeof value.worldGeneration !== "number") return false;
  if (!Number.isFinite(value.now) || !Number.isFinite(value.savedAtAbsolute)) return false;
  return isValidStoredWardFlowState(value.state);
}

export { WARD_FLOW_TEXT_SAFE_EVENT_TYPES, WARD_FLOW_TYPED_TEXT_EVENT_TYPES, findWardFlowEventTypeCoverageGaps };
export type { AssertNever, UnreviewedStringOrUnknownKeys };

/**
 * The `useReducer` state this provider actually carries: the real reducer's world, plus one flag no
 * reducer case ever reads and only `trackWardFlowTypedTextDispatch` below ever writes.
 */
type WardFlowContainer = {
  world: WardFlowState;
  typedTextSeen: boolean;
  restoredElapsed: number;
  recoveryNotice?: string;
  /** Event log, step 1: every dispatch this session, in memory only (see `ward-event-log.ts`).
   *  Starts empty; a reset to a new world starts it again. Never saved. */
  eventLog?: readonly EventLogEntry[];
  /** True once the mount effect has read (or declined to read) the saved session. Storage is never
   *  written before this, so the deterministic first-render seed cannot overwrite a saved day. */
  sessionAdopted?: boolean;
  /** True when adoption replaced the world with a saved one that differs from the first-render
   *  seed. The screens below are then remounted once (see `WardFlowWorld`'s return). */
  sessionRestored?: boolean;
  /** Events dispatched before adoption, in order, held in memory only. Adopting a changed saved day
   *  replays them on top of it, so an action taken in the first moments after load is applied (or
   *  refused, visibly) rather than silently dropped with the seed it landed on. */
  preAdoptionEvents?: readonly WardFlowEvent[];
};

/**
 * The one container change that is not a `WardFlowEvent`: adopting the saved session after
 * hydration. Keyed by a module-private symbol so no caller-built event can ever take this path.
 */
const ADOPT_SESSION: unique symbol = Symbol("ward-flow-adopt-session");
type AdoptSessionAction = {
  type: "ADOPT_SAVED_SESSION";
  [ADOPT_SESSION]: (current: WardFlowContainer) => WardFlowContainer;
};

/** Also not a `WardFlowEvent`: replacing the world from a demo scenario file
 *  (`ward-flow-scenario-file.ts`) never reaches the reducer, the event log or a role check. */
type LoadScenarioFileAction = { type: "LOAD_SCENARIO_FILE_INTERNAL"; world: WardFlowState; restoredElapsed: number };

function wardFlowContainerReducer(
  container: WardFlowContainer,
  action: WardFlowEvent | AdoptSessionAction | LoadScenarioFileAction,
): WardFlowContainer {
  if (ADOPT_SESSION in action) return action[ADOPT_SESSION](container);
  if (action.type === "LOAD_SCENARIO_FILE_INTERNAL")
    // A loaded world may hold typed text, so it is treated exactly as a session that has typed:
    // browser saving stays off until a genuine reseed (D-18). The file is the presenter's copy.
    // It also counts as adopted, so a late browser restore can never replace it.
    return {
      ...container,
      world: action.world,
      typedTextSeen: true,
      restoredElapsed: action.restoredElapsed,
      eventLog: [],
      recoveryNotice: undefined,
      sessionAdopted: true,
      preAdoptionEvents: undefined,
    };
  const next = trackWardFlowTypedTextDispatch(container, action);
  if (container.sessionAdopted) return next;
  return { ...next, preAdoptionEvents: [...(container.preAdoptionEvents ?? []), action] };
}

/**
 * Wraps the real reducer to also track whether this session has DISPATCHED — not merely had
 * accepted — an event whose type carries human-typed text. (Until 25 Sept 2026 it ALSO locked on ANY
 * refused dispatch; see rule 2, now superseded.)
 *
 * 🔴 **REDESIGNED 2026-09-17, controller decision, Opus adversarial review P2 findings 4–6.**
 * The previous version locked only once a TYPED-TEXT event was genuinely ACCEPTED (read off
 * `rejections.length` not growing). That is gone in two steps:
 *
 * 1. **Locking fires on DISPATCH alone, accepted or refused, for a typed-text event type.** A
 *    rejection record can quote its own payload back (`makeRejection` in `ward-flow-reducer.ts`
 *    stores `attempted`/`reason`, and some reasons interpolate the offending value), so a refused
 *    typed-text dispatch is not nothing to protect.
 * 2. **SUPERSEDED 25 Sept 2026 — Josh, D-18, "Only for typed text".** A refusal no longer locks:
 *    it silently stopped saving for the rest of the session, including the designed "refused, then
 *    give a reason" step, so a reload lost the day. The risk named below — a caller-supplied id
 *    echoed into `Rejection.reason`/`id` — is instead closed at the WRITE: `tryWriteDemoState`
 *    never stores `rejections` (it saves `[]`), and `isValidStoredWardFlowState` still refuses any
 *    stored rejection as a second fence. The original rule, kept for history: **Locking ALSO
 *    fires on ANY rejection at all — including a SAFE-listed event's own** (P2
 *    finding 1, second review round). Confirmed by reading the reducer: `` `no movement found for id
 *    ${event.movementId}` ``, `` `no unit found for id ${event.unitId}` `` and similar reject-branch
 *    messages quote a caller-supplied ID straight into `Rejection.reason`, and NOTHING on the
 *    safe-event list stops a caller passing marker text (or any other string) as `movementId`,
 *    `unitId`, or any other id-shaped field and having it echoed into a SAVED rejection the moment
 *    it fails to resolve to a real record. `WARD_FLOW_TEXT_SAFE_EVENT_TYPES`'s own comment used to
 *    say these ids are "never rendered back as prose" — that claim was wrong, and this is the fix,
 *    not a softened version of it.
 *
 * The combined rule is now genuinely DEFAULT-DENY rather than a denylist: `event.type` not being on
 * `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` locks (never the narrower "is it on the typed-text list", which
 * would silently trust a THIRD, unclassified event type as safe — the union-coverage guard makes a
 * third state impossible today, but the runtime check no longer depends on that guard alone to stay
 * safe). (A growing `rejections` array no longer locks — rule 2 above.)
 *
 * ⚠️ **THE LOCK LIVES INSIDE `WardFlowContainer`, THE VALUE `useReducer` ITSELF RETURNS — NEVER IN A
 * REF THIS FUNCTION MUTATES** (P2 finding 5, the race). A plain `useRef` written from inside a
 * reducer function is written on every CALL of that function, including a call whose resulting state
 * React computes and then discards without ever committing it — React's Strict Mode double-invokes
 * reducers precisely to surface functions with exactly this kind of side effect, and any interrupted
 * concurrent render is the general case the same trap belongs to. A ref set that way could read
 * `true` for a dispatch that, from the committed tree's perspective, never happened. `typedTextSeen`
 * instead travels inside the SAME object `useReducer` returns as `world`, so React can only ever
 * expose a value that was actually committed — `WardFlowWorld`'s persistence effect below reads
 * `container.typedTextSeen` the same way it reads `state` itself, never a separately-mutated ref.
 *
 * A genuine world reseed (`RESET_SCENARIO`/`SET_SCENARIO`, the only two writers of `worldGeneration`
 * — see `wardFlowReducer`'s own case, and `case "SET_SCENARIO"`'s own comment for why that case's
 * condition also checks `next.movements !== state.movements` rather than role alone since this
 * round) replaces the whole world with fresh fixture data carrying no runtime-typed text at all, so
 * it is the only thing that clears the lock — matching "a demo reset re-enables saving" regardless
 * of which of the two call sites raised it (the context's own `resetDemoState()`, or the
 * demo-controls menu's direct `dispatch({ type: "RESET_SCENARIO", … })`, which does not go through
 * `resetDemoState()` at all). A REJECTED reset attempt (wrong role, or now also an invalid
 * `SET_SCENARIO` scenario) leaves `worldGeneration` unchanged, so it leaves the lock as it was.
 */
function trackWardFlowTypedTextDispatch(container: WardFlowContainer, event: WardFlowEvent): WardFlowContainer {
  const nextWorld = wardFlowReducer(container.world, event);
  const accepted = nextWorld.rejections.length === container.world.rejections.length;
  const logged = eventLogEntryFor(event, accepted);
  if (nextWorld.worldGeneration !== container.world.worldGeneration) {
    return { ...container, world: nextWorld, typedTextSeen: false, eventLog: [logged] };
  }
  const eventLog = [...(container.eventLog ?? []), logged];
  const typedTextSeen = container.typedTextSeen || !WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(event.type);
  return { ...container, world: nextWorld, typedTextSeen, eventLog };
}

const STORAGE_UNAVAILABLE =
  "Demo storage is unavailable. Changes stay in memory and may be lost when this page closes.";
const SAVE_REJECTED =
  "The saved demonstration could not be restored safely. A fresh synthetic demonstration has started.";

type DemoRead = { saved?: WardFlowDemoPayload; recoveryNotice?: string };

/** A parsed save brought to this build's version when a migration exists (v6 only); any other
 *  version is returned unchanged, so the version check below still refuses it. */
function upgradeDemoPayload(value: unknown): unknown {
  if (!isPlainObject(value) || value.version === WARD_FLOW_DEMO_STORAGE_VERSION) return value;
  const state = migrateStoredWardFlowState(value.state, value.version);
  return state === null ? value : { ...value, version: WARD_FLOW_DEMO_STORAGE_VERSION, state };
}

/** Same-day reload includes time away. A different day or backward clock starts a fresh demo;
 * no saved event or entered time is shifted or reconstructed. Storage access is entirely guarded. */
function tryReadDemoState(dayZero: Date, mountedAtAbsolute: number): DemoRead {
  if (typeof window === "undefined") return {};
  try {
    const storage = window.sessionStorage;
    const raw = storage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    if (!raw) return {};
    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      return { recoveryNotice: SAVE_REJECTED };
    }
    const parsed = upgradeDemoPayload(stored);
    if (
      !isValidDemoPayload(parsed) ||
      parsed.version !== WARD_FLOW_DEMO_STORAGE_VERSION ||
      parsed.dayZero !== dayZero.getTime() ||
      parsed.worldGeneration !== parsed.state.worldGeneration ||
      parsed.savedAtAbsolute > mountedAtAbsolute ||
      parsed.now < NOW_ANCHOR + parsed.state.clockOffsetMinutes ||
      parsed.state.auditEvents.some((event) => event.at !== null && event.at > parsed.now)
    )
      return { recoveryNotice: SAVE_REJECTED };
    return { saved: { ...parsed, state: withInboxStreamADefaults(parsed.state) } };
  } catch {
    // Do not repeat stored content or an exception message in the recovery notice.
    return { recoveryNotice: STORAGE_UNAVAILABLE };
  }
}

function tryWriteDemoState(state: WardFlowState, dayZero: Date, now: Instant, savedAtAbsolute: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: WardFlowDemoPayload = {
      version: WARD_FLOW_DEMO_STORAGE_VERSION,
      dayZero: dayZero.getTime(),
      worldGeneration: state.worldGeneration,

      now,
      savedAtAbsolute,
      // Refusal records are never stored (Josh, D-18, 25 Sept 2026): a refusal can quote a
      // caller-supplied id back in `reason`/`id`, so a saved day keeps its work but not its refusals.
      state: { ...state, rejections: [] },
    };
    window.sessionStorage.setItem(WARD_FLOW_DEMO_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearWardFlowDemoState(): boolean {
  clearWardFlowDraftCaches();
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(WARD_FLOW_DEMO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Audit finding ISSUE-P1-83, defect 3c: `OPEN_DISCHARGE_RECORD` requests are identified by a
 * monotonically increasing `requestId` (`WardFlowWorld`'s `openRequestSequence` below), and
 * `readOpenedDischargeRecord` (`ward-discharge-records.ts`) finds a request's own audit receipt by
 * matching `requestId` against `state.auditEvents`. A restored session's audit log already holds
 * `requestId`s from before the restore; if the counter restarted at 0, the next open would either
 * collide with an old receipt for a DIFFERENT admission (denied as a replay) or, had none existed to
 * collide with, still leave the door open for the very next id to collide once the log grew back to
 * where it left off. Continuing past the highest id already on the restored log is the only value
 * that can never collide with it.
 */
function nextOpenRequestSequence(auditEvents: WardFlowState["auditEvents"]): number {
  let highest = -1;
  for (const entry of auditEvents) {
    if (entry.category !== "record-access" || entry.action !== "OPEN_DISCHARGE_RECORD") continue;
    const requestId = entry.details.requestId;
    if (typeof requestId === "number" && Number.isFinite(requestId) && requestId > highest) highest = requestId;
  }
  return highest + 1;
}

/**
 * 🔴 **THE WALL CLOCK IS READ AFTER MOUNT, NOT DURING RENDER — BECAUSE A `useState` INITIALISER
 * RUNS TWICE AND THE TWO RUNS ARE ON DIFFERENT MACHINES.**
 *
 * Found 2026-09-06 by opening a ward page and reading the console. React reported *"Hydration
 * failed because the server rendered text…"* on `/mockups/ward-flow/board/rph-adult-secure`.
 * Measured, not inferred — the same URL, fetched server-side and compared with the live DOM:
 *
 *     server HTML   As at <!-- -->01:17
 *     browser DOM   As at 01:16
 *
 * `useState(() => wallClockNow() - NOW_ANCHOR)` runs once during SSR and again during hydration.
 * Any minute boundary between the two makes the offset differ by one — and that offset feeds
 * `seedWardFlowStateAt`, which is `shiftInstants(seed, offset)`, so **every instant in the whole
 * seeded world moves at once**. That is why React sees a text mismatch rather than one stale clock.
 *
 * ⚠️ **NOTHING CAUGHT IT, AND THE REASON IS WORTH MORE THAN THE BUG.** jsdom component tests never
 * server-render, so no component suite could have seen a hydration mismatch however it renders.
 *
 * 🔴 **CORRECTED 2026-09-07 — this paragraph used to say "Every ward test passes `initialNow`", and
 * that is FALSE.** Measured from the tree, not recalled: 236 provider render sites under `tests/`,
 * of which **20 pass no `initialNow` at all**, across 14 files. Two of those are deliberate and must
 * STAY unpinned — `ward-flow-provider.dom.test.tsx` and `ward-out-of-area-live-state.dom.test.tsx`
 * mock the clock functions instead, and the latter says so in as many words: *"No `initialNow` on
 * the provider either — that is the point."* Pinning either would delete the property it exists to
 * test. **The remaining 18 sites, across 12 files, are unpinned by omission with no clock control of
 * any kind** — for those the effect below does NOT return, the world re-seeds at the real wall-clock
 * offset, and the 30s interval is installed.
 *
 * ⚠️ **Whether any of the 18 actually varies run to run is UNMEASURED.** A timezone probe was
 * attempted and its own control showed `TZ` is ignored by Node on this machine, so it proved
 * nothing and is not evidence either way. Do not cite it; do not cite its absence either.
 *
 * ⚠️ **The conclusion above survives, but the premise did not — and the premise travelled.** Nothing
 * caught the hydration bug because of the SSR half, which holds for pinned and unpinned suites
 * alike. The pinning half was repeated as *"every DOM suite pins `initialNow`"* in a handover on
 * 2026-09-07 and reasoned from, to conclude that a whole class of clock-advance defect was
 * unreachable. It is reachable and merely unasserted, which is a weaker and far more fixable
 * position. **A scope sentence written wider than it was checked is the same defect this programme
 * exists to catch, committed in a comment instead of on a screen.**
 *
 * ⚠️ **IT IS INTERMITTENT, NOT CONSTANT.** Roughly the SSR-to-hydration gap over sixty seconds, so
 * it gets likelier the slower the render. One reproduction with both values captured; four clean
 * loads afterwards. An earlier reading of "every route, every load" was the browser console buffer
 * accumulating across in-tab navigations — every later route was showing the board's error.
 *
 * **What this does.** The first render — server, and the client's hydration render — uses offset
 * zero: the frozen 10:42 night the fixture was authored against, which is exactly what every test
 * already renders, so the first paint is a coherent board rather than a placeholder. A mount effect
 * then reads the wall clock once and hands it to `WardFlowWorld`, which restores any saved session
 * through its reducer without remounting. **A state update after hydration is not a hydration mismatch** —
 * React compares only the first client render against the server HTML.
 *
 * 🔴 **`suppressHydrationWarning` WOULD HAVE BEEN THE WORST OF THE OPTIONS AND IS RECORDED HERE SO
 * NOBODY REACHES FOR IT.** It silences the warning while the server and the client go on showing
 * genuinely different figures, on a board about beds. The warning is the only thing that would say
 * so.
 *
 * ⚠️ **WHAT THIS DOES NOT FIX, STATED RATHER THAN LEFT TO BE DISCOVERED.** `dayZero` below still
 * reads `new Date()` in a render-time initialiser, so a session whose SSR and hydration straddle
 * MIDNIGHT can still mismatch. That is left deliberately: it is day-granularity rather than
 * minute-granularity, so it is roughly 1/1440 as likely, it is no worse than before this change,
 * and deferring it has a cost the offset does not — `dayZero` is rendered as calendar dates and as
 * a patient's AGE (`person-screen.tsx`), so a placeholder would paint a wrong age for a frame.
 * **A visibly wrong clinical figure for one frame is worse than a rare console error.**
 */
export function WardFlowProvider({ children, initialNow }: WardFlowProviderProps) {
  useEffect(() => {
    clearWardFlowDraftCaches();
  }, []);
  /**
   * `null` until the mount effect below runs. While null, the world is the deterministic anchor
   * night — identical on the server and in the hydration render, which is the whole point.
   *
   * A pinned `initialNow` never defers: it is already deterministic, and every existing suite
   * renders through this branch unchanged.
   */
  const [adopted, setAdopted] = useState<{ mountedAtAbsolute: number } | null>(null);

  useEffect(() => {
    if (initialNow !== undefined) return; // pinned: never touch the wall clock
    /*
     * ⚠️ **`react-hooks/set-state-in-effect` IS DISABLED HERE ON PURPOSE, AND THE RULE IS RIGHT
     * ABOUT ALMOST EVERY OTHER EFFECT IN THIS TREE.** It fires because a synchronous `setState` in
     * an effect body normally means state that could have been derived during render — a cascading
     * render for nothing.
     *
     * **This is the one case where deriving it during render is the DEFECT.** The wall clock is a
     * value the server and the client disagree about by construction, so reading it during render
     * is precisely what made every ward route capable of failing hydration. The adoption has to
     * happen after the first paint or it is not a fix at all.
     *
     * It costs exactly one extra render, once per mount, before any interaction is possible — and
     * removing the disable by restructuring would reintroduce the mismatch it exists to close. If a
     * future change makes the clock deterministic across server and client, delete the effect
     * rather than the comment.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above: the wall clock cannot be read during render without breaking hydration
    setAdopted({ mountedAtAbsolute: absoluteWallClockMinutes() });
  }, [initialNow]);

  /*
   * 🔴 **DETERMINISM FIX — the live demo no longer adopts the wall clock's minute of day.** Before
   * this, `anchorOffsetMinutes` was `wallClockNow() - NOW_ANCHOR`, so the seeded world remounted
   * onto the real wall clock and "Board time" flipped non-deterministically between the pinned demo
   * anchor (10:42) and whatever the machine's clock read (e.g. 22:45). The live demo now keeps
   * `anchorOffsetMinutes` at 0, so `now = NOW_ANCHOR + elapsed` — it ticks forward in REAL TIME from
   * the scenario anchor instead of jumping to the wall clock. Only a pinned `initialNow` (tests,
   * screenshots, contract walks) sets a non-zero offset, and that path is unchanged. `adopted` above
   * now carries ONLY `mountedAtAbsolute` — the baseline `elapsed` is measured from — never an anchor
   * offset.
   */
  const anchorOffsetMinutes = initialNow !== undefined ? initialNow - NOW_ANCHOR : 0;

  /**
   * 🔴 **NO `key` HERE — ADOPTION NO LONGER REMOUNTS THE TREE (open item 5, 3 Oct 2026).** Until
   * then this element was keyed `adopted !== null ? "live" : "pinned"`, so the mount effect above
   * flipped the key and React threw away and rebuilt the WHOLE layout (rail, bar, every screen) about
   * a second after load. PR #31 measured it: the server-rendered shell was replaced by a fresh copy,
   * so a click or a half-typed entry landing in that window went to a node about to be discarded.
   * The only reason for the remount was to re-run `useReducer`'s initialiser so a saved session
   * could be restored after hydration. `WardFlowWorld` now does that restore in its own mount
   * effect, through a private reducer action. A first visit, or a reload with nothing changed, keeps
   * every node. Only a reload of a day that was actually changed remounts the screens (not the
   * provider), because screens seed one-time drafts from provider data and must reseed from the
   * restored day; that is the same remount as before, now confined to the case that needs it.
   */
  return (
    <WardFlowWorld
      anchorOffsetMinutes={anchorOffsetMinutes}
      mountedAtAbsolute={adopted?.mountedAtAbsolute ?? null}
      initialNow={initialNow}
    >
      {children}
    </WardFlowWorld>
  );
}

function WardFlowWorld({
  children,
  initialNow,
  anchorOffsetMinutes,
  mountedAtAbsolute,
}: WardFlowProviderProps & { anchorOffsetMinutes: number; mountedAtAbsolute: number | null }) {
  /**
   * How far the demo's day sits from the day the fixture was authored on. Read ONCE, at mount, so
   * every instant the app shows moves together; re-reading it per render would let the seed and the
   * clock drift apart between two renders of the same screen.
   *
   * Zero on the pinned path. A deterministic render (tests, screenshots, contract walks) keeps the
   * frozen 10:42 night the fixture was measured against, which is what lets 53 test files assert
   * against it without depending on the hour the suite happens to run.
   */
  //
  // 🔴 THIS READ `initialNow !== undefined ? 0 : …` UNTIL 2026-08-30 — the prop was accepted and its
  // VALUE was never used, here or anywhere else. All three reads of it were `!== undefined`, so a
  // caller pinning the clock to any instant other than `NOW_ANCHOR` silently got `NOW_ANCHOR`.
  // Nothing was wrong the day it was found: all ~85 call sites pass `NOW_ANCHOR` or
  // `WARD_ADMISSIONS_ANCHOR`, and both constants are `10 * 60 + 42`. The seed-default class with the
  // trigger not yet pulled. Reported by Ward Referrals.
  //
  /**
   * The moment this session opened, and the day 0 that every `Instant` counts from. Captured once:
   * two components deriving it separately would disagree across midnight, which is the
   * two-clocks-on-one-card failure a layer down.
   *
   * Audit finding ISSUE-P1-83, defect 3b: the session restore needs today's `dayZero` to decide
   * whether a saved session still describes today's world. Since 3 Oct 2026 that restore runs in
   * the adoption effect below rather than in the reducer's initialiser, which reads it from here.
   *
   * `useState`'s lazy initialiser (not a `useRef` guarded by its own `.current` check, which this
   * was until `react-hooks/refs` — 2026-09-17 — pointed out that reading `.current` here, and in
   * everything downstream that closes over it (the reducer's own initialiser, and the context
   * `value` this component returns), is a read of a ref's value during render) gives the exact
   * same "computed exactly once per mount, then stable for the life of the mount" guarantee,
   * without ever touching a ref.
   */
  const [dayZero] = useState<Date>(() => demoDayZero(new Date()));

  // `trackWardFlowTypedTextDispatch` is a plain top-level function — pure, no closure over any
  // per-mount ref — so it can be passed directly; its own identity being stable or not is
  // irrelevant to `useReducer`, which always calls whatever function is currently passed. Pinned
  // and live `now` take the same shape — the offset is *the now we want* minus the anchor, wherever
  // that now came from. `initialNow === NOW_ANCHOR` is offset zero, which is exactly the old
  // behaviour, which is why no existing suite moves.
  const [container, dispatchContainer] = useReducer(
    wardFlowContainerReducer,
    anchorOffsetMinutes,
    // A pinned `now` never reads a saved session, so it starts adopted and holds no replay queue.
    (offset): WardFlowContainer => ({
      world: seedWardFlowStateAt(offset),
      typedTextSeen: false,
      restoredElapsed: 0,
      sessionAdopted: initialNow !== undefined,
    }),
  );
  const state = container.world;
  // Screens dispatch only `WardFlowEvent`s; the file-load action stays internal to this provider.
  const dispatch = useCallback<Dispatch<WardFlowEvent>>(
    (event: WardFlowEvent) => {
      dispatchContainer(event);
      if (typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("ward-flow-sync");
          channel.postMessage({ type: "WARD_FLOW_DISPATCH", eventType: event.type });
          channel.close();
        } catch {
          // BroadcastChannel unavailable in this environment
        }
      }
    },
    [dispatchContainer],
  );
  // Every ward lookup follows the scenario on screen: the EMHS demo and surge scenarios carry their
  // own wards (`ward-scenarios.ts`). Idempotent, and done before any child renders.
  activateScenarioNetwork(state.scenario);
  // The due-time warnings follow Settings (Josh, 26 Sept 2026, question 3) the same way: applied
  // before any child renders, idempotent. A configuration saved before these keys existed has
  // neither, so the defaults stand in.
  applyDueSoonThresholds(
    state.configuration.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
    state.configuration.dueSoonMinutes ?? DUE_SOON_MINUTES,
  );
  // Monotonic across reducer resets; remount destroys the allocator and consumer subtree together.
  // Audit finding ISSUE-P1-83, defect 3c: seeded from the restored (or freshly-seeded) state's own
  // audit log rather than always 0 — see `nextOpenRequestSequence`'s own doc comment for why
  // restarting at 0 after a restore is a replay-collision waiting to happen. `useRef`'s argument is
  // only ever consulted on this component's first render, so recomputing it here costs nothing on
  // every later render and stays correct exactly once, which is the only time it matters.
  const openRequestSequence = useRef(nextOpenRequestSequence(state.auditEvents));

  /**
   * Minutes since the epoch at mount, carrying the DATE and not only the time of day.
   *
   * This is what removed the midnight workaround rather than improving it. `wallClockNow()` returns
   * 0-1439, so two readings cannot say how many days apart they are: the old code assumed a negative
   * difference meant exactly one rollover, which held only because it re-read every thirty seconds,
   * and needed a running accumulator so a session spanning several midnights did not reset to zero.
   * An absolute count makes elapsed time a plain subtraction that is correct over any span, and the
   * whole class of bug disappears rather than being handled.
   */
  // Board and event callers share one 30s tick. A separate board-only clock left
  // event callers recording the time of the last unrelated state change.
  // A pinned `initialNow` (tests, deterministic renders) never touches the wall clock, and neither
  // does the render before the mount effect has adopted it — `mountedAtAbsolute` is null until then,
  // and reading the clock against a null baseline is exactly the non-determinism this split removes.
  const elapsed =
    initialNow !== undefined || mountedAtAbsolute === null ? 0 : absoluteWallClockMinutes() - mountedAtAbsolute;

  const now =
    NOW_ANCHOR + anchorOffsetMinutes + container.restoredElapsed + Math.max(0, elapsed) + state.clockOffsetMinutes;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (initialNow !== undefined || mountedAtAbsolute === null) return;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextTick = () => {
      const nowMs = Date.now();
      const remainder = nowMs % 30_000;
      // Schedule against the upcoming 30s mark (:00 and :30), ensuring clean top-of-minute flips
      const delay = remainder === 0 ? 30_000 : 30_000 - remainder;
      timeoutTimer = setTimeout(() => {
        setTick((tick) => tick + 1);
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setTick((tick) => tick + 1);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        scheduleNextTick();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialNow, mountedAtAbsolute]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") return;
    try {
      const channel = new BroadcastChannel("ward-flow-sync");
      channel.onmessage = (messageEvent) => {
        if (messageEvent.data?.type === "WARD_FLOW_DISPATCH") {
          setTick((tick) => tick + 1);
        }
      };
      return () => {
        channel.close();
      };
    } catch {
      return undefined;
    }
  }, []);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  /**
   * Restores a saved same-day session once the mount effect in `WardFlowProvider` has supplied
   * `mountedAtAbsolute`. The restored state arrives through the reducer. The screens are re-keyed
   * (remounted) once only when the restored day differs from the seed — see the `Fragment` key in
   * the render below; a first visit or an unchanged reload keeps every node. Runs once per mount;
   * `sessionAdopted` gates the storage write below until it has run.
   */
  useEffect(() => {
    if (initialNow !== undefined || mountedAtAbsolute === null) return;
    const { saved, recoveryNotice } = tryReadDemoState(dayZero, mountedAtAbsolute);
    // Never move the allocator backwards: a record opened before adoption already used its number.
    if (saved)
      openRequestSequence.current = Math.max(
        openRequestSequence.current,
        nextOpenRequestSequence(saved.state.auditEvents),
      );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- display the outcome of the external storage read
    if (recoveryNotice === STORAGE_UNAVAILABLE) setStorageUnavailable(true);
    dispatchContainer({
      type: "ADOPT_SAVED_SESSION",
      [ADOPT_SESSION]: (current) => {
        if (current.sessionAdopted) return current;
        if (saved) {
          const restoredElapsed =
            saved.now - NOW_ANCHOR - saved.state.clockOffsetMinutes + mountedAtAbsolute - saved.savedAtAbsolute;
          // A saved day identical to the seed already on screen (nothing was changed before the
          // reload) only moves the clock; the screens keep their nodes and their state.
          if (JSON.stringify(saved.state) === JSON.stringify({ ...current.world, rejections: [] }))
            return { ...current, restoredElapsed, sessionAdopted: true, preAdoptionEvents: undefined };
          // Anything dispatched before adoption is replayed on the restored day through the same
          // tracker, so its log entry and typed-text lock survive, and a now-stale action is refused
          // on screen rather than lost.
          let restored: WardFlowContainer = {
            world: saved.state,
            typedTextSeen: false,
            restoredElapsed,
            sessionAdopted: true,
            sessionRestored: true,
          };
          for (const event of current.preAdoptionEvents ?? [])
            restored = trackWardFlowTypedTextDispatch(restored, event);
          return restored;
        }
        // The rejected or unreadable save leaves the first-render seed in place, with its notice.
        if (recoveryNotice) return { ...current, recoveryNotice, sessionAdopted: true, preAdoptionEvents: undefined };
        return { ...current, sessionAdopted: true, preAdoptionEvents: undefined };
      },
    });
    // A downtime pack taken from the first-render seed no longer describes a restored day. Forget
    // it here, after the dispatch and outside the updater (an updater must stay pure): the open
    // downtime screen is told and takes a fresh pack from the restored world, whether or not the
    // tree is re-keyed below. A saved day identical to the seed only costs a retaken snapshot.
    if (saved) forgetDowntimePack();
  }, [initialNow, mountedAtAbsolute, dayZero]);

  const [focusMovementId, setFocusMovementId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (initialNow !== undefined || mountedAtAbsolute === null || !container.sessionAdopted) return;
    // Default deny, locked on dispatch (see `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`'s own comment): once
    // this session has DISPATCHED one typed-text-carrying event — accepted or refused — storage is
    // cleared immediately and never written to again until a genuine reseed re-enables it — checked
    // every render this effect runs, not only the render the flag first flips, so a later dispatch
    // cannot slip a write in underneath it. `container.typedTextSeen` is read here exactly as
    // `state` is: both come from the same COMMITTED `useReducer` value, never a ref
    // (`trackWardFlowTypedTextDispatch`'s own comment has the race this closes).
    if (container.typedTextSeen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- display the outcome of the external storage operation
      if (!clearWardFlowDemoState()) setStorageUnavailable(true);
      return;
    }
    if (storageUnavailable) return;
    if (!tryWriteDemoState(state, dayZero, now, mountedAtAbsolute + Math.max(0, elapsed))) setStorageUnavailable(true);
  }, [
    state,
    container.typedTextSeen,
    container.sessionAdopted,
    initialNow,
    mountedAtAbsolute,
    dayZero,
    now,
    elapsed,
    storageUnavailable,
  ]);

  // Audit finding ISSUE-P1-83, defect 3e: `useCallback`, not a fresh function every render — this
  // sits in the `value` useMemo's own dependency array below, so an unstable reference defeated that
  // memo on every render regardless of whether anything the memo actually reads had changed.
  const resetDemoState = useCallback(() => {
    clearWardFlowDemoState();
    dispatch({ type: "RESET_SCENARIO", role: "demo", now });
  }, [dispatch, now]);

  const saveScenarioFile = useCallback(
    () => buildScenarioFile(state, now, WARD_FLOW_DEMO_STORAGE_VERSION, new Date()),
    [state, now],
  );

  const loadScenarioFile = useCallback(
    (text: string): { ok: true } | { ok: false; reason: string } => {
      const read = readScenarioFile(text, WARD_FLOW_DEMO_STORAGE_VERSION);
      if (!read.ok) return read;
      if (read.now < NOW_ANCHOR + read.state.clockOffsetMinutes)
        return { ok: false, reason: "This scenario file is damaged or incomplete, so nothing was loaded." };
      // The clock resumes at the file's own scenario time: `now` is rebuilt from the same parts the
      // render uses, so the elapsed term is read fresh rather than from the last 30s tick.
      const elapsedNow =
        initialNow !== undefined || mountedAtAbsolute === null ? 0 : absoluteWallClockMinutes() - mountedAtAbsolute;
      const base = NOW_ANCHOR + anchorOffsetMinutes + Math.max(0, elapsedNow);
      // A new generation, as a reseed does, so every screen keyed on it drops drafts and
      // selections that belonged to the world being replaced.
      const world: WardFlowState = {
        ...read.state,
        worldGeneration: Math.max(state.worldGeneration, read.state.worldGeneration) + 1,
      };
      // Continue past every record-request id either world has used (`nextOpenRequestSequence`).
      openRequestSequence.current = Math.max(openRequestSequence.current, nextOpenRequestSequence(world.auditEvents));
      dispatchContainer({
        type: "LOAD_SCENARIO_FILE_INTERNAL",
        world,
        restoredElapsed: read.now - read.state.clockOffsetMinutes - base,
      });
      return { ok: true };
    },
    [state.worldGeneration, initialNow, mountedAtAbsolute, anchorOffsetMinutes],
  );

  const value = useMemo<WardFlowContextValue>(
    () => ({
      worldGeneration: state.worldGeneration,
      sessionAdopted: container.sessionAdopted === true,
      recordWardDeparture: (admissionId, actingUnitId, leavingDestination) => {
        const read = selectDischargeRecord(state, { role: "ward", actingUnitId }, admissionId);
        if (read.status === "allowed" && read.value.identity.kind === "legacy-anonymous") {
          dispatch({ type: "RECORD_LEAVING", role: "ward", now, admissionId, actingUnitId, leavingDestination });
          return;
        }
        dispatch({
          type: "RECORD_PATIENT_DISCHARGE",
          role: "ward",
          now,
          admissionId,
          actingUnitId,
          leavingDestination,
          patientId:
            read.status === "allowed" && read.value.identity.kind === "linked"
              ? read.value.identity.patient.id
              : "PT-unresolved",
          expectedGeneration: state.worldGeneration,
          expectedRevision: state.dischargeRevisions[admissionId] ?? 0,
        });
      },
      readDischargeRecords: (actor, unitId) => selectDischargeRecords(state, actor, unitId),
      readDischargeRecord: (actor, admissionId, handle) => readOpenedDischargeRecord(state, actor, admissionId, handle),
      readAuditEvents: (actor) => readAuditEvents(state, actor),
      readAuditReviews: (actor) => readAuditReviews(state, actor),
      openDischargeRecord: (actor, admissionId) => {
        if (!safeCounter(openRequestSequence.current) || openRequestSequence.current >= Number.MAX_SAFE_INTEGER)
          throw new Error("Record request allocation unavailable");
        const handle = { generation: state.worldGeneration, requestId: openRequestSequence.current++ };
        const declaredActor = validRecordActor(actor) ? actor : { role: "demo" as const };
        dispatch({
          ...declaredActor,
          type: "OPEN_DISCHARGE_RECORD",
          now,
          admissionId,
          expectedGeneration: handle.generation,
          requestId: handle.requestId,
        });
        return handle;
      },
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      wardReferralInbox: (unitId: string) => wardReferralInboxEntries(state.referrals, unitId),
      rejections: state.rejections,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      refreshRequests: state.refreshRequests,
      handoverSignOffs: Array.isArray(state.handoverSignOffs) ? state.handoverSignOffs : [],
      inboxAcknowledgements: state.inboxAcknowledgements,
      inboxCompletions: state.inboxCompletions,
      inboxOwnership: state.inboxOwnership,
      inboxSnoozes: state.inboxSnoozes,
      notices: state.notices,
      morningRollupConfirmations: state.morningRollupConfirmations,
      resolvePatientIdentity: (subject) =>
        resolveSubjectPatient(subject, {
          patients: state.patients,
          referrals: state.referrals,
          movements: state.movements,
          // A stay converted from an initials-only booking is named through that booking.
          plannedAdmissions: state.plannedAdmissions,
        }),
      patients: state.patients,
      admissions: state.admissions,
      now,
      dayZero,
      scenario: state.scenario,
      configuration: state.configuration,
      broadcastAlerts: state.broadcastAlerts ?? [],
      plannedAdmissions: state.plannedAdmissions ?? [],
      supportNotifications: state.supportNotifications ?? [],
      eventLog: container.eventLog ?? [],
      dispatch,
      focusMovementId,
      setFocusMovementId,
      resetDemoState,
      saveScenarioFile,
      loadScenarioFile,
    }),
    [
      // Individual `state.movements`/`state.patients`/`state.inboxAcknowledgements`/
      // `state.configuration`/etc. entries used to sit here too, added one at a time (2026-08-30,
      // 2026-09-08, 2026-09-16) after each was found MISSING and caught a real stale-memo defect —
      // a patient or an acknowledgement or a configuration change landing mid-session was memoised
      // away. `state` alone is enough: `wardFlowReducer` (`ward-flow-reducer.ts`) always returns
      // either the SAME `state` reference (a refused/no-op event) or a freshly spread one, never a
      // mutated one, so every field below is already covered by `state` itself changing reference —
      // `react-hooks/exhaustive-deps` flagged the individual fields as redundant once `state` was
      // added, not as a reason to remove `state` and go back to naming fields one at a time.
      state,
      container.sessionAdopted,
      // The log grows even when an event leaves `state` untouched (a no-op), so it is its own dep.
      container.eventLog,
      now,
      dayZero,
      dispatch,
      focusMovementId,
      resetDemoState,
      saveScenarioFile,
      loadScenarioFile,
    ],
  );

  return (
    <WardFlowContext.Provider value={value}>
      {(storageUnavailable || container.recoveryNotice) && (
        <p role="status">{storageUnavailable ? STORAGE_UNAVAILABLE : container.recoveryNotice}</p>
      )}
      <WardFlowClockContext.Provider value={now}>
        {/*
         * Remounts the screens once, and only when a saved day that differs from the seed was
         * restored: screens initialise drafts and selections from provider data once
         * (`settings-screen.tsx`'s rules draft, the placement workspace's first patient), so they
         * must start again from the restored world rather than keep the seed's. A first visit, or a
         * reload with nothing changed, never takes this path, so its tree is never rebuilt.
         */}
        <Fragment key={container.sessionRestored ? "restored" : "seed"}>{children}</Fragment>
      </WardFlowClockContext.Provider>
    </WardFlowContext.Provider>
  );
}

export function WardFlowClockProvider({
  children,
  initialNow,
  anchorOffsetMinutes,
  mountedAtAbsolute,
  clockOffsetMinutes,
}: {
  children: ReactNode;
  initialNow?: Instant;
  anchorOffsetMinutes: number;
  mountedAtAbsolute: number | null;
  clockOffsetMinutes: number;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (initialNow !== undefined) return; // pinned: never tick in a test
    const id = setInterval(() => setTick((previous) => previous + 1), 30_000);
    return () => clearInterval(id);
  }, [initialNow]);

  const elapsed =
    initialNow !== undefined || mountedAtAbsolute === null ? 0 : absoluteWallClockMinutes() - mountedAtAbsolute;

  const now = NOW_ANCHOR + anchorOffsetMinutes + elapsed + clockOffsetMinutes;

  return <WardFlowClockContext.Provider value={now}>{children}</WardFlowClockContext.Provider>;
}

/** Conservative failure: a screen rendered outside the provider must fail loudly, never fall
 * back to a default empty world that would silently read as "no patients tonight". */
export function useWardFlow(): WardFlowContextValue {
  const context = useContext(WardFlowContext);
  if (!context) throw new Error("useWardFlow must be used within WardFlowProvider.");
  return context;
}

export function useWardFlowClock(fallback?: Instant): Instant {
  const clock = useContext(WardFlowClockContext);
  const wardFlow = useContext(WardFlowContext);
  if (clock !== null) return clock;
  if (wardFlow) return wardFlow.now;
  if (fallback !== undefined) return fallback;
  throw new Error("useWardFlowClock must be used within WardFlowProvider.");
}
