"use client";
import { forgetDowntimePack } from "./reports/downtime-pack";
import { useEffect, useRef, useState } from "react";
import { setActNowAppBadge } from "./shell/ward-act-now-notifications";
import { releasePhonePush, rememberPhonePushOwnership } from "./shell/ward-phone-push";
import type { SharedView, SharedWorkspaceClient } from "./ward-shared-client";
import { endWardFlowBrowserSession, endWardFlowTabSession, onWardSessionEnd } from "./ward-browser-data";
import { setDraftAccount } from "./ward-session-drafts";
import { clearReferralDraftSession } from "./referrals/referral-draft-lifecycle";
import { startWardPolling } from "./ward-shared-polling";
import { CLINICAL_VALUES } from "./ward-clinical-values";

/** Every Ward Flow tab in this browser hears a deliberate sign-out (Audit 5 PS-08, Audit 4 A4-06). */
const SESSION_CHANNEL = "ward-flow-session";
const SESSION_ENDED_MESSAGE = "Your session ended. Sign in again to carry on.";
const SIGN_IN_NOT_KEPT_MESSAGE = "This browser could not keep your sign-in. A reload will ask you to sign in again.";

/** Whether this tab still stores a sign-in; `null` when the browser blocks storage. */
function storedSignIn(): boolean | null {
  try {
    return window.sessionStorage.getItem(WARD_AUTH_STORAGE_KEY) !== null;
  } catch {
    return null;
  }
}
const IDLE_ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * When this sign-in reaches the session limit: the token's oldest sign-in factor plus the limit,
 * as the server counts it (ISM-0428). `null` when the token carries no start time.
 */
function sessionEndsAt(token: string): number | null {
  const startedAt = signInStartedAt(token);
  return startedAt === null ? null : startedAt + CLINICAL_VALUES.sessionLimit.value * 3_600_000;
}

/** Set once the shared client has loaded on the first sign-in. */
let loadedClient: typeof SharedWorkspaceClient | null = null;
import {
  WardAuthError,
  consumeRecoveryLink,
  deviceStorage,
  WARD_AUTH_BUSY_MESSAGE,
  WARD_AUTH_STORAGE_KEY,
} from "./ward-auth-link";
import type { WardBrowserAuthAdapter } from "./ward-supabase-auth";
import { createWardAuth, tabStorage } from "./ward-auth-session";
import { renewFrontDoorPass } from "@/components/ward-management/front-door/front-door-pass-client";
import {
  SIGNED_OUT_NOTICE,
  SIGNED_OUT_UNCONFIRMED_NOTICE,
  UNSENT_CHANGES_DROPPED_NOTICE,
} from "@/components/ward-management/front-door/front-door-notice";
import { heldActionsWaiting, sendHeldActions } from "./ward-held-actions";
import { signInStartedAt } from "@/components/ward-management/ward-sign-in-started-at";

/** #805, #839: fetch the shared client and every chunk its first read awaits (state checks and the
 * scenario wards) while the sign-in is checked, not one after another once it is. */
function prefetchSharedClient() {
  void Promise.all([
    import("./ward-shared-client"),
    import("./ward-shared-state-validation"),
    import("./ward-partial-view-contract"),
    import("./ward-scenario-networks"),
  ]).catch(() => {});
}

/**
 * At sign-out: revoke this account's phone alerts for this device, so the next person at a shared
 * phone starts with them off, then end the sign-in on the server, so its token is refused at once
 * rather than when it expires (readiness review item 8). The alerts go first, because the server
 * refuses everything but turning them off once the sign-in has ended. Best effort, each step
 * bounded to two seconds, through a client of its own that reports nothing back. `token` was
 * captured before the local session cleared.
 */
