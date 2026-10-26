"use client";
import { forgetDowntimePack } from "./reports/downtime-pack";
import { useEffect, useRef, useState } from "react";
import { setActNowAppBadge } from "./shell/ward-act-now-notifications";
import { releasePhonePush, rememberPhonePushOwnership } from "./shell/ward-phone-push";
import type { SharedView, SharedWorkspaceClient } from "./ward-shared-client";
import { endWardFlowBrowserSession, endWardFlowTabSession, onWardSessionEnd } from "./ward-browser-data";
import { setDraftAccount } from "./ward-session-drafts";
import { clearReferralDraftSession } from "./referrals/referral-draft-lifecycle";
import { SHARED_REFRESH_MS } from "./ward-operational-defaults";
import { CLINICAL_VALUES } from "./ward-clinical-values";

/** Every Ward Flow tab in this browser hears a deliberate sign-out (Audit 5 PS-08, Audit 4 A4-06). */
const SESSION_CHANNEL = "ward-flow-session";
const IDLE_ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * When this sign-in reaches the session limit: the token's oldest sign-in factor plus the limit,
 * as the server counts it (ISM-0428). `null` when the token carries no start time.
 */
function sessionEndsAt(token: string): number | null {
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const times = (Array.isArray(claims?.amr) ? claims.amr : [])
      .map((entry: { timestamp?: unknown }) => entry?.timestamp)
      .filter((value: unknown): value is number => Number.isFinite(value));
    return times.length ? Math.min(...times) * 1000 + CLINICAL_VALUES.sessionLimit.value * 3_600_000 : null;
  } catch {
    return null;
  }
}

/** Set once the shared client has loaded on the first sign-in. */
let loadedClient: typeof SharedWorkspaceClient | null = null;
import { WardAuthError, consumeRecoveryFragment, WARD_AUTH_STORAGE_KEY } from "./ward-auth-link";
import type { WardBrowserAuthAdapter } from "./ward-supabase-auth";

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
export type WardCredentialForm = {
  open: boolean;
  recovery: boolean;
  /** Fresh audit X-1: the account a recovery link is for, so a link from someone else is noticed. */
  accountEmail?: string | null;
  signupAvailable: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  busy: boolean;
  message: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  recover: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  cancel: () => void;
};
const emptyView: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null };
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
// The Supabase adapter loads only when shared mode boots, so the demo's first load does not carry it.
const defaultCreateAuth = async (): Promise<WardBrowserAuthAdapter> =>
  new (await import("./ward-supabase-auth")).SupabaseWardAuth({
    url: process.env.NEXT_PUBLIC_WARD_SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY ?? "",
    storage: window.sessionStorage,
    coordinatorEmail: process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL,
    // Sign-out, expiry and a refused session all clear Ward Flow's browser storage.
    onSessionEnded: endWardFlowBrowserSession,
  });
