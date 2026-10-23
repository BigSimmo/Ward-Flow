"use client";

import { whenStreamRevealed } from "./when-stream-revealed";
import { localCommandOutcome, useLocalCommandCompletion, type LocalCommandState } from "./use-local-command-completion";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";

import { WardDemoNotSavedContext } from "@/components/ward-management/shell/ward-demo-saving";
import { WardRecoveryNoticeContext } from "@/components/ward-management/shell/ward-recovery-notice";
import { ToastDeviceSaveContext } from "@/components/wf";
import { clearReferralDraftSession } from "./referrals/referral-draft-lifecycle";
import { seedSafeSenderId, useOpenTabsDay } from "./ward-flow-open-tabs-day";
import { clearLegacySessionDrafts, setDraftScenarioScope } from "./ward-session-drafts";
import { wardReferralInboxEntries, type WardReferralInboxEntry } from "./referrals/referral-inbox";
import type { LeavingDestination } from "./ward-admissions";
import { communityScopedReferrals, communitySentView, type CommunityScopedReferral } from "./ward-referral-visibility";

import {
  type Context,
  createContext,
  type Dispatch,
  Fragment,
  type ReactNode,
  type SetStateAction,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  newDischargeRequestNamespace,
  type DischargeOpenHandle,
  type DischargeRecord,
  type RecordRead,
  type WardRecordActor,
} from "./ward-discharge-records";
import {
  readAuditEvents,
  readAuditReviews,
  readGovernanceAuditEvents,
  type AuditEvent,
  type AuditReview,
} from "./ward-audit";
import { forgetDowntimePack } from "./reports/downtime-pack";