function releasePhoneAlerts(baseUrl: string, token: string | null, chosen: string | null, ownerId: string | null) {
  if (!token || !loadedClient) return;
  const cleanup = new loadedClient({
    manageDrafts: false,
    baseUrl: baseUrl.replace(/\/$/, ""),
    token: async () => token,
    changed: () => {},
    workingAs: { get: () => chosen, set: () => {} },
  });
  const bounded = async (step: () => Promise<unknown>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      step(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 2000);
      }),
    ])
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  };
  void (async () => {
    await bounded(() =>
      releasePhonePush({
        ownerId: ownerId ?? undefined,
        pushKey: () => cleanup.pushKey(),
        pushStatus: (endpoint) => cleanup.pushStatus(endpoint),
        pushSubscribe: (subscription) => cleanup.pushSubscribe(subscription),
        pushUnsubscribe: (endpoint) => cleanup.pushUnsubscribe(endpoint),
      }),
    );
    await bounded(() => cleanup.signOutServer());
  })().finally(() => cleanup.dispose());
}
/**
 * `credentials`: the email or password was refused. `unavailable`: the sign-in service did not
 * answer. `sent`: a reset link was asked for. `info` and `warning`: anything else worth saying.
 */
export type WardCredentialMessageKind = "credentials" | "unavailable" | "sent" | "info" | "warning";
export type WardCredentialForm = {
  open: boolean;
  recovery: boolean;
  /** Fresh audit X-1: the account a recovery link is for, so a link from someone else is noticed. */
  accountEmail?: string | null;
  signupAvailable: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  busy: boolean;
  message: string | null;
  /** What `message` is, so the sign-in screen can say it in the right tone. */
  messageKind?: WardCredentialMessageKind | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** P191: present after a blocked saved sign-in, so Try again retries it in place without a reload. */
  retry?: () => void;
  recover: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  cancel: () => void;
};
/** P191 (Josh, 27 Oct 2026): a blocked saved sign-in is retried quietly after these waits first. */
const RESTORE_RETRY_MS = [2_000, 5_000, 10_000];
const restoreBlocked = (error: unknown) => !(error instanceof WardAuthError) || error.kind === "unavailable";
const restoreRetryNotice = (error: unknown) =>
  error instanceof WardAuthError && error.message === WARD_AUTH_BUSY_MESSAGE
    ? "Sign-in is busy right now. Ward Flow will try again in a few seconds."
    : "The sign-in service is slow to answer. Ward Flow will try again in a few seconds.";
