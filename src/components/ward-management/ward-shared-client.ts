import { readAccessDirectory } from "./ward-access-directory";
import { recoverCommandReceipts } from "./ward-command-recovery-run";
import {
  COMMAND_RECOVERY_KEY,
  readCommandRecovery,
  recordCommandRecovery,
  removeCommandRecovery,
  type RecoveryEntry,
} from "./ward-command-recovery";
import * as activityAudit from "./ward-shared-activity-audit";
import type { SharedActivityAuditEvent } from "./ward-shared-activity-audit";
import { forecastHistoryFailure } from "./forecast/forecast-history-response";
import {
  anySignal,
  checkSharedSnapshot,
  onDeviceClock,
  sentence,
  untilAborted,
  withoutChartContent,
} from "./ward-shared-client-helpers";
import { forgetDowntimePack } from "./reports/downtime-pack";
import { commandSheetHandles, openSheetHandles, subscribeToSheetStack } from "@/components/wf/sheet-focus";
import type { WardCommandMetadata } from "./ward-command-metadata";
import { WardAuthError } from "./ward-supabase-auth";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { RecordViewSurface } from "./shell/ward-shared-session-context";
import { eventLogEntryFor } from "./ward-event-log";
import { bindReferralDraftAccessContext, clearReferralDraftSession } from "./referrals/referral-draft-lifecycle";
import type { BoundWardPartialView, WardPartialView } from "./ward-partial-view-contract";
import { boardNotRefreshed, saveProblem } from "./ward-save-failure";
import {
  foldArchiveReply,
  withArchivedRecords,
  type ArchivedCollection,
  type HeldArchive,
} from "./ward-shared-archive-delta";
import { reuseUnchangedPayload } from "./ward-shared-client-reuse";
import type { SharedBreakGlassOpening, SharedRecordView } from "./ward-shared-record-access-types";
import { RecordDetailHold } from "./ward-shared-record-detail";
import {
  bindWorkspaceReply,
  refusesRecordPath,
  roleChoices,
  sentBindingFor,
  verifyResponseBinding,
  viewLifetimeChanged,
  type SentBinding,
} from "./ward-shared-role-binding";
export type { ExecutiveAggregateSnapshot, SharedWorkspaceSnapshot } from "./ward-shared-executive-snapshot";
import * as conflict from "./ward-conflict-scope";
import * as push from "./ward-shared-push-api";
import type { SharedAsk } from "./ward-shared-push-api";
export type { SharedBreakGlassOpening, SharedRecordView } from "./ward-shared-record-access-types";
import type { SharedAccessRequest, SharedMembership } from "./ward-shared-access-types";
import {
  markOwnSave,
  pinToBoard,
  sheetBasis,
  type PendingCommand,
  type QueuedCommand,
  type SheetSeen,
} from "./ward-shared-pending-command";
export type { SharedAccessRequest, SharedMembership } from "./ward-shared-access-types";
import {
  bindSharedPartialView,
  isValidSharedState,
  loadSharedStateCheck,
  mergeSharedPartialView,
} from "./ward-shared-state-check";
import { SharedPacing } from "./ward-shared-pacing";

import type { SharedSnapshot, SharedView, SharedChangeResult, WardCommandOutcome } from "./ward-shared-client-types";
export type {
  SharedSnapshot,
  SharedRoleChoice,
  SharedView,
  SharedChangeResult,
  WardCommandOutcome,
  WardCommandDispatch,
} from "./ward-shared-client-types";
/** The lists closed records are archived from, older than 30 days (Josh, 25 Oct 2026). */
type ArchivedRecords = Record<ArchivedCollection, { id: string }[]>;
export const WARD_COMMAND_RECOVERY_KEY = COMMAND_RECOVERY_KEY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Matches the provider: keep the newest entries; sequence keeps advancing past dropped ones. */
const MAX_SHARED_EVENT_LOG_ENTRIES = 1000;
const NO_ROLE = "No Ward Flow role is assigned to this account";
/** P056: one audit row as a desk's Activity reads it; nothing in it names a patient or a person. */
export type { SharedActivityAuditEvent, SharedActivityAuditPage } from "./ward-shared-activity-audit";
/** A member desk reads its part of the workspace in full at least this often (audit F-04). */
const FULL_READ_EVERY_MS = 60_000;

/** Thrown once by a request whose first 401 is asked again with a fresh token (audit A4-02). */
const FRESH_TOKEN = new Error("Ask again with a fresh token");

export class SharedWorkspaceClient {
  private view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  private pending: PendingCommand | null = null;
  private accessTimer: ReturnType<typeof setTimeout> | undefined;
  private recoveryPending = false;
  private recoveryStorageUnavailable = false;
  private recoveryWrite(commandId: string, phase: RecoveryEntry["phase"] = "sent") {
    const { receiptScope, accessUntil } = this.view;
    if (!this.options.recoveryStorage || !receiptScope || !Number.isFinite(accessUntil) || accessUntil! <= Date.now())
      return true;
    const stored = recordCommandRecovery(this.options.recoveryStorage, {
      commandId,
      receiptScope,
      expiresAt: accessUntil!,
      phase,
    });
    this.recoveryStorageUnavailable = !stored.available;
    return stored.sendSafe;
  }
  private clearRecovery(commandId?: string) {
    if (!commandId) this.recoveryPending = false;
    if (this.options.recoveryStorage)
      this.recoveryStorageUnavailable = !removeCommandRecovery(this.options.recoveryStorage, commandId);
  }

  private async recoverReceipt() {
    if (this.pending || this.queue.length || !this.options.recoveryStorage) return;
    const generation = this.viewGeneration,
      grantGeneration = this.grantGeneration;
    const roleSignal = this.roleLifetime.signal,
      receiptScope = this.view.receiptScope;
    await recoverCommandReceipts({
      storage: this.options.recoveryStorage,
      view: () => this.view,
      publish: (update) => this.publish(update),
      remove: (id) => this.clearRecovery(id),
      request: (path) => this.request(path),
      adopt: (snapshot) => this.adopt(snapshot),
      pending: (pending) => {
        this.recoveryPending = pending;
      },
      unavailable: () => {
        this.recoveryStorageUnavailable = true;
      },
      current: (held, checkExpiry = true) => {
        if (
          this.disposed ||
          roleSignal.aborted ||
          generation !== this.viewGeneration ||
          grantGeneration !== this.grantGeneration ||
          receiptScope !== this.view.receiptScope ||
          (this.view.accessUntil ?? Infinity) <= Date.now() ||
          (checkExpiry && held.expiresAt <= Date.now())
        ) {
          if (!this.disposed && !this.gated()) this.needsRefresh = true;
          throw new Error("The recovery view changed; reconnect to check the current desk.");
        }
      },
    });
  }

