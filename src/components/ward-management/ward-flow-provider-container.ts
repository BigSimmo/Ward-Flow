import { localCommandOutcome } from "./use-local-command-completion";
import type { WardCommandOutcome } from "./ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { activateScenarioNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { eventLogEntryFor, type EventLogEntry } from "@/components/ward-management/ward-event-log";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  eventCarriesTypedTextPayload,
} from "@/components/ward-management/ward-flow-persistence-classification";

// `WardFlowProvider`'s reducer container, moved unchanged out of `ward-flow-provider.tsx` (F-17,
// 26 Oct 2026) so the provider stays under its line cap. Only the provider imports it.

/**
 * The `useReducer` state this provider actually carries: the real reducer's world, plus one flag no
 * reducer case ever reads and only `trackWardFlowTypedTextDispatch` below ever writes.
 */
export type WardFlowContainer = {
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
  recoveryNoticeQuiet?: boolean; // Unchanged reload: the notice only names the save beside a storage warning.
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
 * hydration. Keyed by a symbol only the provider imports, so no caller-built event can ever take this path.
 */
export const ADOPT_SESSION: unique symbol = Symbol("ward-flow-adopt-session");
type AdoptSessionAction = {
  type: "ADOPT_SAVED_SESSION";
  [ADOPT_SESSION]: (current: WardFlowContainer) => WardFlowContainer;
};

/** Also not a `WardFlowEvent`: replacing the world from a demo scenario file
 *  (`ward-flow-scenario-file.ts`) never reaches the reducer, the event log or a role check. */
type LoadScenarioFileAction = { type: "LOAD_SCENARIO_FILE_INTERNAL"; world: WardFlowState; restoredElapsed: number };

export function syncWorldGlobals(world: WardFlowState): void {
  activateScenarioNetwork(world.scenario);
}

export function wardFlowContainerReducer(
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
      typedTextEvents: undefined,
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

/**
 * M10 (mechanics and clock audit, 14 Nov 2026): replays the actions taken before the saved day was
 * adopted onto `restored`, each at the restored board's minute (`boardNowOf` its world), not the
 * seed clock's minute it was dispatched with. A Reset or scenario change is re-stamped the same
 * way, so it builds its new day around the time on screen. Each early outcome keeps the event its
 * caller is waiting on.
 */
export function replayEarlyEvents(
  restored: WardFlowContainer,
  events: readonly WardFlowEvent[],
  boardNowOf: (world: WardFlowState) => number,
): WardFlowContainer {
  let next = restored;
  for (const event of events) {
    const restamped = "now" in event ? ({ ...event, now: boardNowOf(next.world) } as WardFlowEvent) : event;
    next = trackWardFlowTypedTextDispatch(next, restamped);
    const outcomes = next.earlyOutcomes ?? [];
    const last = outcomes.at(-1);
    if (last && last.event === restamped && restamped !== event)
      next = { ...next, earlyOutcomes: [...outcomes.slice(0, -1), { event, outcome: last.outcome }] };
  }
  return next;
}
/**
 * Every scenario's seed: its prose ships in the bundle, so the typed-text copy keeps it. A16-14 made
 * the worked examples opt-in, so each scenario is listed with them as well, first: that world holds
 * every record of the plain one, and a scenario's lookup finds it. Without it, a typed-text copy
 * replaced the worked examples' own seeded text (RF-RD06's referral form) once they were shown.
 */
export const fixtureWorlds = (offsetMinutes = 0) =>
  WARD_SCENARIOS.flatMap((scenario) => [
    seedWardFlowStateAt(offsetMinutes, scenario, { workedExamples: true }),
    seedWardFlowStateAt(offsetMinutes, scenario),
  ]);

function trackWardFlowTypedTextDispatch(container: WardFlowContainer, event: WardFlowEvent): WardFlowContainer {
  const nextWorld = wardFlowReducer(container.world, event);
  const outcome = localCommandOutcome(container.world, nextWorld);
  const accepted = outcome.status === "accepted";
  const logged = { ...eventLogEntryFor(event, accepted), sequence: (container.eventLog?.at(-1)?.sequence ?? -1) + 1 };
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