import {
  absoluteWallClockMinutes,
  demoDayZero,
  type DueSoonThresholds,
  dueSoonThresholdsOf,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  clearWardFlowDemoState,
  buildScenarioFileLater,
  deviceCopyOf,
  loadTypedTextScrub,
  readDemoStateLater,
  readScenarioFileLater,
  STORAGE_UNAVAILABLE,
  tryWriteDemoState,
  useDemoStateRead,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "./ward-flow-demo-storage";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "./ward-patient-resolver";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { BroadcastAlert } from "./alerts/ward-broadcast-model";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type HandoverSignOffRecord,
  type RepatriationRecord,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type {
  BedRelease,
  CapacityRefreshRequest,
  LeaveBed,
  Movement,
  Referral,
  Rejection,
  Unit,
} from "@/components/ward-management/ward-model";
import { activeWardNetwork, NOW_ANCHOR, type WardNetwork } from "@/components/ward-management/ward-sites";
import {
  activateScenarioNetwork,
  scenarioWardNetwork,
  WARD_SCENARIOS,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { eventLogEntryFor, type EventLogEntry } from "@/components/ward-management/ward-event-log";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  eventCarriesTypedTextPayload,
  WARD_FLOW_TYPED_TEXT_EVENT_TYPES,
  findWardFlowEventTypeCoverageGaps,
  type AssertNever,
  type UnreviewedStringOrUnknownKeys,
} from "@/components/ward-management/ward-flow-persistence-classification";
import type { ScenarioFileBuild } from "@/components/ward-management/ward-flow-scenario-file";
import { useWardShared, WardSharedAccess, type WardSharedConnection } from "./ward-shared-access";
import {
  broadcastDispatchEvent,
  getOrCreateBroadcastInstanceId,
  nextOpenRequestSequence,
} from "./ward-flow-provider-helpers";

/**
 * The provider owns reducer state, session recovery and the shared connection. Public hooks
 * expose state fields or recipient projections. Focus is shared UI navigation state;
 * it never enters the reducer or an event.
 */
type WardFlowContextValue = {
  worldGeneration: number;
  /** True once the saved session has been read (or declined). Before then the world is the seed. */
  sessionAdopted: boolean;
  recordWardDeparture(
    admissionId: string,
    actingUnitId: string,
    leavingDestination: LeavingDestination,
  ): ReturnType<WardCommandDispatch>;
  readDischargeRecords(actor: WardRecordActor, unitId?: string): RecordRead<readonly DischargeRecord[]>;
  openDischargeRecord(actor: WardRecordActor, admissionId: string): DischargeOpenHandle;
  readDischargeRecord(
    actor: WardRecordActor,
    admissionId: string,
    handle: DischargeOpenHandle | null,
  ): RecordRead<DischargeRecord>;
  readAuditEvents(actor: WardRecordActor): RecordRead<readonly AuditEvent[]>;
  /** v10 pass 2: `readAuditEvents` plus the synthetic seeded governance entries, for Governance. */
  readGovernanceAuditEvents?(actor: WardRecordActor): RecordRead<readonly AuditEvent[]>;
  readAuditReviews(actor: WardRecordActor): RecordRead<readonly AuditReview[]>;
  movements: Movement[];
  units: Unit[];
  /** Task 5 (Phase 7, "The front door"): the referral board and match view need every front-door
   *  referral, live from reducer state — the same reasoning `bedReleases`/`leaveBeds` below
   *  already document for their own collections. Previously omitted: the intake form's own
   *  success banner (since retired; the referral slide-out replaced it) could not echo the referral it had just raised,
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
  refreshRequests: CapacityRefreshRequest[];
  /** Handover sign-offs, role and time only (`RECORD_HANDOVER_SIGN_OFF`). Read by the Handover page's History. */
  handoverSignOffs: HandoverSignOffRecord[];
  /** Phone-logged repatriations (`RECORD_REPATRIATION`), read by the Out of area page's return status.
   *  Optional so hand-built test contexts need not supply it. */
  repatriations?: RepatriationRecord[];
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
  /** Undo records, read-only: a toast's Undo names the exact step it was offered for. */
  undoRecords?: WardFlowState["undoRecords"];
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
  dispatch: WardCommandDispatch;
  focusMovementId: string | undefined;
  setFocusMovementId: Dispatch<SetStateAction<string | undefined>>;
  resetDemoState: () => void;
  /** Demo scenario files (`ward-flow-scenario-file.ts`): the whole synthetic world as a file the
   *  presenter downloads, and a loader that replaces this world with one read back from a file.
   *  Optional so hand-built test contexts need not supply them. */
  saveScenarioFile?: () => Promise<ScenarioFileBuild>;
  loadScenarioFile?: (text: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** False when the D-18 free-text privacy lock (or storage unavailability) has paused device saving. */
  savingOnDevice?: boolean;
  /** Shared workspace connection status and error for forms that must await shared save completion. */
  shared?: {
    enabled: boolean;
    status: WardSharedConnection["status"];
    error: string | null;
  };
  /** False when the shared workspace has switched demo controls off. Optional for test contexts. */
  demoControlsAvailable?: boolean;
};

export type { WardFlowContextValue };
/** The whole value in one object. Every reader re-renders on every change and every clock tick, so
 *  screens read through `useWardFlowSelect` instead; this stays for whole-value readers and tests. */
export const WardFlowContext = createContext<WardFlowContextValue | null>(null);
export const WardFlowClockContext = createContext<Instant | null>(null);
const WardClockContext = createContext<Instant | null>(null);

export type WardFlowKey = keyof WardFlowContextValue;

/**
 * Every field of the value, each in its own context (fix list 1.2 and 7.1, 15 Oct 2026). A screen
 * that reads `movements` and `now` re-renders when either changes, and not when an acknowledgement,
 * the event log or a far-off collection changes. The compile-time check below fails if a field is
 * added to `WardFlowContextValue` without a context here.
 */
const WARD_FLOW_KEY_SET = {
  worldGeneration: true,
  sessionAdopted: true,
  recordWardDeparture: true,
  readDischargeRecords: true,
  openDischargeRecord: true,
  readDischargeRecord: true,
  readAuditEvents: true,
  readGovernanceAuditEvents: true,
  readAuditReviews: true,
  movements: true,
  units: true,
  referrals: true,
  wardReferralInbox: true,
  rejections: true,
  bedReleases: true,
  leaveBeds: true,
  refreshRequests: true,
  handoverSignOffs: true,
  repatriations: true,
  inboxAcknowledgements: true,
  inboxCompletions: true,
  inboxOwnership: true,
  inboxSnoozes: true,
  undoRecords: true,
  notices: true,
  morningRollupConfirmations: true,
  resolvePatientIdentity: true,
  patients: true,
  admissions: true,
  now: true,
  dayZero: true,
  scenario: true,
  configuration: true,
  broadcastAlerts: true,
  plannedAdmissions: true,
  supportNotifications: true,
  eventLog: true,
  dispatch: true,
  focusMovementId: true,
  setFocusMovementId: true,
  resetDemoState: true,
  saveScenarioFile: true,
  loadScenarioFile: true,
  savingOnDevice: true,
  demoControlsAvailable: true,
  shared: true,
} as const satisfies Record<WardFlowKey, true>;
const WARD_FLOW_KEYS = Object.keys(WARD_FLOW_KEY_SET) as WardFlowKey[];

/** Marks a field context with no provider above it, as distinct from a field whose value is undefined. */
const NO_WARD_FLOW_PROVIDER: unique symbol = Symbol("no-ward-flow-provider");
type WardFlowFieldContexts = { [K in WardFlowKey]: Context<WardFlowContextValue[K] | typeof NO_WARD_FLOW_PROVIDER> };
const WARD_FLOW_FIELD_CONTEXTS = Object.fromEntries(
  WARD_FLOW_KEYS.map((key) => {
    const context = createContext<unknown>(NO_WARD_FLOW_PROVIDER);
    context.displayName = `WardFlow.${key}`;
    return [key, context];
  }),
) as unknown as WardFlowFieldContexts;

/** Provides each field of `value` through its own context, around `children`. */
function WardFlowFieldProviders({ value, children }: { value: WardFlowContextValue; children: ReactNode }) {
  let tree = children;
  for (const key of WARD_FLOW_KEYS) {
    const FieldContext = WARD_FLOW_FIELD_CONTEXTS[key] as Context<unknown>;
    tree = <FieldContext.Provider value={value[key]}>{tree}</FieldContext.Provider>;
  }
  return tree;
}

/**
 * Replaces part of the value for one subtree, for both whole-value and field readers. A bare
 * `WardFlowContext.Provider` inside the real provider would reach only whole-value readers, so every
 * override goes through this instead (the coordinator cockpit's coordinator-role dispatch, tests).
 */
export function WardFlowOverride({ value, children }: { value: WardFlowContextValue; children: ReactNode }) {
  return (
    <WardFlowContext.Provider value={value}>
      <WardFlowFieldProviders value={value}>{children}</WardFlowFieldProviders>
    </WardFlowContext.Provider>
  );
}

function pickWardFlow<K extends WardFlowKey>(
  value: WardFlowContextValue,
  keys: readonly K[],
): Pick<WardFlowContextValue, K> {
  const picked = {} as Pick<WardFlowContextValue, K>;
  for (const key of keys) picked[key] = value[key];
  return picked;
}

/**
 * The named fields only, re-rendering when one of them changes. `null` outside any provider.
 *
 * `configuration` and `scenario` are always read as well, even when not named. The scenario points
 * the module-wide ward lookups at its network during the provider's render (`activateScenarioNetwork`),
 * which many derivations read without naming it, so every reader must still re-render when it
 * changes. `configuration` doubles as the check for a real provider. Both change rarely, so this
 * costs nothing in ordinary use.
 *
 * A hand-built `WardFlowContext.Provider` with no `WardFlowProvider` (some tests) has no field
 * contexts, so the whole value is read from it instead.
 */
export function useOptionalWardFlowSelect<K extends WardFlowKey>(
  ...keys: readonly K[]
): Pick<WardFlowContextValue, K> | null {
  if (use(WARD_FLOW_FIELD_CONTEXTS.configuration) === NO_WARD_FLOW_PROVIDER) {
    const whole = use(WardFlowContext);
    return whole ? pickWardFlow(whole, keys) : null;
  }
  use(WARD_FLOW_FIELD_CONTEXTS.scenario);
  const picked = {} as Pick<WardFlowContextValue, K>;
  for (const key of keys) picked[key] = use(WARD_FLOW_FIELD_CONTEXTS[key]) as WardFlowContextValue[K];
  return picked;
}

/** `useWardFlow()` narrowed to the named fields: `const { movements, now } = useWardFlowSelect("movements", "now")`. */
export function useWardFlowSelect<K extends WardFlowKey>(...keys: readonly K[]): Pick<WardFlowContextValue, K> {
  const picked = useOptionalWardFlowSelect(...keys);
  if (!picked) throw new Error("useWardFlow must be used within WardFlowProvider.");
  return picked;
}

// `use`, not `useContext`, so a reader that finds the first clock never subscribes to the next
// context, in particular never to the whole `WardFlowContext` and its every change.
export function useWardClock(fallback?: Instant): Instant {
  const clock = use(WardClockContext);
  if (clock !== null) return clock;
  const flowClock = use(WardFlowClockContext);
  if (flowClock !== null) return flowClock;
  const wardFlow = use(WardFlowContext);
  if (wardFlow) return wardFlow.now;
  if (fallback !== undefined) return fallback;
  throw new Error("useWardClock must be used within WardFlowProvider.");
}

const EMPTY_ARRAY = Object.freeze([]) as never[];

type WardFlowProviderProps = {
  children: ReactNode;
  /**
   * Pins the clock at this instant and stops it from ticking. Tests and any deterministic
   * render (screenshots, contract walks) pass this; the live app omits it so the clock reads
   * the wall clock once at mount and then advances only via the 30s tick interval, never by
   * re-reading the wall clock on every render.
   */
  initialNow?: Instant;
  /** Perth midnight captured by the server layout, reused by the client's first render. Epoch ms
   *  keeps the boundary serialisable. Client-only/test mounts can omit it. */
  initialDayZero?: number;
};

export { clearWardFlowDemoState, WARD_FLOW_DEMO_STORAGE_KEY };
export { WARD_FLOW_TEXT_SAFE_EVENT_TYPES, WARD_FLOW_TYPED_TEXT_EVENT_TYPES, findWardFlowEventTypeCoverageGaps };
export type { AssertNever, UnreviewedStringOrUnknownKeys };

/**
 * The `useReducer` state this provider actually carries: the real reducer's world, plus one flag no
 * reducer case ever reads and only `trackWardFlowTypedTextDispatch` below ever writes.
 */
type WardFlowContainer = {
  sharedRevision?: number;
  sharedAccessContext?: string; // Adopted with the world before remounting desk forms.
  world: WardFlowState;
  typedTextSeen: boolean;
  /** The typed-text events dispatched this session (memory only; their values are read when the
   *  device copy is made), and whether the world came from a scenario file, whose typed values this
   *  session never saw. */
  typedTextEvents?: readonly WardFlowEvent[];
  typedTextFromFile?: boolean;
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
  earlyOutcomes?: readonly { event: WardFlowEvent; outcome: Omit<WardCommandOutcome, "commandId"> }[];
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

function syncWorldGlobals(world: WardFlowState): void {
  activateScenarioNetwork(world.scenario);
}

function wardFlowContainerReducer(
  container: WardFlowContainer,
  action: WardFlowEvent | AdoptSessionAction | LoadScenarioFileAction,
): WardFlowContainer {
  if (ADOPT_SESSION in action) {
    const adopted = action[ADOPT_SESSION](container);
    syncWorldGlobals(adopted.world);
    return adopted;
  }
  if (action.type === "LOAD_SCENARIO_FILE_INTERNAL") {
    syncWorldGlobals(action.world);
    // A loaded world may hold typed text, so it is treated as a session that has typed: the device
    // copy replaces every typed field (D-18, `ward-flow-typed-text-scrub.ts`), so it survives a
    // refresh. It also counts as adopted, so a late browser restore can never replace it.
    return {
      ...container,
      world: action.world,
      typedTextSeen: true,
      typedTextFromFile: true,
      restoredElapsed: action.restoredElapsed,
      eventLog: [],
      recoveryNotice: undefined,
      sessionAdopted: true,
      preAdoptionEvents: undefined,
      earlyOutcomes: (container.earlyOutcomes ?? []).map(({ event }) => ({
        event,
        outcome: {
          status: "cancelled" as const,
          message:
            "The scenario was replaced before the action could be restored. Review the loaded board before trying again.",
        },
      })),
    };
  }
  const next = trackWardFlowTypedTextDispatch(container, action);
  syncWorldGlobals(next.world);
  if (container.sessionAdopted) return next;
  return { ...next, preAdoptionEvents: [...(container.preAdoptionEvents ?? []), action] };
}

/**
 * Wraps the real reducer to also track whether this session has DISPATCHED — not merely had
 * accepted — an event carrying human-typed text, and which typed values it carried.
 *
 * 1. **On DISPATCH, accepted or refused** (Opus review, 2026-09-17, P2 findings 4–6): a rejection can
 *    quote its payload back. A text-safe refusal does not count (D-18, 25 Sept 2026): `rejections` are
 *    never stored, and the restore fence refuses any.
 * 2. **Default deny.** Any type not on `WARD_FLOW_TEXT_SAFE_EVENT_TYPES` counts, so a third,
 *    unclassified type is never trusted.
 * 3. **Since 21 Oct 2026 (Josh, fix plan item 2, option A)** saving continues: the typed events are
 *    kept in memory and the persistence effect saves a copy with their values replaced
 *    (`ward-flow-typed-text-scrub.ts`). An unreadable typed event stops saving, as before.
 *
 * ⚠️ **ALL OF THIS LIVES INSIDE `WardFlowContainer`, NEVER IN A REF THIS FUNCTION MUTATES** (P2
 * finding 5): React can call a reducer and discard the result, so a ref could read `true` for a
 * dispatch never committed. The persistence effect reads the container exactly as it reads `state`.
 *
 * A genuine reseed (`RESET_SCENARIO`/`SET_SCENARIO`, the only writers of `worldGeneration`) brings
 * fixture data with no typed text, so it alone clears the flag and the typed events. A REJECTED reset
 * leaves `worldGeneration`, and so both, unchanged.
 */
const MAX_CLIENT_EVENT_LOG_ENTRIES = 1000;
/** Every scenario's seed: its prose ships in the bundle, so the typed-text copy keeps it. */
const fixtureWorlds = () => WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(0, scenario));

function trackWardFlowTypedTextDispatch(container: WardFlowContainer, event: WardFlowEvent): WardFlowContainer {
  const nextWorld = wardFlowReducer(container.world, event);
  const outcome = localCommandOutcome(container.world, nextWorld);
  const accepted = outcome.status === "accepted";
  const sequence = (container.eventLog?.at(-1)?.sequence ?? -1) + 1;
  const logged = { ...eventLogEntryFor(event, accepted, container.world), sequence };
  const earlyOutcomes = container.sessionAdopted
    ? container.earlyOutcomes
    : [...(container.earlyOutcomes ?? []), { event, outcome }];
  if (nextWorld.worldGeneration !== container.world.worldGeneration) {
    return {
      ...container,
      world: nextWorld,
      typedTextSeen: false,
      typedTextEvents: undefined,
      typedTextFromFile: false,
      eventLog: [{ ...logged, sequence: 0 }],
      earlyOutcomes,
      recoveryNotice: undefined,
    };
  }
  const previousLog = container.eventLog ?? [];
  const eventLog =
    previousLog.length >= MAX_CLIENT_EVENT_LOG_ENTRIES
      ? [...previousLog.slice(-(MAX_CLIENT_EVENT_LOG_ENTRIES - 1)), logged]
      : [...previousLog, logged];
  const typedNow = !WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(event.type) || eventCarriesTypedTextPayload(event);
  return {
    ...container,
    world: nextWorld,
    typedTextSeen: container.typedTextSeen || typedNow,
    typedTextEvents: typedNow ? [...(container.typedTextEvents ?? []), event] : container.typedTextEvents,
    eventLog,
    earlyOutcomes,
  };
}

/**
 * 🔴 **THE WALL CLOCK IS READ AFTER MOUNT, NOT DURING RENDER — BECAUSE A `useState` INITIALISER
 * RUNS TWICE AND THE TWO RUNS ARE ON DIFFERENT MACHINES.**
 *
 * Found 2026-09-06 by opening a ward page and reading the console. React reported *"Hydration
 * failed because the server rendered text…"* on `/ward-flow/board/rph-adult-secure`.
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
 * The server layout supplies `initialDayZero` so calendar dates also match across hydration,
 * including Perth midnight. After hydration the same clock-adoption effect captures the client's
 * opening day; local restore still refuses yesterday's save. The opening day then stays fixed for
 * this session, and a shared snapshot's own day remains authoritative.
 */
export function WardFlowProvider({ children, initialNow, initialDayZero }: WardFlowProviderProps) {
  const shared = useWardShared(initialNow === undefined && process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true");
  useEffect(() => {
    clearLegacySessionDrafts();
  }, []);
  /**
   * `null` until the mount effect below runs. While null, the world is the deterministic anchor
   * night — identical on the server and in the hydration render, which is the whole point.
   *
   * A pinned `initialNow` never defers: it is already deterministic, and every existing suite
   * renders through this branch unchanged.
   */
  const [adopted, setAdopted] = useState<{ mountedAtAbsolute: number; dayZero: Date } | null>(null);

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
     * It costs one extra render per mount. If a future change makes the clock deterministic across
     * server and client, delete the effect rather than the comment.
     */
    const adopt = () => setAdopted({ mountedAtAbsolute: absoluteWallClockMinutes(), dayZero: demoDayZero(new Date()) });
    return whenStreamRevealed(adopt); // not while the streamed page is pending: React would duplicate it
  }, [initialNow]);

  /*
   * 🔴 **DETERMINISM FIX — the live demo no longer adopts the wall clock's minute of day.** Before
   * this, `anchorOffsetMinutes` was `wallClockNow() - NOW_ANCHOR`, so the seeded world remounted
   * onto the real wall clock and "Board time" flipped non-deterministically between the pinned demo
   * anchor (10:42) and whatever the machine's clock read (e.g. 22:45). The live demo now keeps
   * `anchorOffsetMinutes` at 0, so `now = NOW_ANCHOR + elapsed` — it ticks forward in REAL TIME from
   * the scenario anchor instead of jumping to the wall clock. Only a pinned `initialNow` (tests,
   * screenshots, contract walks) sets a non-zero offset, and that path is unchanged. `adopted` above
   * carries `mountedAtAbsolute` (the elapsed baseline) and the client's opening calendar day,
   * never an anchor offset.
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
      initialDayZero={initialDayZero}
      adoptedDayZero={adopted?.dayZero ?? null}
      shared={shared}
    >
      {children}
    </WardFlowWorld>
  );
}

function WardFlowWorld({
  children,
  initialNow,
  initialDayZero,
  adoptedDayZero,
  anchorOffsetMinutes,
  mountedAtAbsolute,
  shared,
}: WardFlowProviderProps & {
  anchorOffsetMinutes: number;
  mountedAtAbsolute: number | null;
  adoptedDayZero: Date | null;
  shared: WardSharedConnection;
}) {
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
  // The server's calendar is used through hydration; the client opening day is adopted once
  // afterwards, alongside mountedAtAbsolute, before any local restore/save is allowed.
  const [firstDayZero] = useState<Date>(() =>
    initialDayZero === undefined ? demoDayZero(new Date()) : new Date(initialDayZero),
  );
  const localDayZero = adoptedDayZero ?? firstDayZero;
  // Key on the primitive dayZero string, not the snapshot object: SharedWorkspaceClient.adopt
  // publishes a fresh snapshot every 3s even when the revision is unchanged, and dayZero feeds
  // the context value memo — so object identity would re-render every consumer every poll.
  const sharedDayZero = shared.snapshot?.payload.dayZero;
  const dayZero = useMemo(
    () => (sharedDayZero ? new Date(sharedDayZero) : localDayZero),
    [sharedDayZero, localDayZero],
  );

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
    (offset): WardFlowContainer => {
      const world = seedWardFlowStateAt(offset);
      syncWorldGlobals(world);
      return {
        world,
        typedTextSeen: false,
        restoredElapsed: 0,
        sessionAdopted: initialNow !== undefined,
      };
    },
  );
  const state = container.world;
  const { enabled: sharedEnabled, dispatch: dispatchShared } = shared;
  const broadcastInstanceIdRef = useRef("");
  const lastAdoptedBroadcastWorldRef = useRef<WardFlowState | null>(null);
  // A remote snapshot must not replace edits made locally since the last sync.
  const localEditsSinceBroadcastRef = useRef(false);
  // Design audit DA-01: true while this tab is on the untouched seed day (`useOpenTabsDay`).
  const freshSeedRef = useRef(true);
  // Codex P1 (PR #267): whether an action recorded now is really kept on this device, for the
  // offline toast note ("Saved on this device"). A ref read through a stable getter at push time:
  // the committed value is copied in after each render (below), and `dispatch` clears it at once
  // for a typed-text event, before the toast that follows that dispatch is pushed.
  const commandsRef = useRef<LocalCommandState>({ world: state, sequence: 0, early: new Map(), active: true });
  useLocalCommandCompletion(commandsRef, state, container.earlyOutcomes, Boolean(container.sessionAdopted));
  const savesOnDeviceRef = useRef(false);
  const savesOnDevice = useCallback(() => savesOnDeviceRef.current, []);
  // Screens dispatch only `WardFlowEvent`s; the file-load action stays internal to this provider.
  const dispatch = useCallback<WardCommandDispatch>(
    (event: WardFlowEvent) => {
      if (sharedEnabled) {
        return dispatchShared(event);
      }
      // A typed-text event stops saving on this device (the persistence effect below). Say so at once,
      // so a toast pushed straight after this dispatch does not claim the action was saved.
      if (!WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has(event.type) || eventCarriesTypedTextPayload(event))
        savesOnDeviceRef.current = false;
      localEditsSinceBroadcastRef.current = true;
      freshSeedRef.current = false;
      const commandId = `local-${++commandsRef.current.sequence}`;
      if (!container.sessionAdopted) {
        const queuedEvent = { ...event } as WardFlowEvent;
        const completion = new Promise<WardCommandOutcome>((resolve) =>
          commandsRef.current.early.set(queuedEvent, (outcome) =>
            resolve({
              commandId,
              ...outcome,
              isCurrent: () =>
                commandsRef.current.active && commandsRef.current.world.worldGeneration === outcome.generation,
            }),
          ),
        );
        dispatchContainer(queuedEvent);
        return completion;
      }
      const before = commandsRef.current.world;
      const next = wardFlowReducer(before, event);
      if (before.worldGeneration !== next.worldGeneration) clearReferralDraftSession();
      commandsRef.current.world = next;
      dispatchContainer(event);
      broadcastDispatchEvent(event.type, getOrCreateBroadcastInstanceId(broadcastInstanceIdRef));
      return {
        commandId,
        ...localCommandOutcome(
          before,
          next,
          () => commandsRef.current.active && commandsRef.current.world.worldGeneration === next.worldGeneration,
        ),
      };
    },
    [dispatchContainer, sharedEnabled, dispatchShared, container.sessionAdopted],
  );
  // Every ward lookup follows the scenario on screen (`ward-scenarios.ts`). Synchronised in
  // `useLayoutEffect` (as well as reducer state transitions) so the component render body stays pure.
  useLayoutEffect(() => {
    syncWorldGlobals(state);
  }, [state]);
  useLayoutEffect(() => {
    if (container.sessionAdopted) setDraftScenarioScope(`${state.scenario}/${state.worldGeneration}`);
  }, [state.scenario, state.worldGeneration, container.sessionAdopted]);
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
    shared.enabled && shared.snapshot
      ? shared.snapshot.now
      : NOW_ANCHOR + anchorOffsetMinutes + container.restoredElapsed + Math.max(0, elapsed) + state.clockOffsetMinutes;

  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);
  const elapsedRef = useRef(elapsed);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!shared.enabled) return;
    if (!shared.snapshot) {
      dispatchContainer({
        type: "ADOPT_SAVED_SESSION",
        [ADOPT_SESSION]: (current) =>
          current.sharedRevision === undefined
            ? current
            : {
                ...current,
                world: seedWardFlowStateAt(anchorOffsetMinutes),
                sharedRevision: undefined,
                sharedAccessContext: undefined,
                eventLog: [],
                sessionAdopted: true,
                sessionRestored: false,
                preAdoptionEvents: undefined,
              },
      });
      return;
    }
    const snapshot = shared.snapshot;
    openRequestSequence.current = Math.max(
      openRequestSequence.current,
      nextOpenRequestSequence(snapshot.payload.state.auditEvents),
    );
    dispatchContainer({
      type: "ADOPT_SAVED_SESSION",
      [ADOPT_SESSION]: (current) =>
        // Grants and cover change the scoped payload without changing the clinical revision.
        // A clock-only poll preserves the state reference, so it still skips adoption.
        current.sharedRevision === snapshot.revision &&
        current.world === snapshot.payload.state &&
        current.sharedAccessContext === snapshot.accessContext
          ? current
          : {
              ...current,
              world: snapshot.payload.state,
              sharedRevision: snapshot.revision,
              sharedAccessContext: snapshot.accessContext,
              sessionAdopted: true,
              sessionRestored: true,
              typedTextSeen: true,
              preAdoptionEvents: undefined,
              recoveryNotice: undefined,
            },
    });
  }, [shared.enabled, shared.snapshot, anchorOffsetMinutes]);

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
    const instanceId = getOrCreateBroadcastInstanceId(broadcastInstanceIdRef);
    // A read settling after cleanup or after a newer broadcast's read must not adopt (stale closure).
    const reads = { live: true, latest: 0 };
    try {
      const channel = new BroadcastChannel("ward-flow-sync");
      channel.onmessage = (messageEvent) => {
        if (
          initialNow !== undefined ||
          messageEvent.data?.type !== "WARD_FLOW_DISPATCH" ||
          !messageEvent.data.payload
        ) {
          return;
        }
        if (messageEvent.data?.type === "WARD_FLOW_DISPATCH") {
          if (messageEvent.data.senderId && messageEvent.data.senderId === instanceId) {
            return;
          }
          if (!shared.enabled && !localEditsSinceBroadcastRef.current) {
            const rawPayload = typeof messageEvent.data.payload === "string" ? messageEvent.data.payload : undefined;
            const referenceAbsolute = Math.max(mountedAtAbsolute ?? 0, absoluteWallClockMinutes());
            const read = ++reads.latest;
            void readDemoStateLater(dayZero, referenceAbsolute, rawPayload).then(({ saved }) => {
              if (!reads.live || read !== reads.latest || !saved || localEditsSinceBroadcastRef.current) return;
              openRequestSequence.current = Math.max(
                openRequestSequence.current,
                nextOpenRequestSequence(saved.state.auditEvents),
              );
              lastAdoptedBroadcastWorldRef.current = saved.state;
              localEditsSinceBroadcastRef.current = false;
              dispatchContainer({
                type: "ADOPT_SAVED_SESSION",
                [ADOPT_SESSION]: (current) => {
                  if (current.typedTextSeen || !current.sessionAdopted) return current;
                  const baseMounted = mountedAtAbsolute ?? saved.savedAtAbsolute;
                  const restoredElapsed =
                    saved.now - NOW_ANCHOR - saved.state.clockOffsetMinutes + baseMounted - saved.savedAtAbsolute;
                  const isSameWorld =
                    JSON.stringify(saved.state) === JSON.stringify({ ...current.world, rejections: [] });
                  if (isSameWorld) {
                    return current;
                  }
                  freshSeedRef.current = false; // only once accepted: a refused day leaves the seed (DA-01)
                  return {
                    ...current,
                    world: saved.state,
                    restoredElapsed,
                    sessionAdopted: true,
                    // As an ordinary restore does, so screens keyed on the seed day start from this world.
                    sessionRestored: true,
                    preAdoptionEvents: undefined,
                  };
                },
              });
            });
          }
          setTick((tick) => tick + 1);
        }
      };
      return () => {
        reads.live = false;
        channel.close();
      };
    } catch {
      return undefined;
    }
  }, [dayZero, mountedAtAbsolute, initialNow, shared.enabled]);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  // The world generation whose typed-text copy could not be made safely, or "loaded" to re-run the
  // save once the copy's code arrives.
  const [deviceCopyCheck, setDeviceCopyCheck] = useState<number | "loaded" | null>(null);
  const typedTextLocked = container.typedTextSeen && deviceCopyCheck === state.worldGeneration;
  // Local saving runs only in the unpinned local demonstration, until storage fails or a typed-text
  // copy cannot be made safely. Shared mode does not save actions on this device.
  const savingOnDevice = !shared.enabled && initialNow === undefined && !typedTextLocked && !storageUnavailable;
  useOpenTabsDay(savingOnDevice && container.sessionAdopted === true, freshSeedRef, broadcastInstanceIdRef);
  const demoControlsAvailable = !shared.enabled || shared.snapshot?.demoControls !== false;
  useEffect(() => {
    savesOnDeviceRef.current = savingOnDevice;
  }, [savingOnDevice, state]);

  // Item #17: when typed text is held and nothing is saving on this device (a refused copy or failed
  // storage), warn before a refresh loses the day.
  useEffect(() => {
    if (shared.enabled || savingOnDevice || !container.typedTextSeen) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shared.enabled, savingOnDevice, container.typedTextSeen]);

  /**
   * Restores a saved same-day session once the mount effect in `WardFlowProvider` has supplied
   * `mountedAtAbsolute`. The restored state arrives through the reducer. The screens are re-keyed
   * (remounted) once only when the restored day differs from the seed — see the `Fragment` key in
   * the render below; a first visit or an unchanged reload keeps every node. Runs once per mount;
   * `sessionAdopted` gates the storage write below until it has run. The read loads on demand.
   */
  const demoRead = useDemoStateRead(!shared.enabled && initialNow === undefined, dayZero, mountedAtAbsolute);
  useEffect(() => {
    if (shared.enabled) return;
    if (initialNow !== undefined || mountedAtAbsolute === null || !demoRead) return;
    const { saved, recoveryNotice } = demoRead;
    if (saved) freshSeedRef.current = false; // a restored day is not the untouched seed (DA-01)
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
          const isSameWorld =
            !current.preAdoptionEvents?.length &&
            JSON.stringify(saved.state) === JSON.stringify({ ...current.world, rejections: [] });
          if (isSameWorld)
            return { ...current, restoredElapsed, sessionAdopted: true, preAdoptionEvents: undefined, recoveryNotice };
          // Anything dispatched before adoption is replayed on the restored day through the same
          // tracker, so its log entry and typed-text lock survive, and a now-stale action is refused
          // on screen rather than lost.
          let restored: WardFlowContainer = {
            world: saved.state,
            typedTextSeen: false,
            restoredElapsed,
            sessionAdopted: false,
            sessionRestored: true,
            recoveryNotice,
          };
          for (const event of current.preAdoptionEvents ?? [])
            restored = trackWardFlowTypedTextDispatch(restored, event);
          return { ...restored, sessionAdopted: true, preAdoptionEvents: undefined };
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
  }, [initialNow, mountedAtAbsolute, dayZero, shared.enabled, demoRead]);

  const [focusMovementId, setFocusMovementId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (shared.enabled) return;
    if (initialNow !== undefined || mountedAtAbsolute === null || !container.sessionAdopted) return;
    if (storageUnavailable) return;
    // D-18, option A (Josh, 21 Oct 2026): once typed text is DISPATCHED, accepted or refused, only a
    // copy with every typed value replaced is written, or nothing until a reseed when no safe copy can
    // be made (`deviceCopyOf`). Read from the COMMITTED container on every run, exactly as `state` is.
    const deviceCopy = deviceCopyOf(state, container, typedTextLocked, fixtureWorlds);
    if (deviceCopy === undefined) {
      void loadTypedTextScrub().then(
        () => setDeviceCopyCheck("loaded"),
        () => setDeviceCopyCheck(state.worldGeneration),
      );
      return;
    }
    if (!deviceCopy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- display the outcome of the external storage operation
      setDeviceCopyCheck(state.worldGeneration);
      if (!clearWardFlowDemoState()) setStorageUnavailable(true);
      return;
    }
    const isFromRemoteBroadcast = lastAdoptedBroadcastWorldRef.current === state;
    if (
      !tryWriteDemoState(
        deviceCopy,
        dayZero,
        nowRef.current,
        mountedAtAbsolute + Math.max(0, elapsedRef.current),
        seedSafeSenderId(isFromRemoteBroadcast || freshSeedRef.current, broadcastInstanceIdRef),
      )
    ) {
      setStorageUnavailable(true);
    } else {
      localEditsSinceBroadcastRef.current = false;
    }
  }, [
    state,
    container,
    typedTextLocked,
    deviceCopyCheck,
    initialNow,
    mountedAtAbsolute,
    dayZero,
    storageUnavailable,
    shared.enabled,
  ]);

  // Audit finding ISSUE-P1-83, defect 3e: `useCallback`, not a fresh function every render — this
  // sits in the `value` useMemo's own dependency array below, so an unstable reference defeated that
  // memo on every render regardless of whether anything the memo actually reads had changed.
  const resetDemoState = useCallback(() => {
    if (!shared.enabled) clearWardFlowDemoState();
    localEditsSinceBroadcastRef.current = false;
    dispatch({ type: "RESET_SCENARIO", role: "demo", now: nowRef.current });
  }, [dispatch, shared.enabled]);

  const saveScenarioFile = useCallback(() => buildScenarioFileLater(state, nowRef.current), [state]);

  const loadScenarioFile = useCallback(
    async (text: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      if (shared.enabled)
        return {
          ok: false,
          reason:
            "Scenario file replacement is available only in the local demonstration. Shared changes must use audited commands.",
        };
      const read = await readScenarioFileLater(text);
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
        worldGeneration: Math.max(commandsRef.current.world.worldGeneration, read.state.worldGeneration) + 1,
      };
      // Continue past every record-request id either world has used (`nextOpenRequestSequence`).
      openRequestSequence.current = Math.max(openRequestSequence.current, nextOpenRequestSequence(world.auditEvents));
      clearReferralDraftSession();
      commandsRef.current.world = world;
      dispatchContainer({
        type: "LOAD_SCENARIO_FILE_INTERNAL",
        world,
        restoredElapsed: read.now - read.state.clockOffsetMinutes - base,
      });
      return { ok: true };
    },
    [initialNow, mountedAtAbsolute, anchorOffsetMinutes, shared.enabled],
  );

  const reportSnapshotReady = !shared.enabled || container.world === shared.snapshot?.payload.state;
  const sharedConnection = useMemo(
    () =>
      shared.enabled && container.sharedRevision === undefined
        ? { ...shared, snapshot: null, reportSnapshotReady }
        : shared.enabled && container.sharedRevision !== shared.snapshot?.revision
          ? { ...shared, status: "saving" as const, reportSnapshotReady }
          : { ...shared, reportSnapshotReady },
    [shared, container.sharedRevision, reportSnapshotReady],
  );

  // The readers and the two record actions close over `state`, so they are rebuilt when it changes,
  // and only then: in the value memo below they were rebuilt on every clock tick as well, which woke
  // every screen that reads one of them.
  const stateBound = useMemo(
    () =>
      ({
        recordWardDeparture: (admissionId, actingUnitId, leavingDestination) => {
          const read = selectDischargeRecord(state, { role: "ward", actingUnitId }, admissionId);
          if (read.status === "allowed" && read.value.identity.kind === "legacy-anonymous") {
            return dispatch({
              type: "RECORD_LEAVING",
              role: "ward",
              now: nowRef.current,
              admissionId,
              actingUnitId,
              leavingDestination,
            });
          }
          return dispatch({
            type: "RECORD_PATIENT_DISCHARGE",
            role: "ward",
            now: nowRef.current,
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
        readDischargeRecord: (actor, admissionId, handle) =>
          readOpenedDischargeRecord(state, actor, admissionId, handle),
        readAuditEvents: (actor) => readAuditEvents(state, actor),
        readGovernanceAuditEvents: (actor) => readGovernanceAuditEvents(state, actor),
        readAuditReviews: (actor) => readAuditReviews(state, actor),
        openDischargeRecord: (actor, admissionId) => {
          if (!safeCounter(openRequestSequence.current) || openRequestSequence.current >= Number.MAX_SAFE_INTEGER)
            throw new Error("Record request allocation unavailable");
          const handle = {
            generation: state.worldGeneration,
            requestId: openRequestSequence.current++,
            requestNamespace: newDischargeRequestNamespace(),
          };
          const declaredActor = validRecordActor(actor) ? actor : { role: "demo" as const };
          dispatch({
            ...declaredActor,
            type: "OPEN_DISCHARGE_RECORD",
            now: nowRef.current,
            admissionId,
            expectedGeneration: handle.generation,
            requestId: handle.requestId,
            requestNamespace: handle.requestNamespace,
          });
          return handle;
        },
        wardReferralInbox: (unitId: string) => wardReferralInboxEntries(state.referrals, unitId),
        resolvePatientIdentity: (subject) =>
          resolveSubjectPatient(subject, {
            patients: state.patients,
            referrals: state.referrals,
            movements: state.movements,
            // A stay converted from an initials-only booking is named through that booking.
            plannedAdmissions: state.plannedAdmissions,
          }),
      }) satisfies Partial<WardFlowContextValue>,
    [state, dispatch],
  );

  // One object per change of status, so readers of `shared` do not wake on every clock tick.
  const sharedStatus = useMemo(
    () => ({ enabled: sharedConnection.enabled, status: sharedConnection.status, error: sharedConnection.error }),
    [sharedConnection.enabled, sharedConnection.status, sharedConnection.error],
  );

  const value = useMemo<WardFlowContextValue>(
    () => ({
      worldGeneration: state.worldGeneration,
      sessionAdopted: container.sessionAdopted === true,
      ...stateBound,
      movements: state.movements,
      units: state.units,
      referrals: state.referrals,
      rejections: state.rejections,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      refreshRequests: state.refreshRequests,
      handoverSignOffs: Array.isArray(state.handoverSignOffs) ? state.handoverSignOffs : EMPTY_ARRAY,
      repatriations: Array.isArray(state.repatriations) ? state.repatriations : EMPTY_ARRAY,
      inboxAcknowledgements: state.inboxAcknowledgements,
      inboxCompletions: state.inboxCompletions,
      inboxOwnership: state.inboxOwnership,
      inboxSnoozes: state.inboxSnoozes,
      undoRecords: state.undoRecords,
      notices: state.notices,
      morningRollupConfirmations: state.morningRollupConfirmations,
      patients: state.patients,
      admissions: state.admissions,
      now,
      dayZero,
      scenario: state.scenario,
      configuration: state.configuration,
      broadcastAlerts: state.broadcastAlerts ?? EMPTY_ARRAY,
      plannedAdmissions: state.plannedAdmissions ?? EMPTY_ARRAY,
      supportNotifications: state.supportNotifications ?? EMPTY_ARRAY,
      eventLog: shared.enabled ? (shared.eventLog ?? EMPTY_ARRAY) : (container.eventLog ?? EMPTY_ARRAY),
      dispatch,
      focusMovementId,
      setFocusMovementId,
      resetDemoState,
      saveScenarioFile,
      loadScenarioFile,
      savingOnDevice: initialNow !== undefined ? !typedTextLocked && !storageUnavailable : savingOnDevice,
      shared: sharedStatus,
      demoControlsAvailable,
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
      stateBound,
      container.sessionAdopted,
      typedTextLocked,
      // The log grows even when an event leaves `state` untouched (a no-op), so it is its own dep.
      container.eventLog,
      shared.enabled,
      shared.eventLog,
      sharedStatus,
      demoControlsAvailable,
      dayZero,
      dispatch,
      focusMovementId,
      resetDemoState,
      saveScenarioFile,
      loadScenarioFile,
      savingOnDevice,
      storageUnavailable,
      initialNow,
      now,
    ],
  );

  const screenKey =
    (shared.enabled && container.sharedAccessContext) || (container.sessionRestored ? "restored" : "seed");
  return (
    <WardFlowOverride value={value}>
      <WardClockContext.Provider value={now}>
        <WardRecoveryNoticeContext.Provider
          value={
            storageUnavailable
              ? container.recoveryNotice && container.recoveryNotice !== STORAGE_UNAVAILABLE
                ? `${STORAGE_UNAVAILABLE} ${container.recoveryNotice}`
                : STORAGE_UNAVAILABLE
              : (container.recoveryNotice ?? null)
          }
        >
          <WardDemoNotSavedContext.Provider
            value={shared.enabled || initialNow !== undefined || !container.typedTextSeen ? undefined : savingOnDevice}
          >
            <ToastDeviceSaveContext.Provider value={savesOnDevice}>
              <WardFlowClockContext.Provider value={now}>
                {/* New worlds/access contexts retire forms; ordinary shared saves retain edits. */}
                <WardSharedAccess connection={sharedConnection}>
                  <Fragment key={screenKey}>{children}</Fragment>
                </WardSharedAccess>
              </WardFlowClockContext.Provider>
            </ToastDeviceSaveContext.Provider>
          </WardDemoNotSavedContext.Provider>
        </WardRecoveryNoticeContext.Provider>
      </WardClockContext.Provider>
    </WardFlowOverride>
  );
}

export function useOptionalWardFlow(): WardFlowContextValue | null {
  return useContext(WardFlowContext);
}

/** Conservative failure: a screen rendered outside the provider must fail loudly, never fall
 * back to a default empty world that would silently read as "no patients tonight". */
export function useWardFlow(): WardFlowContextValue {
  const context = useContext(WardFlowContext);
  if (!context) throw new Error("useWardFlow must be used within WardFlowProvider.");
  return context;
}

/**
 * FD-23: the referrals a community team may see, already projected. The community team page takes
 * its referrals from here and never from `useWardFlow()`, so it never holds another destination.
 */
export function useCommunityScopedReferrals(): CommunityScopedReferral[] {
  const { referrals } = useWardFlowSelect("referrals");
  return useMemo(() => communityScopedReferrals(referrals), [referrals]);
}

/** Fix plan item 17 (D-74): referrals as the community team that sent them sees them, never the record. */
export function useCommunitySentReferrals(): ReturnType<typeof communitySentView> {
  const { referrals } = useWardFlowSelect("referrals");
  return useMemo(() => communitySentView(referrals), [referrals]);
}

/**
 * The referral ids on `admissions` that match no referral at all. Ids only, read against the full
 * record here so the community page can tell a broken link from a referral it may not see (FD-23).
 */
export function useDanglingReferralIds(admissions: readonly Admission[]): ReadonlySet<string> {
  const { referrals } = useWardFlowSelect("referrals");
  return useMemo(() => {
    const known = new Set(referrals.map((referral) => referral.id));
    return new Set(
      admissions.flatMap((admission) =>
        admission.referralId !== null && !known.has(admission.referralId) ? [admission.referralId] : [],
      ),
    );
  }, [admissions, referrals]);
}

export function useWardFlowClock(fallback?: Instant): Instant {
  const clock = use(WardFlowClockContext);
  if (clock !== null) return clock;
  const wardFlow = use(WardFlowContext);
  if (wardFlow) return wardFlow.now;
  if (fallback !== undefined) return fallback;
  throw new Error("useWardFlowClock must be used within WardFlowProvider.");
}

/**
 * The due-time warnings Settings sets (Josh, 26 Sept 2026, question 3), as an input a screen passes
 * on: `clockState(due, now, thresholds)`. The defaults outside a provider.
 */
export function useDueSoonThresholds(): DueSoonThresholds {
  const picked = useOptionalWardFlowSelect("configuration");
  return dueSoonThresholdsOf(picked?.configuration);
}

/**
 * The wards of the scenario on screen, as an input a screen passes on (`network.unitById(id)`,
 * `network.sites`). Outside a provider, whichever network the module-wide lookups point at.
 */
export function useWardNetwork(): WardNetwork {
  const picked = useOptionalWardFlowSelect("scenario");
  return picked ? scenarioWardNetwork(picked.scenario) : activeWardNetwork();
}