  /** A started POST may have committed even when changing roles aborts its response. */
  private sentCommandId: string | null = null;
  private queue: QueuedCommand[] = [];
  private unloadWarningActive = false;
  private readonly warnBeforeUnload = (event: BeforeUnloadEvent) => {
    if (this.disposed || (!this.pending && !this.queue.length && !this.recoveryPending)) return;
    event.preventDefault();
    event.returnValue = "";
  };
  /** Only commands need protection: an ordinary board refresh must not block leaving the page. */
  private syncUnloadWarning() {
    if (typeof window === "undefined") return;
    const needed = !this.disposed && (this.pending !== null || this.queue.length > 0 || this.recoveryPending);
    if (needed === this.unloadWarningActive) return;
    if (needed) window.addEventListener("beforeunload", this.warnBeforeUnload);
    else window.removeEventListener("beforeunload", this.warnBeforeUnload);
    this.unloadWarningActive = needed;
  }
  private completions = new Map<string, (outcome: WardCommandOutcome) => void>();
  private confirmations = new Map<string, (outcome: WardCommandOutcome) => void>();
  private roleLifetime = new AbortController();
  private settle(
    commandId: string,
    status: WardCommandOutcome["status"],
    message?: string,
    undoRecords?: WardFlowState["undoRecords"],
    metadata?: WardCommandMetadata,
    partly?: string,
  ) {
    const outcome: WardCommandOutcome = {
      commandId,
      status,
      message,
      undoRecords,
      undoStep: metadata?.undoStep,
      ...(partly ? { partly } : {}),
    };
    if (status !== "failed" && !this.disposed) this.clearRecovery(commandId);
    this.completions.get(commandId)?.(outcome);
    this.completions.delete(commandId);
    if (status !== "failed") {
      this.confirmations.get(commandId)?.(outcome);
      this.confirmations.delete(commandId);
    }
  }
  private cancelQueued(message = saveProblem("queuedCancelled")) {
    for (const command of this.queue) this.settle(command.commandId, "cancelled", message);
    this.queue = [];
    this.syncUnloadWarning();
  }
  /** Offline: queued saves stay, pinned to the board they were made on (`pinToBoard`), and say so. */
  private holdQueued() {
    this.offlineHold = true;
    pinToBoard(this.queue, this.sheetSeen, this.held());
    for (const queued of this.queue) this.settle(queued.commandId, "failed", saveProblem("heldOffline"));
  }
  /** P058: a conflict cancels only the queued actions on its own record; the rest still go. */
  private cancelQueuedOn(event: WardFlowEvent, value: unknown) {
    const hit = this.queue.filter((queued) => conflict.sameConflictRecord(event, queued.event));
    this.queue = this.queue.filter((queued) => !hit.includes(queued));
    for (const queued of hit) this.settle(queued.commandId, "cancelled", conflict.queuedNotSentText(hit.length, value));
    this.syncUnloadWarning();
  }
  /** `sentMessage` is for a command already sent: the server may have applied it, so never say "not saved". */
  private cancelAll(message: string, sentMessage = saveProblem("notConfirmed")) {
    if (this.pending)
      this.settle(
        this.pending.commandId,
        "cancelled",
        this.sentCommandId === this.pending.commandId ? sentMessage : message,
      );
    this.pending = null;
    this.sentCommandId = null;
    this.cancelQueued(message);
  }
  private cancelForRoleChange() {
    // Fence outgoing drawers before their unmount cleanup can autosave into the next desk.
    if (this.options.manageDrafts !== false) clearReferralDraftSession();
    if (this.pending && this.sentCommandId === this.pending.commandId)
      this.settle(this.pending.commandId, "failed", saveProblem("roleChangedWhileSaving"));
    this.cancelAll(saveProblem("roleChanged"), saveProblem("roleChangedWhileSaving"));
  }
  /** End the working view before replacing a role or authoritative workspace. */
  private retireWorkingView() {
    this.cancelForRoleChange();
    this.clearRecovery();
    forgetDowntimePack();
    this.roleLifetime.abort();
    this.roleLifetime = new AbortController();
    this.viewGeneration += 1;
    this.headRevision = 0;
    this.sheetSeen = new WeakMap();
  }
  /** Only this command's own refusal is definite; a session ending after send leaves its outcome uncertain. */
  private settleForSessionEnd(body: unknown, message: string, answered: boolean) {
    const pending = this.pending;
    if (!pending) return;
    if (answered && body === pending) this.settle(pending.commandId, "refused", message);
    else if (this.sentCommandId === pending.commandId)
      this.settle(pending.commandId, "failed", saveProblem("sessionEndedWhileSaving"));
  }
  private disposed = false;
  private busy = false;
  /** Tier 1 item 1: saves held in memory (D-18) after a dropped connection, sent once a read succeeds. */
  private offlineHold = false;
  /** The save in flight got an HTTP answer: a failure is the server's, so it waits on Retry. */
  private saveAnswered = false;
  /** #817: the poll in flight, which a new save stops so the save is not held behind it. */
  private pollAbort: AbortController | null = null;
  /** Requests stay with the desk that started them, even while waiting for a token. */
  private viewGeneration = 0;
  /** Polls started before a grant must not replace the newly opened view. */
  private grantGeneration = 0;
  private needsRefresh = false;
  /** Bumped when the working role ends, so a reply to a request sent under it is not adopted. */
  private roleEpoch = 0;
  /** Local selection remains authoritative when a cleanup connection cannot persist a change. */
  private workingAsOverride: string | null | undefined;
  /** The revision this tab's own accepted revision-only commands reached, ahead of its snapshot. */
  private headRevision = 0;
  /** Drill 4: the server's restore marker last read; undefined before the first read. */
  private restoreMarker: string | null | undefined;
  /** CS-19: popup opening revisions let the server refuse stale edits after another desk changed the record. */
  private sheetSeen = new WeakMap<object, SheetSeen>();
  /** The popups the command in flight was asked for from, while it is in flight. */
  private pendingSheets: readonly object[] | undefined;
  private readonly stopWatchingSheets = subscribeToSheetStack(() => this.noteOpenSheets());
  private worldEpoch = 0;
  /** When this desk last read the whole workspace (its own part of it), for `FULL_READ_EVERY_MS`. */
  private fullReadAt = 0;
  private readonly lifetime = new AbortController();
  private readonly pacing = new SharedPacing(() => (this.options.random ?? Math.random)());
  /** Back online: read the board, which sends any held saves (`offlineHold`), spread across desks. */
  private readonly watchOnline = this.pacing.onOnline(() => void this.refresh(), this.lifetime.signal);
  /** Refused, or waiting on the person: no polling or saving until they act. */
  private gated() {
    return ["not-authorised", "choose-role", "no-role"].includes(this.view.status);
  }
  private bindingHost() {
    return {
      view: () => this.view,
      publish: (update: Partial<SharedView>) => this.publish(update),
      endRole: () => {
        this.cancelForRoleChange();
        this.clearRecovery();
      },
    };
  }
  private workingAs() {
    return this.workingAsOverride === undefined ? (this.options.workingAs?.get() ?? null) : this.workingAsOverride;
  }
  constructor(
    private readonly options: {
      baseUrl: string;
      token: (options?: { refresh?: boolean }) => Promise<string>;
      changed: (view: SharedView) => void;
      fetch?: typeof fetch;
      commandId?: () => string;
      /** False for detached sign-out cleanup: it never owns the current board's drafts. */
      manageDrafts?: boolean;
      /** Tab-session opaque command identity only; never store an event or payload. */
      recoveryStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
      /** Which of this account's roles to work as. The membership id only, never a name. */
      workingAs?: { get: () => string | null; set: (id: string | null) => void };
      /** Actual current Auth identity; required before an executive report may be adopted. */
      authenticatedActorId?: () => string | null;
      random?: () => number; // In [0, 1), for spreading reads (ward-shared-pacing.ts); tests fix it.
    },
  ) {}
  private held() {
    return Math.max(this.view.snapshot?.revision ?? 0, this.headRevision);
  }
  /** Notes each open popup not yet noted. One opened before the board arrived is noted when it does. */
  private noteOpenSheets() {
    if (!this.view.snapshot) return;
    for (const sheet of openSheetHandles())
      if (!this.sheetSeen.has(sheet)) this.sheetSeen.set(sheet, { revision: this.held(), records: new Map() });
  }
  /** The popups open now, each noted, for a command asked for now; `undefined` when none is. */
  private openSheetsNoted() {
    this.noteOpenSheets();
    const sheets = commandSheetHandles().filter((sheet) => this.sheetSeen.has(sheet));
    return sheets.length ? sheets : undefined;
  }
  /** What a command from these popups is checked against (`sheetBasis`). */
  private basis(sheets: readonly object[] | undefined) {
    return sheetBasis(this.sheetSeen, sheets);
  }
  /** This tab's own save moves its popups' basis on with it (`markOwnSave`). */
  private ownSaveLanded(from: number, to: number | undefined, sheets?: readonly object[], covered?: unknown) {
    const tracked = () => new Set([...openSheetHandles(), ...this.queue.flatMap((queued) => queued.sheets ?? [])]);
    markOwnSave(this.sheetSeen, tracked, from, to, sheets, covered);
  }
  /** Server archive for this desk and world; restored beside live records for History and reports. */
  private archive: {
    count: number;
    generation: number;
    accessContext: SharedSnapshot["accessContext"];
    records: ArchivedRecords;
    /** What a delta read builds on (audit PS-01); null when this archive came from an older server. */
    held: HeldArchive | null;
    /** The server's sender progress for these records, bound to the same access view and a
     * revision no older than the snapshot held when the read was asked. Null when absent or invalid. */
    view: WardPartialView | null;
  } | null = null;
  /** The live snapshot's bound sender display alone, before archived progress is added to it. */
  private liveSibling: BoundWardPartialView | undefined;
  /** The count the archive read in flight was asked for, so one read serves one change. */
  private archiveAsked: number | null = null;
  /** Bumped whenever the board is dropped, so an archive read sent before then is not used. */
  private archiveEpoch = 0;
  /** The last snapshot's payload as the server sent it, before archived records were put back. */
  private rawPayload: SharedSnapshot["payload"] | null = null;
  private recordDetail = new RecordDetailHold();
  private withArchive(
    payload: SharedSnapshot["payload"],
    accessContext: SharedSnapshot["accessContext"],
  ): SharedSnapshot["payload"] {
    return withArchivedRecords(this.recordDetail.apply(payload, accessContext), this.archive, accessContext);
  }
  /** The live display with the archive's progress beside it, for the same access view and world
   * generation only. Archived progress that is missing or invalid is simply left out. */
  private withArchivePartial(
    live: BoundWardPartialView | undefined,
    generation: number,
    accessContext: SharedSnapshot["accessContext"],
  ): BoundWardPartialView | undefined {
    const archive = this.archive;
    if (
      !live ||
      !archive?.view ||
      !mergeSharedPartialView ||
      archive.generation !== generation ||
      archive.accessContext !== accessContext
    )
      return live;
    return mergeSharedPartialView(live, archive.view);
  }
  /** Reads the archive again when the server's count for it changed, then shows it. */
  private async readArchive(count: number) {
    if (this.archiveAsked === count || this.disposed || !this.rawPayload) return;
    const generation = this.rawPayload.state.worldGeneration;
    this.archiveAsked = count;
    const epoch = this.archiveEpoch;
    const accessContext = this.view.snapshot?.accessContext;
    const askedAtRevision = this.view.snapshot?.revision ?? Number.POSITIVE_INFINITY;
    // Audit PS-01: an archive already held for this world and access view asks only for what was
    // archived since; a delta that does not check out is followed by one whole read.
    const base =
      this.archive?.held &&
      this.archive.accessContext === accessContext &&
      this.archive.generation === this.rawPayload?.state.worldGeneration
        ? this.archive.held
        : null;
    try {
      const read = async (path: string) => {
        const { response, value } = await this.request(path);
        const held = this.view.snapshot;
        if (
          epoch !== this.archiveEpoch ||
          !held ||
          held.accessContext !== accessContext ||
          held.payload.state.worldGeneration !== generation ||
          !this.rawPayload ||
          this.rawPayload.state.worldGeneration !== generation ||
          !response.ok
        )
          return null;
        return { held, value };
      };
      let reply = await read(base ? `/v1/workspace/archive?since=${base.through}` : "/v1/workspace/archive");
      if (!reply) return;
      let folded = foldArchiveReply(reply.value, base);
      if (folded === "reread") {
        reply = await read("/v1/workspace/archive");
        if (!reply) return;
        folded = foldArchiveReply(reply.value, null);
      }
      if (folded === "invalid" || folded === "reread" || !this.rawPayload) return;
      const { held, value } = reply;
      const records: ArchivedRecords = { movements: [], referrals: [], broadcastAlerts: [] };
      for (const entry of folded.entries) records[entry.collection].push(entry.body);
      // The sender progress for these records is trusted only as the live sibling is: bound to the
      // reply's own revision and this desk's access view, and not older than what was held when
      // the read was asked. A reply without a valid one still shows the records.
      const sibling =
        value.partialView !== undefined && Number.isSafeInteger(value.revision) && value.revision >= askedAtRevision
          ? bindSharedPartialView?.(value.partialView, {
              revision: value.revision,
              accessContext: accessContext ?? null,
            })
          : null;
      const archive = {
        count,
        generation,
        accessContext,
        records,
        held: folded.held,
        view: sibling?.view ?? null,
      };
      const previous = this.archive;
      this.archive = archive;
      const payload = this.withArchive(this.rawPayload, accessContext);
      // The records go back only when the board with them still passes the shared-state check.
      if (!isValidSharedState?.(structuredClone(payload.state))) {
        this.archive = previous;
        return;
      }
      this.publish({
        snapshot: {
          ...held,
          payload,
          partialView: this.withArchivePartial(this.liveSibling, archive.generation, accessContext),
        },
      });
    } catch {
      // History keeps what it had; the next count change asks again.
    } finally {
      if (epoch === this.archiveEpoch && this.archiveAsked === count) this.archiveAsked = null;
    }
  }
  private publish(update: Partial<SharedView>) {
    if (this.disposed) return;
    if (update.snapshot === null) {
      // A dropped desk has no inherited access deadline. Preserve an explicit replacement.
      update = {
        executiveSnapshot: null,
        workspaceId: undefined,
        accessUntil: undefined,
        recovery: undefined,
        recoveryResults: undefined,
        ...update,
      };
      this.archive = null;
      this.archiveAsked = null;
      this.rawPayload = null;
      this.liveSibling = undefined;
      this.recordDetail = new RecordDetailHold();
      this.archiveEpoch++;
    }
    if (update.snapshot) update = { ...update, executiveSnapshot: null };
    const changedLifetime = viewLifetimeChanged(this.view, update);
    this.syncUnloadWarning();
    this.view = {
      ...this.view,
      boardCurrent: false,
      ...update,
      viewEpoch: (this.view.viewEpoch ?? 0) + (changedLifetime ? 1 : 0),
      recovering: this.recoveryPending,
      recoveryStorageUnavailable: this.recoveryStorageUnavailable,
      pendingCount: (this.pending ? 1 : 0) + this.queue.length,
      unconfirmedSave: this.pending !== null || this.queue.length > 0 || this.recoveryPending,
      waiting: this.offlineHold ? (this.pending ? 1 : 0) + this.queue.length : 0,
    };
    if ("accessUntil" in update) {
      clearTimeout(this.accessTimer);
      const deadline = this.view.accessUntil;
      if (Number.isFinite(deadline)) {
        const expire = () => {
          if (this.disposed || this.view.accessUntil !== deadline) return;
          const remaining = deadline! - Date.now();
          if (remaining > 0) {
            this.accessTimer = setTimeout(expire, Math.min(2_147_483_647, remaining));
            return;
          }
          this.viewGeneration += 1;
          this.roleLifetime.abort();
          this.roleLifetime = new AbortController();
          if (this.pending && this.sentCommandId === this.pending.commandId)
            this.settle(
              this.pending.commandId,
              "failed",
              "Access expired while this action was being saved. Its outcome is uncertain; review the board after reconnecting.",
            );
          this.cancelAll(`Access expired. ${saveProblem("notReady")}`);
          this.clearRecovery();
          forgetDowntimePack();
          this.publish({
            snapshot: null,
            accessUntil: undefined,
            status: "unavailable",
            error: "Access verification expired. Reconnect to confirm your current role before viewing records.",
          });
        };
        // Longer delays overflow browser timers; check again without ending future access.
        this.accessTimer = setTimeout(expire, Math.min(2_147_483_647, Math.max(0, deadline! - Date.now())));
      }
    }
    this.options.changed(this.view);
  }
  private adopt(snapshot: SharedSnapshot) {
    const unchanged = checkSharedSnapshot(snapshot, this.rawPayload, isValidSharedState);
    if (Number.isFinite(snapshot.accessUntil)) {
      if (!Number.isFinite(this.view.accessUntil) || snapshot.accessUntil! < this.view.accessUntil!)
        this.publish({ accessUntil: snapshot.accessUntil });
    }
    const held = this.view.snapshot;
    if (snapshot.revision >= (held?.revision ?? 0)) {
      const generationChanged = held && snapshot.payload.state.worldGeneration !== held.payload.state.worldGeneration;
      if (generationChanged) this.worldEpoch++;
      // Cached and in-flight archive rows belong to the access view and world that requested them.
      if (held && (snapshot.accessContext !== held.accessContext || generationChanged)) {
        this.archive = null;
        this.archiveAsked = null;
        this.archiveEpoch++;
      }
      // PS-06: reuse unchanged records and lists, including on permission-only full polls.
      if (!unchanged) this.rawPayload = reuseUnchangedPayload(this.rawPayload, snapshot.payload);
      const raw = this.rawPayload!;
      const payload = reuseUnchangedPayload(held?.payload, this.withArchive(raw, snapshot.accessContext));
      if (this.options.manageDrafts !== false && snapshot.accessContext !== undefined)
        bindReferralDraftAccessContext(snapshot.accessContext);
      // A missing, malformed or stale sibling clears the previous display on this adoption.
      // The outer response supplies the lifetime; metadata cannot authenticate itself.
      const partialView =
        bindSharedPartialView?.(snapshot.partialView, {
          revision: snapshot.revision,
          accessContext: snapshot.accessContext ?? null,
        }) ?? undefined;
      this.liveSibling = partialView;
      this.publish({
        snapshot: {
          ...snapshot,
          payload,
          partialView: this.withArchivePartial(
            partialView,
            snapshot.payload.state.worldGeneration,
            snapshot.accessContext,
          ),
        },
        receivedAt: Date.now(),
      });
      this.noteOpenSheets();
      const archived = snapshot.archived;
      if (
        typeof archived === "number" &&
        archived > 0 &&
        (archived !== this.archive?.count || this.archive.generation !== snapshot.payload.state.worldGeneration)
      )
        void this.readArchive(archived);
    }
  }
  private async request(path: string, body?: PendingCommand | Record<string, unknown>) {
    try {
      return await this.requestOnce(path, body, false);
    } catch (error) {
      if (error !== FRESH_TOKEN) throw error;
      return this.requestOnce(path, body, true);
    }
  }
  private async requestOnce(
    path: string,
    body: PendingCommand | Record<string, unknown> | undefined,
    retried: boolean,
  ) {
    if (refusesRecordPath(this.view, path))
      throw new Error("Record operations are unavailable for aggregate reporting.");
    const roleSignal = this.roleLifetime.signal;
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    const authenticatedActor = this.options.authenticatedActorId?.();
    const workspaceRead = path === "/v1/workspace" || path.startsWith("/v1/workspace?");
    const tvRead = workspaceRead && globalThis.location?.pathname.startsWith("/ward-flow/bed-meeting");
    const current = () => {
      if (
        this.options.authenticatedActorId &&
        (!authenticatedActor || authenticatedActor !== this.options.authenticatedActorId())
      ) {
        this.cancelForRoleChange();
        this.clearRecovery();
        this.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null, status: "unavailable" });
        throw new Error("The signed-in account changed; reconnect.");
      }
      if (generation !== this.viewGeneration || (workspaceRead && grantGeneration !== this.grantGeneration))
        throw new Error("The working view changed; try again.");
    };
    let token: string;
    // #817: a queued save stops the poll even while the poll still waits for its token.
    const pollSignal = workspaceRead ? this.pollAbort?.signal : undefined;
    try {
      // Audit 24-3 SM-2: the retry after a 401 forces one refresh, so it never re-sends the same token.
      const auth = Promise.resolve().then(() =>
        retried ? this.options.token({ refresh: true }) : this.options.token(),
      );
      [, token] = await Promise.all([loadSharedStateCheck(), untilAborted(auth, pollSignal)]);
    } catch (error) {
      if (this.disposed || roleSignal.aborted || pollSignal?.aborted) throw error;
      if (
        generation === this.viewGeneration &&
        (!workspaceRead || grantGeneration === this.grantGeneration) &&
        error instanceof WardAuthError &&
        error.kind === "session"
      ) {
        this.clearRecovery();
        this.settleForSessionEnd(body, error.message, false);
        this.cancelAll("The session ended. Sign in and review the board before trying again.");
        this.roleLifetime.abort();
        this.roleLifetime = new AbortController();
        this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error: error.message });
      }
      throw error;
    }
    current();
    if (this.disposed || roleSignal.aborted) throw new Error("Connection closed");
    const stored = this.workingAs();
    const workingAs = stored && (stored === "bootstrap" || UUID.test(stored)) ? stored : null;
    let sentBinding: SentBinding | undefined;
    const send = async (as: string | null) => {
      // A token wait may outlive the ready board. Check at the actual access-write boundary too.
      if (
        body &&
        (path.startsWith("/v1/workspace/access/") || path === "/v1/workspace/break-glass") &&
        !this.accessChangeAllowed(path === "/v1/workspace/access/request")
      )
        throw new Error(`Shared access changes are unavailable. ${saveProblem("notReady")}`);
      if (path === "/v1/workspace/commands" && body && "commandId" in body) {
        if (Number.isFinite(this.view.accessUntil) && this.view.accessUntil! <= Date.now())
          throw new Error(`Access verification expired. ${saveProblem("notReady")}`);
        if (!this.recoveryWrite(body.commandId as string))
          throw new Error("Safe reload recovery could not be recorded.");
        this.sentCommandId = body.commandId as string;
      }
      if (body && this.options.authenticatedActorId)
        sentBinding =
          sentBindingFor(this.view, authenticatedActor, this.roleEpoch, this.grantGeneration) ?? sentBinding;
      const response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(as ? { "x-ward-working-as": as } : {}),
          // The server logs a whole read from the bed meeting TV board as "tv" (H-0731).
          ...(tvRead ? { "x-ward-screen": "tv" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: anySignal([
          AbortSignal.timeout(15000),
          this.lifetime.signal,
          roleSignal,
          ...(workspaceRead && this.pollAbort ? [this.pollAbort.signal] : []),
        ]),
      });
      if (path === "/v1/workspace/commands") this.saveAnswered = true;
      if (this.disposed || roleSignal.aborted) throw new Error("Connection closed");
      const value = onDeviceClock(await response.json().catch(() => null), Date.now());
      current();
      if (this.disposed || roleSignal.aborted) throw new Error("Connection closed");
      const noRole = response.status === 403 && (value?.code === "no-role" || value?.error === NO_ROLE);
      return { response, value, noRole };
    };
    // Audit 8 (#1571): an ended session or role forgets the downtime pack, as the access deadline does.
    const denied = (error: string) => {
      this.clearRecovery();
      forgetDowntimePack();
      this.settleForSessionEnd(body, error, true);
      this.cancelAll(saveProblem("sessionEnded"), saveProblem("sessionEndedWhileSaving"));
      this.roleLifetime.abort();
      this.roleLifetime = new AbortController();
      this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error });
      return new Error("Access denied");
    };
    const settleForRoleGate = () => {
      this.clearRecovery();
      if (this.pending && body === this.pending)
        this.settle(this.pending.commandId, "refused", saveProblem("roleEnded"));
      this.cancelForRoleChange();
    };
    const gate = (update: Partial<SharedView>) => {
      this.clearRecovery();
      forgetDowntimePack();
      settleForRoleGate();
      this.roleLifetime.abort();
      this.roleLifetime = new AbortController();
      this.publish({ snapshot: null, eventLog: [], error: null, ...update });
      return new Error("Waiting on the person");
    };
    const answer = await send(workingAs);
    current();
    if (answer.noRole && workingAs) {
      // The working role has ended or been removed. Forget it, even when the external setter cannot
      // persist that; never re-send a write under a remaining role the server would pick by default.
      this.workingAsOverride = null;
      this.options.workingAs?.set(null);
      if (body) {
        // Commands queued or awaiting retry were made under the ended role, so they go too. The desk
        // is cleared, so nothing more can be queued, and read again in full before any change.
        settleForRoleGate();
        this.roleEpoch += 1;
        this.viewGeneration += 1;
        this.publish({ snapshot: null, eventLog: [] });
        this.needsRefresh = true;
        queueMicrotask(() => {
          if (!this.busy && this.needsRefresh) {
            this.needsRefresh = false;
            void this.refresh();
          }
        });
        const ended = {
          code: "role-ended",
          error: "The role this tab was working as has ended. Review the current desk before making changes.",
        };
        return { response: new Response(JSON.stringify(ended), { status: 422 }), value: ended };
      }
      // A read invalidates every concurrent request, including access steps waiting for a token. A
      // fresh read chooses from the remaining roles without the old cache.
      this.viewGeneration += 1;
      const changed = gate({ status: "loading" });
      void this.refresh();
      throw changed;
    }
    const { response, value, noRole } = answer;
    // A powerful step needs a fresh sign-in. The caller asks for the password and tries again.
    if (response.status === 401 && value?.code === "step-up") return { response, value };
    const noRoleReason = typeof value?.code === "string" ? value.code : undefined;
    if (noRole) throw gate({ status: "no-role", canRequest: value?.canRequest === true, noRoleReason });
    // A role refusal on an access step or the record access log comes back as its reason, not as a sign-out.
    if (response.status === 403 && (path.startsWith("/v1/workspace/access") || path === "/v1/workspace/record-access"))
      return { response, value };
    // The sign-in reached the session limit (ISM-0428): signed out, with the server's reason.
    // Or it was signed out, here or on another tab: the server refuses its tokens at once.
    if (response.status === 401 && (value?.code === "session-limit" || value?.code === "signed-out"))
      throw denied(typeof value.error === "string" ? value.error : "Signed out. Sign in again to carry on.");
    // Audit 4 A4-02: only the Ward Flow server's own refusal (JSON with its reason) ends the session.
    // Its first 401 is asked once more with a fresh token, in case a refresh raced it; a command
    // keeps its id, so it cannot run twice. A proxy's own 401 or 403 page is a lost connection.
    if (response.status === 401 || response.status === 403) {
      if (typeof value?.error !== "string") throw new Error("Workspace unavailable");
      if (response.status === 401 && !retried) throw FRESH_TOKEN;
      // Audit 24-3 SV-6: the server's own reason, as for `signed-out` and `session-limit` above.
      throw denied(value.error);
    }
    // The server holds more than one role for this account and needs to be told which.
    if (response.status === 409 && value?.code === "choose-role") {
      const choices = roleChoices(value.choices);
      throw gate({ status: "choose-role", choices });
    }
    if (value === null) throw new Error("Workspace unavailable");
    // HTTP success is no receipt: a reply names its committed revision or carries a valid full board.
    if (
      path === "/v1/workspace/commands" &&
      body &&
      response.ok &&
      (!Number.isSafeInteger(value.commandRevision) || value.commandRevision < 1)
    )
      checkSharedSnapshot(value.snapshot, this.rawPayload, isValidSharedState);
    if (this.options.authenticatedActorId && (workspaceRead || value.snapshot || path === "/v1/workspace/commands")) {
      const rebound = await verifyResponseBinding(
        {
          ...this.bindingHost(),
          current,
          cancelQueued: () => this.cancelQueued(),
          clearRecovery: () => this.clearRecovery(),
          hasPending: () => !!this.pending,
          newRoleEpoch: () => {
            this.roleEpoch++;
            this.roleLifetime.abort();
            this.roleLifetime = new AbortController();
          },
          roleEpoch: () => this.roleEpoch,
          grantGeneration: () => this.grantGeneration,
        },
        { path, body, response, value, sentBinding, authenticatedActor, workspaceRead },
      );
      if (rebound) return rebound;
    }
    return { response, value };
  }
  async refresh(): Promise<"skipped" | void> {
    // Audit 4 A4-03: a save waiting on Retry does not stop the board being read: reads change
    // nothing. Held saves go once a read succeeds; the server still refuses a stale one (CS-19).
    if (this.busy) return "skipped" as const; // SD-04: a save or read in flight is not a failed read
    if (this.disposed || this.gated()) return;
    this.busy = true;
    let resend = false;
    const poll = (this.pollAbort = new AbortController());
    const roleSignal = this.roleLifetime.signal;
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    const authenticatedActor = this.options.authenticatedActorId?.();
    try {
      const current = this.view.executiveSnapshot ?? this.view.snapshot;
      const epoch = this.roleEpoch;
      // The poll names the revision it holds; an unchanged workspace answers with its clock only.
      // A desk's access context lets the server say "not modified" to a member desk too (audit
      // F-04). It is left out once a minute, so time-limited records drop off on a full read.
      const context =
        current?.accessContext && Date.now() - this.fullReadAt < FULL_READ_EVERY_MS
          ? `&context=${current.accessContext}`
          : "";
      const { response, value } = await this.request(
        current ? `/v1/workspace?since=${current.revision}${context}` : "/v1/workspace",
      );
      // The role ended or a grant landed while this read was out: drop it; the follow-up read replaces it.
      if (generation !== this.viewGeneration || grantGeneration !== this.grantGeneration || epoch !== this.roleEpoch)
        return;
      if (!response.ok) throw new Error("Workspace unavailable");
      const workspaceId =
        typeof value.workspaceId === "string" && value.workspaceId.trim() ? value.workspaceId : undefined;
      // Drill 4: a new restore marker means the database was restored (its revision went back, which
      // `adopt` never takes): drop the board and read it whole; waiting saves meet the normal 409.
      const restoreMarker = typeof value.restoreMarker === "string" ? value.restoreMarker : null;
      const restored = this.restoreMarker !== undefined && restoreMarker !== this.restoreMarker;
      this.restoreMarker = restoreMarker;
      if (this.view.snapshot && workspaceId !== this.view.workspaceId) {
        // The endpoint may have been rebound to another workspace at the same revision. Retire
        // its commands, openings and receipt before asking for that workspace's full board.
        this.retireWorkingView();
        this.publish({
          snapshot: null,
          workspaceId,
          eventLog: [],
          access: undefined,
          actorId: null,
          status: "loading",
          error: null,
        });
        return;
      }
      if (restored && (this.view.snapshot || this.view.executiveSnapshot)) {
        pinToBoard(this.queue, this.sheetSeen, this.held());
        [this.headRevision, this.needsRefresh] = [0, true];
        return this.publish({ snapshot: null, workspaceId, status: "loading", error: null });
      }
      const bound = await bindWorkspaceReply(
        {
          ...this.bindingHost(),
          stale: () =>
            this.disposed ||
            roleSignal.aborted ||
            generation !== this.viewGeneration ||
            grantGeneration !== this.grantGeneration ||
            epoch !== this.roleEpoch,
          canSwitch: () => !!this.workingAs(),
          fullRead: () => {
            this.fullReadAt = Date.now();
          },
        },
        { current, value, authenticatedActor, authenticatedActorId: this.options.authenticatedActorId },
      );
      if (!bound) return;
      const actualAccess = bound.access;
      if (Number.isFinite(value.accessUntil) && value.accessUntil <= Date.now())
        throw new Error("Access verification expired");
      if (value?.notModified === true) {
        if (!current || "kind" in current || value.revision !== current.revision || !Number.isFinite(value.now))
          throw new Error("Incompatible workspace data");
        if (this.view.snapshot === current)
          this.publish({ snapshot: { ...current, now: value.now }, receivedAt: Date.now() });
      } else {
        this.adopt(value.snapshot);
        this.fullReadAt = Date.now();
      }
      // Gate nested dispatches from changed() before exposing a recovered board as ready.
      try {
        this.recoveryPending =
          !this.pending &&
          !this.queue.length &&
          (this.recoveryPending || readCommandRecovery(this.options.recoveryStorage).entries.length > 0);
      } catch {
        /* Storage unavailable. */
      }
      this.publish({
        ...(this.pending
          ? {
              status: "unavailable" as const,
              boardCurrent: true,
              error: "Your last change was not confirmed. The board is up to date. Press Retry to send it.",
            }
          : { status: "ready" as const, error: this.view.status === "unavailable" ? null : this.view.error }),
        access: actualAccess,
        workspaceId,
        workingAs: typeof value.workingAs === "string" ? value.workingAs : null,
        actorId: typeof value.actorId === "string" ? value.actorId : null,
        canSwitch: !!this.workingAs(),
        choices: undefined,
        canRequest: undefined,
        accessUntil: Number.isFinite(value.accessUntil) ? value.accessUntil : undefined,
        receiptScope: typeof value.receiptScope === "string" ? value.receiptScope : undefined,
      });
      await this.recoverReceipt();
      resend = this.offlineHold && (this.pending !== null || this.queue.length > 0);
    } catch {
      if (
        generation === this.viewGeneration &&
        grantGeneration === this.grantGeneration &&
        !roleSignal.aborted &&
        !poll.signal.aborted &&
        !this.gated()
      ) {
        if (!this.offlineHold) this.cancelQueued(saveProblem("queuedNotRefreshed"));
        this.publish({
          status: "unavailable",
          error: saveProblem("notRefreshed"),
        });
      }
    } finally {
      this.busy = false;
      this.pollAbort = null;
      if (resend && !this.disposed) void this.drain();
      if (!this.disposed && this.needsRefresh) {
        this.needsRefresh = false;
        void this.refresh();
      }
      if (generation !== this.viewGeneration && this.view.status === "loading") await this.refresh();
      else if (this.queue.length && this.view.status === "ready") void this.drain();
    }
  }
  dispatch = (event: WardFlowEvent): Promise<WardCommandOutcome> => this.enqueue(event, false);
  /** Feedback and Undo need this command's full accepted snapshot, even in a queued burst. */
  dispatchConfirmed = (event: WardFlowEvent): Promise<WardCommandOutcome> => this.enqueue(event, true);
  private enqueue(event: WardFlowEvent, confirmed: boolean): Promise<WardCommandOutcome> {
    const commandId = (this.options.commandId ?? (() => crypto.randomUUID()))();
    if (
      !this.view.snapshot ||
      !(["ready", "saving"].includes(this.view.status) || (this.offlineHold && this.view.status === "unavailable")) ||
      this.disposed ||
      this.recoveryPending ||
      (Number.isFinite(this.view.accessUntil) && this.view.accessUntil! <= Date.now())
    )
      return Promise.resolve({
        commandId,
        status: "cancelled",
        message: saveProblem("notReady"),
      });
    const roleSignal = this.roleLifetime.signal;
    const generation = this.viewGeneration;
    const worldEpoch = this.worldEpoch;
    const worldGeneration = this.view.snapshot.payload.state.worldGeneration;
    const replacesWorld = event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO";
    const currentOutcome = (outcome: WardCommandOutcome): WardCommandOutcome => {
      return {
        ...outcome,
        isCurrent: () =>
          !this.disposed &&
          !roleSignal.aborted &&
          generation === this.viewGeneration &&
          (this.worldEpoch === worldEpoch ||
            (replacesWorld &&
              outcome.status === "accepted" &&
              this.worldEpoch === worldEpoch + 1 &&
              this.view.snapshot?.payload.state.worldGeneration === worldGeneration + 1)),
        canUndo: () => !!this.view.snapshot && ["ready", "saving"].includes(this.view.status),
      };
    };
    const confirmation = new Promise<WardCommandOutcome>((resolve) =>
      this.confirmations.set(commandId, (outcome) => resolve(currentOutcome(outcome))),
    );
    const completion = new Promise<WardCommandOutcome>((resolve) =>
      this.completions.set(commandId, (outcome) => {
        resolve({
          ...currentOutcome(outcome),
          confirmation,
        });
      }),
    );
    this.queue.push({
      event,
      commandId,
      confirmed: confirmed || event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO",
      worldEpoch: this.worldEpoch,
      sheets: this.openSheetsNoted(),
    });
    // Made while offline: pinned now, before a resend can adopt a newer board.
    this.recoveryWrite(commandId, "queued");
    if (this.offlineHold) pinToBoard(this.queue.slice(-1), this.sheetSeen, this.held());
    // #817: a poll in flight is stopped (reads change nothing) so the save goes now, not after it.
    this.pollAbort?.abort();
    this.publish({});
    void this.drain();
    return completion;
  }
  private async drain() {
    if (this.busy || this.disposed || this.pacing.limited) return;
    this.busy = true;
    const generation = this.viewGeneration;
    try {
      while (!this.disposed && (this.pending || this.queue.length)) {
        if (!this.pending) {
          const snapshot = this.view.snapshot;
          const queued = this.queue.shift();
          if (!snapshot || !queued) break;
          if (queued.worldEpoch !== this.worldEpoch) {
            this.settle(queued.commandId, "cancelled", saveProblem("replaced"));
            continue;
          }
          const basis = this.basis(queued.sheets);
          this.pendingSheets = basis ? queued.sheets : undefined;
          this.pending = {
            classification: "synthetic",
            dataMode: "prototype",
            commandId: queued.commandId,
            expectedRevision: basis?.revision ?? Math.max(snapshot.revision, this.headRevision),
            ...(basis && Object.keys(basis.records).length ? { seen: basis.records } : {}),
            event: withoutChartContent(queued.event),
            ...(this.queue.length && !queued.confirmed ? { reply: "revision" as const } : {}),
          };
        }
        this.publish({ status: "saving", error: null });
        const command = this.pending;
        const grantGeneration = this.grantGeneration;
        const epoch = this.roleEpoch;
        this.saveAnswered = false;
        const { response, value } = await this.request("/v1/workspace/commands", command);
        // An ended role is this command's own definitive answer, though it also bumps the generation.
        if (generation !== this.viewGeneration && value?.code !== "role-ended") return;
        if (response.status >= 500) throw new Error("Save not confirmed");
        if (response.status === 429) {
          // M53: refused before any work, so every save is kept and sent again after Retry-After.
          this.sentCommandId = null;
          this.pacing.holdFor(response, () => void this.drain());
          for (const kept of [...(this.pending ? [this.pending] : []), ...this.queue])
            this.settle(kept.commandId, "failed", saveProblem("busy"));
          this.publish({ status: "ready", error: saveProblem("busy") });
          break;
        }
        if (value.responseBindingChanged) {
          this.sentCommandId = null;
          this.clearRecovery(command.commandId);
          this.pending = null;
          this.settle(command.commandId, response.ok ? "accepted" : "refused");
          this.needsRefresh = true;
          this.publish({ status: "unavailable", error: boardNotRefreshed(response.ok) });
          break;
        }
        let reconciliationFailed = false;
        if (value.snapshot && epoch === this.roleEpoch) {
          if (grantGeneration === this.grantGeneration) this.adopt(value.snapshot);
          else {
            // The command has its definitive answer; a permissions-only read must not retry or reclassify it.
            this.pending = null;
            this.publish({});
            this.settle(
              command.commandId,
              response.ok ? "accepted" : "refused",
              response.ok ? undefined : typeof value.error === "string" ? value.error : "The action was not applied.",
              response.ok ? value.snapshot.payload.state.undoRecords : undefined,
              response.ok ? value : undefined,
            );
            // Keep the definitive result but read the newly granted view; a concurrent grant
            // retries this read with the new generation (the command ID is retained).
            try {
              let latest: Awaited<ReturnType<typeof this.request>>;
              for (;;) {
                const readGrantGeneration = this.grantGeneration;
                try {
                  latest = await this.request("/v1/workspace");
                  if (generation !== this.viewGeneration) return;
                  if (readGrantGeneration !== this.grantGeneration) continue;
                  break;
                } catch (error) {
                  if (generation === this.viewGeneration && readGrantGeneration !== this.grantGeneration) continue;
                  throw error;
                }
              }
              if (!latest.response.ok) throw new Error("Save not confirmed");
              this.adopt(latest.value.snapshot);
            } catch {
              if (generation !== this.viewGeneration || this.disposed || this.gated()) return;
              reconciliationFailed = true;
            }
          }
        } else if (response.ok && Number.isSafeInteger(value.commandRevision)) {
          // A command sent against an older revision can land on top of other desks' saves. This
          // tab has not seen those, so it moves its base on only when nothing came in between;
          // otherwise the server keeps checking later commands against what this tab last saw.
          if (value.commandRevision === command.expectedRevision + 1)
            this.headRevision = Math.max(this.headRevision, value.commandRevision);
          else this.needsRefresh = true;
        }
        // Keep the uncertain-save marker until the returned board has passed adoption checks.
        this.sentCommandId = null;
        this.clearRecovery(command.commandId);
        if (response.ok)
          this.ownSaveLanded(
            command.expectedRevision,
            value.commandRevision ?? value.snapshot?.revision,
            this.pendingSheets,
            value.covered,
          );
        const previousLog = this.view.eventLog ?? [];
        const logged = {
          ...eventLogEntryFor(command.event, response.ok),
          sequence: (previousLog.at(-1)?.sequence ?? -1) + 1,
        };
        this.publish({
          eventLog:
            previousLog.length >= MAX_SHARED_EVENT_LOG_ENTRIES
              ? [...previousLog.slice(-(MAX_SHARED_EVENT_LOG_ENTRIES - 1)), logged]
              : [...previousLog, logged],
        });
        this.pending = null;
        if (reconciliationFailed) {
          this.cancelQueued();
          if (
            response.ok &&
            value.snapshot.payload.state.worldGeneration !== this.view.snapshot?.payload.state.worldGeneration
          )
            this.worldEpoch++;
          this.settle(
            command.commandId,
            response.ok ? "accepted" : "refused",
            response.ok ? undefined : typeof value.error === "string" ? value.error : "The action was not applied.",
            response.ok ? value.snapshot.payload.state.undoRecords : undefined,
            response.ok ? value : undefined,
          );
          this.publish({
            status: "unavailable",
            error: boardNotRefreshed(response.ok),
          });
          return;
        }
        if (!response.ok) {
          const scoped = response.status === 409 && conflict.namedConflict(value);
          if (scoped) this.cancelQueuedOn(command.event, value);
          else this.cancelQueued();
          if (response.status === 409) {
            // The person has been told; open popups are checked against the board from here on.
            this.sheetSeen = conflict.keepBasis(scoped && this.queue, this.sheetSeen, command.expectedRevision);
            if (!value?.snapshot) this.needsRefresh = true;
            else this.noteOpenSheets();
          }
          this.publish({
            status: "ready",
            error:
              response.status === 409
                ? scoped
                  ? conflict.changedFirstText(value)
                  : saveProblem("changedMeanwhile")
                : value?.code === "scope" && typeof value.error === "string"
                  ? `${value.error} Nothing was changed.`
                  : value?.code === "role-ended" && typeof value.error === "string"
                    ? value.error
                    : command.event.role === "demo" && value.snapshot?.demoControls === false
                      ? saveProblem("demoControlsOff")
                      : response.status === 422 && typeof value?.error === "string" && value.error.trim()
                        ? // Audit F-08: the workflow's own reason, as the local board shows it.
                          `${sentence(value.error)} Nothing was changed.`
                        : response.status === 413 && value?.code === "workspace-full"
                          ? saveProblem("boardFull")
                          : saveProblem("refused"),
          });
          this.settle(command.commandId, "refused", this.view.error ?? "The action was not applied.");
          if (scoped && this.queue.length) continue;
          break;
        }
        if (!value.snapshot && (command.event.type === "RESET_SCENARIO" || command.event.type === "SET_SCENARIO"))
          this.worldEpoch++;
        const partly = value.outcome === "partly" && typeof value.error === "string" ? value.error : undefined;
        this.settle(command.commandId, "accepted", undefined, value.snapshot?.payload.state.undoRecords, value, partly);
        // Audit E-05: the board's message line names the ward that was not asked, as the local refusal note does.
        this.publish({
          status: "ready",
          error: partly ? `Sent to the suitable wards only. ${sentence(partly)}` : null,
        });
      }
    } catch {
      if (generation === this.viewGeneration) {
        if (this.pending) this.settle(this.pending.commandId, "failed", saveProblem("connectionLost"));
        // A server that answered waits on Retry, so a fault is not resent on every poll.
        if (this.saveAnswered || (!this.pending && !this.queue.length)) {
          this.offlineHold = false;
          this.cancelQueued();
        } else this.holdQueued();
      }
      if (generation === this.viewGeneration && !this.disposed && !this.gated() && this.view.status !== "loading")
        this.publish({
          status: "unavailable",
          error: saveProblem("mayNotBeSaved"),
        });
    } finally {
      this.busy = false;
      if (!this.pending && !this.queue.length && this.offlineHold) {
        this.offlineHold = false;
        this.publish({});
      }
      if (generation !== this.viewGeneration && this.view.status === "loading") await this.refresh();
      // A run that ended on a revision-only reply or an ended role reads the board once to catch up.
      if (
        !this.disposed &&
        (this.needsRefresh || (this.headRevision > (this.view.snapshot?.revision ?? 0) && this.view.status === "ready"))
      ) {
        this.needsRefresh = false;
        void this.refresh();
      }
    }
  }
  /** Phone push (feature 4): the calls live in `ward-shared-push-api.ts`. */
  private readonly ask: SharedAsk = (path, body) => this.request(path, body);
  pushKey = () => push.pushKey(this.ask);
  pushSubscribe = (subscription: push.PushSubscriptionShape) => push.pushSubscribe(this.ask, subscription);
  pushStatus = (endpoint: string) => push.pushStatus(this.ask, endpoint);
  pushUnsubscribe = (endpoint: string) => push.pushUnsubscribe(this.ask, endpoint);
  /** D-80: log an opening best-effort; true only once its H-0731 detail was adopted. */
  async logRecordView(patientId: string, surface: RecordViewSurface): Promise<boolean> {
    if (this.view.executiveSnapshot || !this.view.snapshot) return false;
    const asked = this.recordDetail.view; // H-0731: a logged opening also sends that record's detail.
    try {
      const { response, value } = await this.request("/v1/workspace/record-access", { patientId, surface });
      const held = this.view.snapshot;
      if (!held || !this.rawPayload || !this.recordDetail.take(response.ok ? value : null, asked)) return false;
      const payload = this.withArchive(this.rawPayload, held.accessContext);
      this.publish({ snapshot: { ...held, payload: reuseUnchangedPayload(held.payload, payload) } });
      return true;
    } catch {
      return false; // Logged on the next opening; the page itself is unaffected.
    }
  }
  /** D-80 item 14: the record views of the last 7 days and the break glass openings, for a coordinator. */
  async readRecordAccess(): Promise<{ views: SharedRecordView[]; openings: SharedBreakGlassOpening[] }> {
    const { response, value } = await this.request("/v1/workspace/record-access");
    if (!response.ok) throw new Error("Record access could not be read");
    return {
      views: Array.isArray(value?.views) ? value.views : [],
      openings: Array.isArray(value?.openings) ? value.openings : [],
    };
  }
  /**
   * Audit pages keep completeness and the permitted continuation cursor. P056: rows are reduced to
   * the Activity contract (with this actor's own command id) and refused if the desk changed meanwhile.
   */
  readActivityAuditPage = async (before?: string) => {
    const generation = this.viewGeneration;
    const context = this.view.snapshot?.accessContext;
    const page = await activityAudit.readActivityAuditPage(this.ask, before);
    return { ...page, events: await this.ownActivityEvents(page.events, generation, context) };
  };
  /** Compatibility for callers that only need the newest permitted audit page. */
  readActivityAudit = async () => {
    const generation = this.viewGeneration;
    const context = this.view.snapshot?.accessContext;
    return this.ownActivityEvents(await activityAudit.readActivityAudit(this.ask), generation, context);
  };
  private async ownActivityEvents(
    events: SharedActivityAuditEvent[],
    generation: number,
    context: string | undefined,
  ): Promise<SharedActivityAuditEvent[]> {
    const { activityAuditEvents } = await import("./ward-own-command-receipt");
    if (this.disposed || generation !== this.viewGeneration || context !== this.view.snapshot?.accessContext)
      throw new Error("Activity could not be read");
    return activityAuditEvents(events);
  }
  /** An outcome belongs to this actor; Undo attribution additionally belongs to this exact desk. */
  async readOwnCommand(commandId: string) {
    if (!UUID.test(commandId) || this.view.status !== "ready" || !this.accessChangeAllowed())
      throw new Error("The change could not be checked");
    const generation = this.viewGeneration,
      grant = this.grantGeneration,
      actor = this.view.actorId;
    const context = this.view.snapshot?.accessContext;
    const { response, value } = await this.request(`/v1/workspace/receipt?commandId=${encodeURIComponent(commandId)}`);
    const { ownCommandReceipt } = await import("./ward-own-command-receipt");
    if (
      !response.ok ||
      this.disposed ||
      this.view.status !== "ready" ||
      !this.accessChangeAllowed() ||
      generation !== this.viewGeneration ||
      grant !== this.grantGeneration ||
      actor !== this.view.actorId ||
      context !== this.view.snapshot?.accessContext
    )
      throw new Error("The workspace or working role changed. Review the current board.");
    return ownCommandReceipt(value?.receipt);
  }
  /** End the server sign-in immediately; true only when the server recorded it. */
  async signOutServer(): Promise<boolean> {
    const { response, value } = await this.request("/v1/workspace/sign-out", {});
    return response.ok && value?.signedOut === true;
  }
  /** Work as one of this account's roles (`choose-role`), then read the board again. */
  chooseRole = (workingAs: string) => {
    if (workingAs !== "bootstrap" && !UUID.test(workingAs)) return;
    this.retireWorkingView();
    this.workingAsOverride = workingAs;
    this.options.workingAs?.set(workingAs);
    this.publish({ snapshot: null, eventLog: [], status: "loading", choices: undefined, error: null });
    void this.refresh();
  };
  /** Forget the role worked as, so the server lists this account's roles again. */
  switchRole = () => {
    this.retireWorkingView();
    this.workingAsOverride = null;
    this.options.workingAs?.set(null);
    this.publish({ snapshot: null, eventLog: [], status: "loading", error: null });
    void this.refresh();
  };
  private accessChangeAllowed(requestingRole = false): boolean {
    if (
      this.disposed ||
      this.recoveryPending ||
      (Number.isFinite(this.view.accessUntil) && this.view.accessUntil! <= Date.now())
    )
      return false;
    if (requestingRole && this.view.status === "no-role") return true;
    return !!this.view.snapshot && ["ready", "saving"].includes(this.view.status);
  }
  /** A change on an access route: done, a fresh sign-in first, or the server's reason. */
  private async change(path: string, body: Record<string, unknown>): Promise<SharedChangeResult> {
    if (!this.accessChangeAllowed(path === "/v1/workspace/access/request"))
      return "Shared access changes are unavailable. Reconnect and finish checking any uncertain save first.";
    const { response, value } = await this.request(path, body);
    if (response.ok) return null;
    if (response.status === 401 && value?.code === "step-up") return "step-up";
    if (response.status >= 500) throw new Error("Change not confirmed");
    return typeof value?.error === "string" ? value.error : "The change was not made.";
  }
  /** Roles and open requests inside this access admin's own place. */
  async listAccess(): Promise<{ memberships: SharedMembership[]; requests: SharedAccessRequest[] }> {
    const lifetime = this.roleLifetime;
    return readAccessDirectory(
      (path) => this.request(path),
      () => lifetime === this.roleLifetime && !lifetime.signal.aborted,
    );
  }
  /** D-80: newest openings; only statewide coordinator and access admin may read them. */
  async listRecordViews(): Promise<SharedRecordView[]> {
    const { response, value } = await this.request("/v1/workspace/record-access");
    if (!response.ok)
      throw new Error(typeof value?.error === "string" ? value.error : "The access log could not be read");
    return Array.isArray(value.views) ? value.views : [];
  }
  /** Migration 17: this account's Help memory; with a body, saves first. */
  async preferences(body?: Record<string, unknown>): Promise<unknown> {
    const { response, value } = await this.request("/v1/workspace/preferences", body);
    if (!response.ok) throw new Error("Saved Help memory could not be read");
    return value;
  }
  /** Proposal 013: this desk's shared forecast history; with a body, records a snapshot or reason first. */
  async forecastHistory(body?: Record<string, unknown>): Promise<unknown> {
    const { response, value } = await this.request("/v1/workspace/forecast-history", body);
    if (!response.ok) throw forecastHistoryFailure(value);
    return value;
  }
  /** Cover given or held by this account, and, for a coordinator, inside its place. */
  async listCovers(): Promise<SharedMembership[]> {
    const { response, value } = await this.request("/v1/workspace/access/cover");
    if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Cover could not be read");
    return Array.isArray(value.covers) ? value.covers : [];
  }
  grantAccess(input: { actorId: string; role: string; scope: unknown; expiresInMinutes: number }) {
    return this.change("/v1/workspace/access/grant", {
      actorId: input.actorId,
      role: input.role,
      scope: input.scope,
      expiresInMinutes: input.expiresInMinutes,
    });
  }
  /** Removes a role, or ends cover early (its giver may too). */
  revokeAccess(membershipId: string) {
    return this.change("/v1/workspace/access/revoke", { membershipId });
  }
  giveCover(input: { actorId: string; scope: unknown; minutes: number }) {
    return this.change("/v1/workspace/access/cover", input);
  }
  decideRequest(requestId: string, decision: "approved" | "declined", expiresInMinutes: number) {
    return this.change("/v1/workspace/access/decide", { requestId, decision, expiresInMinutes });
  }
  /** Open one out-of-care record read only for the window. The server checks and records the listed
   *  reason (never typed text) and answers with the board, so the record shows at once. */
  async breakGlass(patientId: string, reason: string): Promise<SharedChangeResult> {
    if (!this.accessChangeAllowed())
      return "Opening records is unavailable. Reconnect and finish checking any uncertain save first.";
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    const { response, value } = await this.request("/v1/workspace/break-glass", { patientId, reason });
    if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
    if (response.ok) {
      this.grantGeneration += 1;
      try {
        let opened = value;
        if (value.responseBindingChanged || grantGeneration !== this.grantGeneration - 1) {
          // Response order is not commit order. Once another opening has answered, re-read the
          // server's full current grant set instead of accepting an earlier response's subset.
          const latest = await this.request("/v1/workspace");
          if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
          if (!latest.response.ok) throw new Error("Opened view unavailable");
          opened = latest.value;
        }
        if (opened?.snapshot) {
          this.adopt(opened.snapshot);
          if (this.options.authenticatedActorId)
            this.publish({
              access: opened.access,
              actorId: opened.actorId,
              accessUntil: opened.accessUntil,
              status: this.pending ? "saving" : "ready",
            });
        }
      } catch {
        // The next poll reads the board again.
        if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
        if (value.responseBindingChanged) {
          this.needsRefresh = this.busy;
          this.publish({ status: "unavailable", error: boardNotRefreshed(true) });
        }
      }
      return null;
    }
    if (response.status === 401 && value?.code === "step-up") return "step-up";
    if (response.status >= 500) throw new Error("Change not confirmed");
    return typeof value?.error === "string" ? value.error : "The record was not opened.";
  }
  /** This account's own open request for access, if any. Open to an account with no role. */
  async ownRequest(): Promise<SharedAccessRequest | null> {
    const { response, value } = await this.request("/v1/workspace/access/request");
    if (!response.ok) throw new Error("Your request could not be read");
    return value?.request ?? null;
  }
  /** Ask an access admin for a role at a place. The answer is the server's reason, or `null`. */
  async requestAccess(role: string, scope: unknown): Promise<SharedChangeResult> {
    return this.change("/v1/workspace/access/request", { role, scope });
  }
  retry = async () => {
    // "Check again" from the role picker or the ask for access screen reads the account again.
    if (this.view.status === "no-role" || this.view.status === "choose-role")
      this.publish({ status: "loading", error: null });
    if (this.pending) await this.drain();
    else await this.refresh();
  };
  /** P172: dismiss a read outcome, keeping an unresolved receipt's warning until it settles. */
  dismissRecovery = (shown?: string) => {
    if (this.disposed || this.view.recovering || this.view.recovery === undefined) return;
    // A newer outcome than the one the person read stays until they read it.
    if (shown !== undefined && shown !== this.view.recovery) return;
    // Putting a message away is not news about the board, so what the status bar knows stays as it was.
    this.publish({ recovery: undefined, recoveryResults: undefined, boardCurrent: this.view.boardCurrent });
  };
  dispose() {
    this.disposed = true;
    this.stopWatchingSheets();
    // Detached sign-out cleanup belongs to the outgoing account, never the replacement desk.
    if (this.options.manageDrafts !== false) forgetDowntimePack();
    clearTimeout(this.accessTimer);
    this.pacing.stop();
    this.syncUnloadWarning();
    this.lifetime.abort();
    this.cancelAll(saveProblem("connectionClosed"));
    this.view = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  }
}