export function useWardSupabaseShared(
  enabled: boolean,
  createAuth: () => WardBrowserAuthAdapter | Promise<WardBrowserAuthAdapter> = defaultCreateAuth,
) {
  const [view, setView] = useState<SharedView>(emptyView);
  const [signedIn, setSignedIn] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    recovery: boolean;
    busy: boolean;
    message: string | null;
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
    setSignedIn(false);
    setForm({ open: false, recovery: false, busy: false, message: null });
  }
  const connection = useRef<SharedWorkspaceClient | null>(null);
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
    let timer: ReturnType<typeof setInterval> | undefined;
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
      if (timer) clearInterval(timer);
      timer = undefined;
      if (onVisibilityChange && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      onVisibilityChange = undefined;
      connection.current?.dispose();
      connection.current = null;
      if (!closed) {
        setSignedIn(false);
        setEndsAt(null);
        setView({ ...emptyView, status: "ready" });
      }
    };
    const fail = (error: unknown) => {
      if (closed || (error instanceof WardAuthError && error.kind === "cancelled")) return;
      const expired = error instanceof WardAuthError && error.kind === "session";
      if (expired) disconnect();
      const message = error instanceof WardAuthError ? error.message : "Shared sign-in is unavailable. Try again.";
      setForm((old) => ({ ...old, busy: false, message }));
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
      setForm({ open: false, recovery: false, busy: false, message: null });
      const baseUrl = process.env.NEXT_PUBLIC_WARD_API_BASE_URL!;
      const instance = auth;
      const client = new SharedWorkspaceClient({
        baseUrl: baseUrl.replace(/\/$/, ""),
        token: (options) => instance.token(options),
        workingAs,
        recoveryStorage: {
          getItem: (key) => window.sessionStorage.getItem(key),
          setItem: (key, value) => window.sessionStorage.setItem(key, value),
          removeItem: (key) => window.sessionStorage.removeItem(key),
        },
        changed: (next) => {
          if (closed) return;
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
          }
          setView(next);
        },
      });
      connection.current = client;
      await client.refresh();
      if (closed || connection.current !== client) return;
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
          void client.refresh();
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      timer = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        void client.refresh();
      }, SHARED_REFRESH_MS);
    };
    const run = async (action: () => Promise<void>) => {
      if (closed || !auth) return;
      setForm((old) => ({ ...old, busy: true, message: null }));
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
        let recovery: ReturnType<typeof consumeRecoveryFragment> = null;
        try {
          recovery = consumeRecoveryFragment(window.location, (url) =>
            window.history.replaceState(window.history.state, "", url),
          );
        } catch (error) {
          fragmentError = error;
        }
        if (confirmation) window.sessionStorage.removeItem(WARD_AUTH_STORAGE_KEY);
        const base = new URL(process.env.NEXT_PUBLIC_WARD_API_BASE_URL ?? "");
        const loopback =
          process.env.NODE_ENV === "development" &&
          base.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
        if (base.username || base.password || (base.protocol !== "https:" && !loopback))
          throw new Error("Missing shared configuration");
        const created = await createAuthRef.current();
        if (closed) {
          created.dispose();
          return;
        }
        auth = created;
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
                }));
                setView({ ...emptyView, status: "ready" });
              }
            }),
          signIn: (email, password) =>
            run(async () => {
              disconnect();
              await auth!.signIn(email, password);
              await connect();
            }),
          recover: (email) =>
            run(async () => {
              await auth!.recover(email, window.location.origin + "/ward-flow");
              if (!closed) {
                setForm((old) => ({
                  ...old,
                  message: "If this account is registered, a recovery link will be emailed.",
                }));
                setView((old) => ({ ...old, status: "ready", error: null }));
              }
            }),
          updatePassword: (password) =>
            run(async () => {
              await auth!.updatePassword(password);
              await connect();
            }),
          reauthenticate: async (password) => {
            await auth!.reauthenticate(password);
          },
          // `reason` is shown on the sign-in screen; a deliberate sign-out (no reason) ends every tab.
          signOut: async (reason, everyTab = reason === undefined, askOtherTabs = false) => {
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
                  if (failure) setForm({ open: true, recovery: false, busy: false, message: failure });
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
                });
            });
          },
          retry: () =>
            run(async () => {
              if (connection.current) {
                await connection.current.retry();
                return;
              }
              await auth!.restore();
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
        await auth.restore(recovery);
        if (closed) return;
        if (auth.isRecovery) {
          setForm((old) => ({ ...old, open: true, recovery: true, accountEmail: auth?.accountEmail ?? null }));
          setView({ ...emptyView, status: "ready" });
        } else if (auth.userId) await connect();
        else {
          clearReferralDraftSession();
          setView({ ...emptyView, status: "ready" });
          if (confirmation)
            setForm((old) => ({ ...old, open: true, message: "Email link processed. Sign in to continue." }));
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
  return {
    ...view,
    signedIn,
    client: connection,
    signIn: () => setForm((old) => ({ ...old, open: true, message: null })),
    /** When this sign-in reaches the session limit, in wall-clock milliseconds; `null` when unknown. */
    sessionEndsAt: endsAt,
    /** Sign out. With a `reason`, only this tab, and the sign-in screen says why. */
    signOut: (reason?: unknown) => {
      // A reason means an idle sign-out (the only caller), which first asks the other tabs.
      const why = typeof reason === "string" ? reason : undefined;
      void actions.current?.signOut(why, undefined, why !== undefined);
    },
    retry: () => {
      void actions.current?.retry();
    },
    /** Work as one of this account's roles, when it holds more than one. */
    chooseRole: (id: string) => connection.current?.chooseRole(id),
    /** Forget the role worked as, so the account's roles are listed again. */
    switchRole: () => connection.current?.switchRole(),
    /** The step-up sign-in with the account's own password. */
    reauthenticate: async (password: string) => {
      if (!actions.current) throw new WardAuthError("session", "Sign in again to carry on.");
      await actions.current.reauthenticate(password);
    },
    credentials: {
      ...form,
      signupAvailable: !!process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL?.trim(),
      signUp: async (email: string, password: string) => {
        await actions.current?.signUp(email, password);
      },
      signIn: async (email: string, password: string) => {
        await actions.current?.signIn(email, password);
      },
      recover: async (email: string) => {
        await actions.current?.recover(email);
      },
      updatePassword: async (password: string) => {
        await actions.current?.updatePassword(password);
      },
      cancel: () => {
        if (form.recovery) void actions.current?.signOut(undefined, false);
        else setForm((old) => ({ ...old, open: false, message: null }));
      },
    } satisfies WardCredentialForm,
  };
}