const emptyView: SharedView = {
  snapshot: null,
  executiveSnapshot: null,
  receivedAt: 0,
  status: "loading",
  error: null,
};
/** Which of this account's roles this tab works as: a membership id or "bootstrap", nothing else. */
const WARD_WORKING_AS_KEY = "wardflow:working-as-v1";
// Held in memory too, so a tab whose storage refuses the write still keeps the role it picked
// until it reloads, rather than being shown the picker again.
let workingAsInMemory: string | null = null;
const workingAs = {
  get: () => {
    try {
      return window.sessionStorage.getItem(WARD_WORKING_AS_KEY) ?? workingAsInMemory;
    } catch {
      return workingAsInMemory;
    }
  },
  set: (id: string | null) => {
    workingAsInMemory = id;
    try {
      if (id) window.sessionStorage.setItem(WARD_WORKING_AS_KEY, id);
      else window.sessionStorage.removeItem(WARD_WORKING_AS_KEY);
    } catch {
      // Storage refused: the copy in memory serves this tab.
    }
  },
};
// The next account at this tab picks its own role, even after an expiry rather than a sign-out.
onWardSessionEnd(() => {
  workingAsInMemory = null;
});
export function useWardSupabaseShared(
  enabled: boolean,
  createAuth: () => WardBrowserAuthAdapter | Promise<WardBrowserAuthAdapter> = createWardAuth,
) {
  const [view, setView] = useState<SharedView>(emptyView);
  const [ownership, setOwnership] = useState<{
    auth: WardBrowserAuthAdapter;
    view: SharedView | null;
    client: SharedWorkspaceClient | null;
    actorId: string | null;
  } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // #791: the signed-in account's email, shown beside Sign out. Memory only, like the auth's own copy.
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  // P013: true from connect() until its first workspace read settles, so the shell shows a bare
  // spinner rather than the sign-in or Reconnect screen while nothing has failed yet.
  const [firstRead, setFirstRead] = useState(false);
  /** What the sign-in screen says after a deliberate sign-out; cleared by the next sign-in step. */
  const [farewell, setFarewell] = useState<string | null>(null);
  // P191: the saved sign-in check stayed blocked after its quiet retries, so Try again retries it.
  const [restoreFailed, setRestoreFailed] = useState(false);
  // Live audit, 8 Nov 2026: why the connecting screen is still waiting, while P191 retries quietly.
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    recovery: boolean;
    busy: boolean;
    message: string | null;
    messageKind?: WardCredentialMessageKind | null;
    /** Fresh audit X-1: the account a recovery link signs in to, shown on "Set a new password". */
    accountEmail?: string | null;
  }>({ open: false, recovery: false, busy: false, message: null });
  // Latest factory, read when the session boots. Updated in an effect (not during render) and
  // declared before the boot effect so it is current when that effect runs; the boot effect keys
  // on `enabled` only, so an inline factory with a new identity each render does not reconnect.
  const createAuthRef = useRef(createAuth);
  useEffect(() => {
    createAuthRef.current = createAuth;
  }, [createAuth]);
  const [previousEnabled, setPreviousEnabled] = useState(enabled);
  if (previousEnabled !== enabled) {
    // Reset before rendering children when the selected provider changes.
    setPreviousEnabled(enabled);
    setView(emptyView);
    setOwnership(null);
    setSignedIn(false);
    setAccountEmail(null);
    setForm({ open: false, recovery: false, busy: false, message: null });
  }
  const connection = useRef<SharedWorkspaceClient | null>(null);
  const publishedEpoch = useRef<number | undefined>(undefined);
  /** The latest published view's `unconfirmedSave`, read after sign-out waits for held actions. */
  const unconfirmedNow = useRef(false);
  const actions = useRef<{
    signUp: (email: string, password: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    recover: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    signOut: (reason?: string, everyTab?: boolean, askOtherTabs?: boolean) => Promise<void>;
    retry: () => Promise<void>;
    reauthenticate: (password: string) => Promise<void>;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    // P191: set once Try again is pressed, so the quiet startup retries stop and cannot restore (and
    // reconnect) a second time over a connection the manual retry has already opened.
    let manualRetryTook = false;
    let polling: ReturnType<typeof startWardPolling> | undefined;
    let lastRead = 0;
    let onVisibilityChange: (() => void) | undefined;
    let auth: WardBrowserAuthAdapter | null = null;
    let connectedActorId: string | null = null;
    let channel: BroadcastChannel | null = null;
    // Audit 24-3 SM-1: a duplicated tab shares this sign-in's server session. Before an idle
    // sign-out ends it, ask whether another tab on this sign-in was used within the idle time.
    let lastUsed = Date.now();
    const used = () => {
      lastUsed = Date.now();
    };
    for (const name of IDLE_ACTIVITY) window.addEventListener(name, used, { passive: true });
    let asked: { id: string; answer: () => void } | null = null;
    const otherTabInUse = () =>
      new Promise<boolean>((resolve) => {
        if (!channel || !auth?.userId) return resolve(false);
        const id = crypto.randomUUID();
        const wait = setTimeout(() => done(false), 250);
        const done = (inUse: boolean) => {
          clearTimeout(wait);
          if (asked?.id === id) asked = null;
          resolve(inUse);
        };
        asked = { id, answer: () => done(true) };
        channel.postMessage({ ask: id, userId: auth.userId, within: CLINICAL_VALUES.idleLock.value * 60_000 });
      });
    const disconnect = (forgetDrafts = true) => {
      forgetDowntimePack();
      // Invalidate outgoing autosaves before React unmounts the old account's drawers.
      if (forgetDrafts) clearReferralDraftSession();
      connectedActorId = null;
      polling?.stop();
      polling = undefined;
      if (onVisibilityChange && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      onVisibilityChange = undefined;
      connection.current?.dispose();
      connection.current = null;
      publishedEpoch.current = undefined;
      unconfirmedNow.current = false;
      if (!closed) {
        setOwnership((owner) => (owner ? { ...owner, view: null, client: null, actorId: null } : null));
        setSignedIn(false);
        setAccountEmail(null);
        setEndsAt(null);
        setFirstRead(false);
        setView({ ...emptyView, status: "ready" });
      }
    };
    const fail = (error: unknown) => {
      if (closed || (error instanceof WardAuthError && error.kind === "cancelled")) return;
      const expired = error instanceof WardAuthError && error.kind === "session";
      if (expired) disconnect();
      const message = error instanceof WardAuthError ? error.message : "Shared sign-in is unavailable. Try again.";
      const messageKind: WardCredentialMessageKind =
        error instanceof WardAuthError && error.kind === "credentials"
          ? "credentials"
          : expired || (error instanceof WardAuthError && error.kind === "session")
            ? "info"
            : "unavailable";
      setForm((old) => ({ ...old, busy: false, message, messageKind }));
      // A rejected email or password is a form answer, not a service outage.
      if (error instanceof WardAuthError && error.kind === "credentials") return;
      setView((old) => ({ ...old, status: expired ? "ready" : "unavailable", error: message }));
    };
    const connect = async () => {
      // The client loads only once someone signs in, so the local demo never carries it.
      const { SharedWorkspaceClient } = await import("./ward-shared-client");
      loadedClient = SharedWorkspaceClient;
      if (closed || !auth?.userId || auth.isRecovery) return;
      const actorId = auth.userId;
      disconnect(connectedActorId !== null && connectedActorId !== actorId);
      setDraftAccount(actorId);
      connectedActorId = actorId;
      setSignedIn(true);
      setFirstRead(true);
      setAccountEmail(auth.accountEmail);
      setForm({ open: false, recovery: false, busy: false, message: null });
      const baseUrl = process.env.NEXT_PUBLIC_WARD_API_BASE_URL!;
      const instance = auth;
      let landed = false;
      let latestEpoch: number | undefined;
      // The last published view had a save in flight or queued, which a forced sign-out drops.
      let waitingBefore = false;
      const client = new SharedWorkspaceClient({
        baseUrl: baseUrl.replace(/\/$/, ""),
        token: (options) => instance.token(options),
        workingAs,
        recoveryStorage: tabStorage,
        authenticatedActorId: () => instance.userId,
        changed: (published) => {
          if (closed || connection.current !== client) return;
          let next = published;
          if (instance.userId !== actorId) {
            disconnect();
            setView({
              ...emptyView,
              status: "unavailable",
              error: "The signed-in account changed. Reconnect to confirm your current role.",
            });
            return;
          }
          if (next.status === "not-authorised") {
            // A refused session or role ends this connection: stop polling, drop the refused
            // local session so it is not left stored, and keep the not-authorised message visible.
            // A session limit sign-out turns this device's phone alerts off too (the server lets
            // that one request through), so a signed-out phone is not sent them.
            const token = instance.captureAccessTokenForSignOut();
            disconnect();
            setActNowAppBadge(0);
            releasePhoneAlerts(baseUrl, token, workingAs.get(), actorId);
            void instance.signOut().catch(() => {});
            // D-125 (audit M8 gap A): forced expiry never waits, so say that what was still waiting
            // on this page, or held in an Undo window, was not saved. No record is named.
            if (waitingBefore || heldActionsWaiting())
              next = { ...next, error: [next.error, UNSENT_CHANGES_DROPPED_NOTICE].filter(Boolean).join(" ") };
          }
          waitingBefore = unconfirmedNow.current = !!next.unconfirmedSave;
          // The state and this ownership receipt must match in the very render that publishes data.
          // An effect that clears the previous account after rendering would be one frame too late.
          setOwnership({ auth: instance, view: next, client, actorId });
          setView(next);
          if (next.receivedAt > lastRead) {
            lastRead = next.receivedAt;
            polling?.refreshed();
          }
          latestEpoch = next.viewEpoch;
          publishedEpoch.current = next.viewEpoch;
          if (!landed && next.status === "ready" && next.snapshot && next.access) {
            landed = true;
            void Promise.all([
              import("./ward-screen-return"),
              import("./shell/ward-access-store"),
              import("./ward-access-places"),
            ])
              .then(([screen, accessStore, places]) => {
                if (
                  closed ||
                  connection.current !== client ||
                  instance.userId !== actorId ||
                  latestEpoch !== next.viewEpoch
                )
                  return;
                const access = accessStore.parseStoredAccess(JSON.stringify(next.access));
                if (!access || !next.snapshot) return;
                // Only a remembered sign-out return moves the page. The page the person actually loaded,
                // including a record address, query or fragment, is never rewritten here.
                const wanted = screen.takeScreenReturn();
                if (!wanted) return;
                const target = screen.authorisedScreenReturn(
                  wanted,
                  access,
                  places.wardPlaceLookup(next.snapshot.payload.state.units),
                );
                if (window.location.pathname !== target || window.location.search || window.location.hash)
                  window.history.replaceState(window.history.state, "", target);
              })
              .catch(() => {});
          }
        },
      });
      // A sign-in cleared from this tab's storage (another tool, or the browser) ends the session
      // here too, instead of the page still looking signed in until a reload. Only a sign-in that
      // was stored when connecting counts, so a browser that blocks storage keeps its in-memory one.
      // Read before the first workspace read, so a removal while that read is pending still counts.
      const storedAtConnect = storedSignIn() === true;
      let toldNotKept = false;
      const sessionEnded = () => {
        if (!storedAtConnect || storedSignIn() !== false) return false;
        // SD-05: the adapter removed the saved copy itself after the browser refused a rotated
        // sign-in. That is not a sign-out elsewhere: keep the session and drafts, and say so once.
        if (instance.storageLost) {
          if (!toldNotKept) setForm((old) => ({ ...old, message: SIGN_IN_NOT_KEPT_MESSAGE, messageKind: "info" }));
          toldNotKept = true;
          return false;
        }
        disconnect();
        // Drop the in-memory sign-in as well, so a token refresh already on its way cannot store
        // it again, and clear this tab's Ward Flow data as a sign-out here would. This tab only:
        // the stored key went from this tab, so no server sign-out reaches another tab.
        void instance.signOut(true).catch(() => {});
        endWardFlowTabSession();
        setForm((old) => ({ ...old, message: SESSION_ENDED_MESSAGE, messageKind: "info" }));
        setView({ ...emptyView, status: "ready", error: SESSION_ENDED_MESSAGE });
        return true;
      };
      connection.current = client;
      try {
        await client.refresh();
      } finally {
        if (!closed && connection.current === client) setFirstRead(false);
      }
      if (closed || connection.current !== client) return;
      if (sessionEnded()) return;
      void instance.token().then(
        (token) => !closed && connection.current === client && setEndsAt(sessionEndsAt(token)),
        () => {},
      );
      void rememberPhonePushOwnership({
        ownerId: actorId,
        pushKey: () => client.pushKey(),
        pushStatus: (endpoint) => client.pushStatus(endpoint),
        pushSubscribe: (subscription) => client.pushSubscribe(subscription),
        pushUnsubscribe: (endpoint) => client.pushUnsubscribe(endpoint),
      });
      onVisibilityChange = () => {
        if (!closed && connection.current === client && document.visibilityState === "visible") {
          if (sessionEnded()) return;
          void client.refresh();
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      polling = startWardPolling({
        visible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
        refresh: async () => {
          if (sessionEnded()) return false;
          const before = lastRead;
          if ((await client.refresh()) === "skipped") return "skipped";
          return lastRead > before;
        },
      });
    };
    const run = async (action: () => Promise<void>) => {
      if (closed || !auth) return;
      setForm((old) => ({ ...old, busy: true, message: null, messageKind: null }));
      setFarewell(null);
      try {
        await action();
      } catch (error) {
        fail(error);
      } finally {
        if (!closed) setForm((old) => ({ ...old, busy: false }));
      }
    };
    const boot = async () => {
      try {
        // Consume and erase the sensitive fragment before any asynchronous work or workspace render.
        const confirmation = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "signup";
        // An expired or malformed link is still erased, but its error is reported only after
        // auth and the sign-in/recovery actions exist, so the user can request a new link.
        let fragmentError: unknown = null;
        let recovery: ReturnType<typeof consumeRecoveryLink> = null;
        try {
          recovery = consumeRecoveryLink(
            window.location,
            (url) => window.history.replaceState(window.history.state, "", url),
            deviceStorage,
          );
        } catch (error) {
          fragmentError = error;
        }
        if (confirmation) tabStorage.removeItem(WARD_AUTH_STORAGE_KEY);
        const base = new URL(process.env.NEXT_PUBLIC_WARD_API_BASE_URL ?? "");
        const loopback =
          process.env.NODE_ENV === "development" &&
          base.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
        if (base.username || base.password || (base.protocol !== "https:" && !loopback))
          throw new Error("Missing shared configuration");
        // #805: a tab holding a saved sign-in connects next, so fetch the shared client and its
        // state checks while the sign-in is verified, not one after another once it is. A visitor
        // with no saved sign-in loads nothing extra.
        let savedSignIn = recovery !== null;
        try {
          savedSignIn ||= !!window.sessionStorage.getItem(WARD_AUTH_STORAGE_KEY);
        } catch {
          // Storage unavailable: the client loads at connect, as before.
        }
        if (savedSignIn) prefetchSharedClient();
        const created = await createAuthRef.current();
        if (closed) {
          created.dispose();
          return;
        }
        auth = created;
        setOwnership({ auth: created, view: null, client: null, actorId: null });
        actions.current = {
          signUp: (email, password) =>
            run(async () => {
              disconnect();
              await auth!.signUp(email, password, window.location.origin + "/ward-flow");
              if (!closed) {
                setForm((old) => ({
                  ...old,
                  message:
                    "Check your email and confirm the account, then sign in. An access admin still needs to give you a role.",
                  messageKind: "info",
                }));
                setView({ ...emptyView, status: "ready" });
              }
            }),
          signIn: (email, password) =>
            run(async () => {
              disconnect();
              prefetchSharedClient();
              await auth!.signIn(email, password);
              // A site behind the front door renews its pass, which an idle sign-out ended.
              void renewFrontDoorPass(() => auth!.token());
              await connect();
            }),
          recover: (email) =>
            run(async () => {
              await auth!.recover(email, window.location.origin + "/ward-flow");
              if (!closed) {
                setForm((old) => ({
                  ...old,
                  message: "If this account is registered, a recovery link will be emailed.",
                  messageKind: "sent",
                }));
                setView((old) => ({ ...old, status: "ready", error: null }));
              }
            }),
          updatePassword: (password) =>
            run(async () => {
              await auth!.updatePassword(password);
              void renewFrontDoorPass(() => auth!.token());
              await connect();
            }),
          reauthenticate: async (password) => {
            await auth!.reauthenticate(password);
          },
          // `reason` is shown on the sign-in screen; a deliberate sign-out (no reason) ends every tab.
          signOut: async (reason, everyTab = reason === undefined, askOtherTabs = false) => {
            const returnPath = window.location.pathname;
            if (askOtherTabs) {
              disconnect();
              // Another tab is in use: only this tab signs out, and the shared session stays.
              if (await otherTabInUse()) {
                let failure: string | null = null;
                try {
                  await auth!.signOut(true);
                } catch (error) {
                  failure =
                    error instanceof WardAuthError
                      ? error.message
                      : "Sign-out cleanup could not be confirmed. Clear this site's browser data before sharing the device.";
                }
                // This tab's saved data goes too, so a reload here reopens nothing (audit 24-3 SM-1).
                endWardFlowTabSession();
                if (!closed) {
                  setView({ ...emptyView, status: "ready", error: reason ?? null });
                  if (failure)
                    setForm({ open: true, recovery: false, busy: false, message: failure, messageKind: "warning" });
                }
                return;
              }
            }
            if (everyTab) channel?.postMessage("signed-out");
            const token = auth!.captureAccessTokenForSignOut();
            const ownerId = auth!.userId;
            // The next person at this device chooses their own role. The cleanup below still
            // speaks as the role worked as, so an account with several roles can turn alerts off.
            const chosen = workingAs.get();
            workingAs.set(null);
            // Stop board reads, queued writes and late responses in the click's own call stack.
            disconnect();
            // Signed in means the client has loaded, so this cleanup still runs in the click. It
            // starts before the storage sweep below, which also removes its ownership receipt.
            releasePhoneAlerts(base.toString(), token, chosen, ownerId);
            // Clear Ward Flow's saved browser data (bed keys, recents, snapshots, filters, drafts)
            // here too, so it goes even when the session had already ended or auth was swapped.
            endWardFlowBrowserSession();
            setForm({ open: false, recovery: false, busy: false, message: null });
            if (reason && !closed) setView({ ...emptyView, status: "ready", error: reason });
            // A deliberate sign-out says so on the sign-in screen, with the shared computer reminder.
            if (!closed) setFarewell(!reason && everyTab ? SIGNED_OUT_NOTICE : null);
            // The next account on a shared phone never sees this one's act-now count, even when
            // the session has expired and the phone alert cleanup could not run.
            setActNowAppBadge(0);
            // Auth clears its local session synchronously; remote logout and phone cleanup are independent.
            // The local session is already cleared, so remote logout is best-effort.
            await auth!.signOut().catch((error: unknown) => {
              if (!closed)
                setForm({
                  open: true,
                  recovery: false,
                  busy: false,
                  message:
                    error instanceof WardAuthError
                      ? error.message
                      : "Sign-out cleanup could not be confirmed. Clear this site's browser data before sharing the device.",
                  messageKind: "warning",
                });
            });
            // TE-05: offline this code may not load; the sign-out itself is already done.
            await import("./ward-screen-return").then(
              ({ rememberScreenReturn }) => rememberScreenReturn(returnPath),
              () => {},
            );
          },
          retry: () =>
            run(async () => {
              manualRetryTook = true;
              // The boot loop returns without clearing its notice once a manual retry takes over.
              setRestoreNotice(null);
              if (connection.current) {
                await connection.current.retry();
                return;
              }
              try {
                await auth!.restore();
              } catch (error) {
                if (!closed && restoreBlocked(error)) setRestoreFailed(true);
                throw error;
              }
              if (!closed) setRestoreFailed(false);
              if (auth!.isRecovery) {
                setForm((old) => ({ ...old, open: true, recovery: true, accountEmail: auth!.accountEmail }));
                setView({ ...emptyView, status: "ready" });
              } else if (auth!.userId) {
                await connect();
              } else {
                setView({ ...emptyView, status: "ready" });
              }
            }),
        };
        try {
          channel = new BroadcastChannel(SESSION_CHANNEL);
          channel.onmessage = ({ data }) => {
            if (data === "signed-out" && auth?.userId)
              void actions.current?.signOut("Signed out in another Ward Flow tab. Sign in again to carry on.", false);
            else if (
              data?.ask &&
              data.userId === auth?.userId &&
              connection.current &&
              Date.now() - lastUsed < data.within
            )
              channel?.postMessage({ inUse: data.ask });
            else if (data?.inUse && asked && data.inUse === asked.id) asked.answer();
          };
        } catch {
          // No broadcast channel in this browser: each tab still signs itself out.
        }
        if (fragmentError) {
          fail(fragmentError);
          return;
        }
        // P191: a blocked check is retried quietly behind the connecting screen before anything shows.
        for (let attempt = 0; ; attempt += 1) {
          try {
            await auth.restore(recovery);
            break;
          } catch (error) {
            if (manualRetryTook) return;
            if (closed || attempt >= RESTORE_RETRY_MS.length || !restoreBlocked(error)) {
              if (!closed) setRestoreNotice(null);
              if (!closed && restoreBlocked(error)) setRestoreFailed(true);
              throw error;
            }
            setRestoreNotice(restoreRetryNotice(error));
            await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_MS[attempt]));
            if (closed || manualRetryTook) return;
          }
        }
        setRestoreNotice(null);
        if (closed || manualRetryTook) return;
        if (auth.isRecovery) {
          setForm((old) => ({ ...old, open: true, recovery: true, accountEmail: auth?.accountEmail ?? null }));
          setView({ ...emptyView, status: "ready" });
        } else if (auth.userId) await connect();
        else {
          clearReferralDraftSession();
          setView({ ...emptyView, status: "ready" });
          if (confirmation)
            setForm((old) => ({
              ...old,
              open: true,
              message: "Email link processed. Sign in to continue.",
              messageKind: "info",
            }));
        }
      } catch (error) {
        fail(error);
      }
    };
    void boot();
    return () => {
      closed = true;
      channel?.close();
      for (const name of IDLE_ACTIVITY) window.removeEventListener(name, used);
      disconnect(false);
      auth?.dispose();
      actions.current = null;
    };
  }, [enabled]);
  const currentAccount = ownership?.auth.userId ?? null;
  const ownsView =
    ownership !== null &&
    ownership.view === view &&
    ownership.client !== null &&
    ownership.actorId === currentAccount &&
    view.actorId === currentAccount;
  const currentView =
    (view.snapshot || view.executiveSnapshot) && (!enabled || !ownsView)
      ? { ...emptyView, status: "loading" as const }
      : view;
  return {
    ...currentView,
    signedIn: signedIn && currentAccount !== null,
    /** P013: the first workspace read after connecting has not settled yet. */
    connecting: signedIn && firstRead,
    accountEmail,
    client: connection,
    signIn: () => setForm((old) => ({ ...old, open: true, message: null, messageKind: null })),
    farewell,
    /** When this sign-in reaches the session limit, in wall-clock milliseconds; `null` when unknown. */
    sessionEndsAt: endsAt,
    /** Sign out. With a `reason`, only this tab, and the sign-in screen says why. */
    signOut: (reason?: unknown) => {
      // A reason means an idle sign-out (the only caller), which first asks the other tabs.
      const why = typeof reason === "string" ? reason : undefined;
      const owner = connection.current;
      const epoch = view.viewEpoch;
      const finish = () => {
        if (connection.current !== owner || publishedEpoch.current !== epoch) return false;
        void actions.current?.signOut(why, undefined, why !== undefined);
        return true;
      };
      const guarded = (pending: boolean) => {
        if (!pending) return void finish();
        void import("./ward-sign-out-guard")
          .then(({ allowWardSignOut }) => allowWardSignOut(true, false))
          .then(
            (allowed) => {
              if (allowed) finish();
            },
            // TE-03: the question could not load (offline). Never leave the person signed in
            // without telling them: sign out, and say what the unconfirmed changes mean.
            () => {
              if (finish()) setFarewell(SIGNED_OUT_UNCONFIRMED_NOTICE);
            },
          );
      };
      if (why !== undefined) return void finish();
      // D-125: actions held in an Undo window are sent first, and sign-out waits for them. A refused
      // or failed one keeps the person signed in; the holding screen says why.
      if (!heldActionsWaiting()) return guarded(!!view.unconfirmedSave);
      void sendHeldActions("sign-out").then((sent) => {
        // Read after the wait: another save may still be waiting, which asks as before.
        if (sent) guarded(unconfirmedNow.current);
      });
    },
    retry: () => actions.current?.retry(),
    restoreNotice,
    /** P172: clear the outcome of an uncertain save once it has been read. */
    dismissRecovery: (shown?: string) => connection.current?.dismissRecovery(shown),
    /** Work as one of this account's roles, when it holds more than one. */
    chooseRole: (id: string) => connection.current?.chooseRole(id),
    /** Forget the role worked as, so the account's roles are listed again. */
    switchRole: () => {
      // D-125: as for sign-out, held Undo-window actions are sent and confirmed before the desk changes.
      const owner = connection.current;
      if (!heldActionsWaiting()) return owner?.switchRole();
      void sendHeldActions("switch-role").then((sent) => {
        if (sent && connection.current === owner) owner?.switchRole();
      });
    },
    /** The step-up sign-in with the account's own password. */
    reauthenticate: async (password: string) => {
      if (!actions.current) throw new WardAuthError("session", "Sign in again to carry on.");
      await actions.current.reauthenticate(password);
    },
    credentials: {
      ...form,
      // H-0038: open sign-up is off in Supabase, so the Create account link stays hidden unless
      // NEXT_PUBLIC_WARD_OPEN_SIGNUP is "true" as well as a coordinator email being set.
      signupAvailable:
        process.env.NEXT_PUBLIC_WARD_OPEN_SIGNUP === "true" && !!process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL?.trim(),
      signUp: async (email: string, password: string) => {
        await actions.current?.signUp(email, password);
      },
      signIn: async (email: string, password: string) => {
        await actions.current?.signIn(email, password);
      },
      retry: restoreFailed ? () => void actions.current?.retry() : undefined,
      recover: async (email: string) => {
        await actions.current?.recover(email);
      },
      updatePassword: async (password: string) => {
        await actions.current?.updatePassword(password);
      },
      cancel: () => {
        if (form.recovery) void actions.current?.signOut(undefined, false);
        else setForm((old) => ({ ...old, open: false, message: null, messageKind: null }));
      },
    } satisfies WardCredentialForm,
  };
}
