import type { Dispatch, MutableRefObject } from "react";
import { absoluteWallClockMinutes } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowContainer } from "./ward-flow-provider-container";
import { ADOPT_SESSION } from "./ward-flow-provider-container";
import { readDemoStateLater } from "./ward-flow-demo-storage";
import { BROUGHT_UP_TO_DATE_NOTICE, DEMO_TABS_CONFLICT_NOTICE } from "./ward-flow-demo-storage-constants";
import { getOrCreateBroadcastInstanceId } from "./ward-flow-provider-helpers";

let nextHeadSequence = 0;
const newHead = () => `wf-sync-${++nextHeadSequence}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const MAX_ANCESTORS = 64;
const OPAQUE_ID = /^[a-zA-Z0-9:_-]{1,160}$/;
export type DemoSyncMetadata = {
  version: 1;
  head: string;
  ancestors: string[];
  conflicted?: true;
};

/** Metadata has no record content. An absent or malformed lineage can never prove ancestry. */
export function readDemoSync(value: unknown): DemoSyncMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const held = value as Partial<DemoSyncMetadata>;
  if (
    held.version !== 1 ||
    typeof held.head !== "string" ||
    !OPAQUE_ID.test(held.head) ||
    !Array.isArray(held.ancestors) ||
    held.ancestors.length > MAX_ANCESTORS ||
    held.ancestors.some((id) => typeof id !== "string" || !OPAQUE_ID.test(id) || id === held.head) ||
    new Set(held.ancestors).size !== held.ancestors.length ||
    (held.conflicted !== undefined && held.conflicted !== true)
  )
    return undefined;
  return {
    version: 1,
    head: held.head,
    ancestors: [...held.ancestors],
    ...(held.conflicted ? { conflicted: true } : {}),
  };
}

/** Causal knowledge survives a device-save acknowledgement; only explicit replacement resolves a fork. */
export class DemoTabSync {
  private current: DemoSyncMetadata | undefined;
  private dirty = false;
  private restored = false;
  private earlyCount = 0;
  private staged = new WeakMap<WardFlowState, DemoSyncMetadata | undefined>();
  constructor(private readonly nextHead: () => string = newHead) {}
  restore(value: unknown): void {
    if (this.restored) return;
    this.restored = true;
    this.current = readDemoSync(value);
  }
  changed(): void {
    this.dirty = true;
  }
  resolve(): void {
    this.current = undefined;
    this.dirty = true;
    this.restored = true;
    this.staged = new WeakMap();
  }
  stage(world: WardFlowState, value: unknown): void {
    this.staged.set(world, readDemoSync(value));
  }
  committed(world: WardFlowState, notice: string | undefined, early: WardFlowContainer["earlyOutcomes"]): boolean {
    if ((early ?? []).slice(this.earlyCount).some(({ outcome }) => outcome.status === "accepted")) this.dirty = true;
    this.earlyCount = early?.length ?? 0;
    const adopted = this.staged.has(world);
    if (adopted) {
      const remote = this.staged.get(world);
      const conflicted = this.current?.conflicted || remote?.conflicted;
      this.current = remote && { ...remote, ...(conflicted ? { conflicted: true } : {}) };
      this.dirty = false;
      this.staged.delete(world);
      this.restored = true;
    }
    if (notice === DEMO_TABS_CONFLICT_NOTICE && !this.current?.conflicted)
      this.current = { ...this.forSave(), conflicted: true };
    return adopted;
  }
  relation(
    remote: DemoSyncMetadata | undefined,
    untouched: boolean,
    world: WardFlowState,
  ): "first" | "adopt" | "ignore" | "conflict" {
    const staged = this.staged.has(world);
    const local = staged ? this.staged.get(world) : this.current;
    if (remote && local?.head === remote.head) return remote.conflicted && !local.conflicted ? "conflict" : "ignore";
    if (remote && local?.ancestors.includes(remote.head))
      return remote.conflicted && !local.conflicted ? "conflict" : "ignore";
    if (this.dirty) return "conflict";
    if (untouched && !staged) return "first";
    if (remote && local && remote.ancestors.includes(local.head)) return "adopt";
    return "conflict";
  }
  forSave(): DemoSyncMetadata {
    if (!this.current) this.current = { version: 1, head: this.nextHead(), ancestors: [] };
    else if (this.dirty)
      this.current = {
        ...this.current,
        head: this.nextHead(),
        ancestors: [this.current.head, ...this.current.ancestors].slice(0, MAX_ANCESTORS),
      };
    this.dirty = false;
    return this.current;
  }
}

type ListenerOptions = {
  initialNow: number | undefined;
  shared: boolean;
  dayZero: Date;
  mountedAtAbsolute: number | null;
  nowAnchor: number;
  instance: MutableRefObject<string>;
  fresh: MutableRefObject<boolean>;
  unsaved: MutableRefObject<boolean>;
  sync: DemoTabSync;
  dispatch: Dispatch<{
    type: "ADOPT_SAVED_SESSION";
    [ADOPT_SESSION]: (current: WardFlowContainer) => WardFlowContainer;
  }>;
  tick: () => void;
};

/** Every delivery is checked against the committed branch, including late and out-of-order reads. */
export function listenForDemoTabs(options: ListenerOptions): (() => void) | undefined {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") return;
  let live = true;
  const instanceId = getOrCreateBroadcastInstanceId(options.instance);
  try {
    const channel = new BroadcastChannel("ward-flow-sync");
    channel.onmessage = ({ data }) => {
      if (
        options.initialNow !== undefined ||
        data?.type !== "WARD_FLOW_DISPATCH" ||
        !data.payload ||
        data.senderId === instanceId
      )
        return;
      if (!options.shared) {
        const reference = Math.max(options.mountedAtAbsolute ?? 0, absoluteWallClockMinutes());
        void readDemoStateLater(
          options.dayZero,
          reference,
          typeof data.payload === "string" ? data.payload : undefined,
        ).then(({ saved }) => {
          if (!live || !saved) return;
          options.sync.stage(saved.state, saved.sync);
          options.dispatch({
            type: "ADOPT_SAVED_SESSION",
            [ADOPT_SESSION]: (current) => {
              if (!current.sessionAdopted || saved.worldGeneration < current.world.worldGeneration) return current;
              const relation = options.sync.relation(saved.sync, options.fresh.current, current.world);
              if (relation === "ignore") return current;
              if (relation === "conflict" || options.unsaved.current || current.typedTextSeen) {
                if (current.recoveryNotice === DEMO_TABS_CONFLICT_NOTICE && !current.recoveryNoticeQuiet)
                  return current;
                return { ...current, recoveryNotice: DEMO_TABS_CONFLICT_NOTICE, recoveryNoticeQuiet: false };
              }
              const firstAdoption = relation === "first";
              return {
                ...current,
                recoveryNotice:
                  current.recoveryNotice === DEMO_TABS_CONFLICT_NOTICE || saved.sync?.conflicted
                    ? DEMO_TABS_CONFLICT_NOTICE
                    : firstAdoption
                      ? BROUGHT_UP_TO_DATE_NOTICE
                      : current.recoveryNotice,
                recoveryNoticeQuiet: false,
                world: saved.state,
                restoredElapsed:
                  saved.now -
                  options.nowAnchor -
                  saved.state.clockOffsetMinutes +
                  (options.mountedAtAbsolute ?? saved.savedAtAbsolute) -
                  saved.savedAtAbsolute,
                sessionAdopted: true,
                sessionRestored: true,
                preAdoptionEvents: undefined,
              };
            },
          });
        });
      }
      options.tick();
    };
    return () => {
      live = false;
      channel.close();
    };
  } catch {
    return;
  }
}
