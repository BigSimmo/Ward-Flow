"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { SharedChangeResult, SharedView, SharedWorkspaceClient, WardCommandDispatch } from "./ward-shared-client";
import { PhonePushAccessContext, type PhonePushAccess, type PhonePushApi } from "./shell/ward-phone-push";
import { useWardSupabaseShared, type WardCredentialForm } from "./use-ward-supabase-shared";
import { PUSH_ROLES } from "./ward-access-shell-rules";
import { accessIsWholeNetwork, type WardAccess } from "./ward-role-access";
import {
  markSignInLanding,
  parseStoredAccess,
  readWardAccessSnapshot,
  sameDesk,
  setWardAccess,
} from "./shell/ward-access-store";
import { StepUpReauthContext } from "./shell/ward-step-up-context";
import { SharedAccessContext, type SharedAccessApi } from "./shell/ward-shared-access-context";
import { SharedSessionContext, type RecordViewSurface, type SharedSession } from "./shell/ward-shared-session-context";
import { sharedDeskLabel } from "./shell/ward-access-labels";
import styles from "./ward-shared-access.module.css";
import { CLINICAL_VALUES } from "./ward-clinical-values";
import { DowntimePackBoundary } from "./reports/downtime-pack-context";
import { SHARED_REFRESH_MS } from "./ward-operational-defaults";
import { publishLiveRefresh } from "@/components/wf";
import { subscribeDemoMenu } from "./tools/ward-demo-menu-open";
import { announceToWardShell } from "./shell/ward-live-region";
import { WardSharedSaveContext, type WardSharedSave } from "./shell/ward-shared-save-context";
import { WardSharedSaveStatus } from "./ward-shared-save-status";
import { WardPartialViewProvider } from "./ward-partial-view";
import { isTvPath } from "./bed-meeting/tv-lock-guard";
import type { SenderReadSource } from "./ward-sender-read-collection";

const UNAVAILABLE_ACCESS_MESSAGE =
  "Shared access is unavailable. Reconnect and finish checking any uncertain save first.";
/** Explicit shared-unavailable source: never let an outage select the local demonstration store. */
const unavailableAccessApi: SharedAccessApi = {
  listAccess: async () => {
    throw new Error(UNAVAILABLE_ACCESS_MESSAGE);
  },
  listCovers: async () => {
    throw new Error(UNAVAILABLE_ACCESS_MESSAGE);
  },
  listRecordViews: async () => {
    throw new Error(UNAVAILABLE_ACCESS_MESSAGE);
  },
  grantAccess: async () => UNAVAILABLE_ACCESS_MESSAGE,
  revokeAccess: async () => UNAVAILABLE_ACCESS_MESSAGE,
  giveCover: async () => UNAVAILABLE_ACCESS_MESSAGE,
  decideRequest: async () => UNAVAILABLE_ACCESS_MESSAGE,
  breakGlass: async () => UNAVAILABLE_ACCESS_MESSAGE,
};

// The role picker and Ask for access show only in the shared workspace, before the board opens,
// so a first load skips their code.
// The Demo menu (change 8) loads only when the Synthetic pill opens it.
const WardRolePicker = dynamic(() => import("./ward-shared-role-gate").then((m) => m.WardRolePicker), {
  ssr: false,
  loading: () => null,
});
const WardAskForAccess = dynamic(() => import("./ward-shared-role-gate").then((m) => m.WardAskForAccess), {
  ssr: false,
  loading: () => null,
});

/** The shared workspace's access calls, through the signed-in connection. Reject when not connected. */
export type WardSharedAccessApi = SharedAccessApi & Pick<SharedWorkspaceClient, "ownRequest" | "requestAccess">;

export type WardSharedConnection = SharedView & {
  /** Reports may freeze a new snapshot only after this exact server state has been adopted. */
  reportSnapshotReady?: boolean;
  credentials?: WardCredentialForm;
  enabled: boolean;
  signedIn: boolean;
  signIn: () => void;
  /** Sign out. With a `reason`, only this tab, and the sign-in screen says why. */
  signOut: (reason?: unknown) => void;
  /** When this sign-in reaches the session limit, in wall-clock milliseconds. */
  sessionEndsAt?: number | null;
  retry: () => void;
  dispatch: WardCommandDispatch;
  /** Phone alerts (feature 4) through the signed-in connection. Rejects when not connected. */
  pushApi: PhonePushApi;
  /** Roles, cover and requests for access through the signed-in connection. */
  accessApi?: WardSharedAccessApi;
  /** Work as one of this account's roles, or list them again. */
  chooseRole?: (workingAs: string) => void;
  switchRole?: () => void;
  /** The step-up sign-in with the account's own password. */
  reauthenticate?: (password: string) => Promise<void>;
  /** Tells the server this desk opened a patient's record. Best effort; nothing when not connected. */
  logRecordView?: (patientId: string, surface: RecordViewSurface) => void;
};

/**
 * Where the header asks the data mode to sit (v10: the Prototype pill beside the service pill).
 * Without a header slot (a test, a page with no shell) the full Data mode bar shows above the app.
 */
const DataModeSlotContext = createContext<((slot: DataModeSlot | null) => void) | null>(null);

/** The Demo menu the pill opens (change 8, D-77). The header passes in its loader, as the menu's demo
 * panel reaches back to the provider this file sits under, so importing it here would be a cycle. The
 * pill keeps the loaded menu in state rather than a lazy component, so opening it never waits on a
 * Suspense reveal timer (a paused test clock would hold that forever). */
export type WardDemoMenuComponent = ComponentType<{ onClose: (refocus?: boolean) => void }>;
export type WardDemoMenuLoader = () => Promise<WardDemoMenuComponent>;
type DataModeSlot = { element: HTMLElement; menu?: WardDemoMenuLoader };

/** What the data mode says, for the phone menu (the phone's lean bar has no room for the pill). */
export type WardDataMode = {
  detail: string;
  openHospitalRecords: () => void;
  /** On the shared board: referral files are not sent, only their name, type and size (audit F-01). */
  shared: boolean;
};
const DataModeContext = createContext<WardDataMode | null>(null);

/** The current data mode, or null outside `WardSharedAccess`. */
export function useWardDataMode(): WardDataMode | null {
  return useContext(DataModeContext);
}

/** The header's place for the Prototype pill. Renders nothing outside `WardSharedAccess`. */
export function WardDataModeSlot({ className, menu }: { className?: string; menu?: WardDemoMenuLoader }) {
  const setSlot = useContext(DataModeSlotContext);
  const place = useCallback(
    (element: HTMLElement | null) => setSlot?.(element ? { element, menu } : null),
    [setSlot, menu],
  );
  return setSlot ? <span ref={place} className={className} data-wf-data-mode-slot="" /> : null;
}

/**
 * The browser sign-in provider. Supabase is the current and only shipped provider (decision D-55);
 * blank selects it. Any other name is refused rather than silently falling back. This mirrors
 * `resolveWardAuthProvider` in src/lib/security-headers.ts (the CSP side); Ward Flow may not import
 * outside its folders, so tests/security-headers.test.ts keeps the two in step.
 * See docs/ward-flow/DATABASE.md before adding a provider.
 */
export function selectWardAuthProvider(): string {
  return process.env.NEXT_PUBLIC_WARD_AUTH_PROVIDER?.trim() || "supabase";
}

export function useWardShared(enabled: boolean): WardSharedConnection {
  const supabaseMode = selectWardAuthProvider() === "supabase";
  const supabase = useWardSupabaseShared(enabled && supabaseMode);
  // An account without a role still needs its own access-request API. Include the account in
  // the binding even when React batches a replacement without an intervening signed-out render.
  const accountBinding = supabase.signedIn ? (supabase.actorId ?? "signed-in-without-role") : null;
  const pushApi = useMemo<PhonePushApi>(() => {
    const client = accountBinding ? supabase.client.current : null;
    const connected = () => {
      if (!client || supabase.client.current !== client) throw new Error("Shared workspace not connected");
      return client;
    };
    return {
      ownerId: supabase.actorId ?? undefined,
      pushKey: async () => connected().pushKey(),
      pushStatus: async (endpoint) => connected().pushStatus(endpoint),
      pushSubscribe: async (subscription) => connected().pushSubscribe(subscription),
      pushUnsubscribe: async (endpoint) => connected().pushUnsubscribe(endpoint),
    };
  }, [supabase.client, supabase.actorId, accountBinding]);
  const accessApi = useMemo<WardSharedAccessApi>(() => {
    const client = accountBinding ? supabase.client.current : null;
    const connected = () => {
      if (!client || supabase.client.current !== client) throw new Error("Shared workspace not connected");
      return client;
    };
    return {
      listAccess: async () => connected().listAccess(),
      listCovers: async () => connected().listCovers(),
      listRecordViews: async () => connected().listRecordViews(),
      grantAccess: async (input): Promise<SharedChangeResult> => connected().grantAccess(input),
      revokeAccess: async (id) => connected().revokeAccess(id),
      giveCover: async (input) => connected().giveCover(input),
      decideRequest: async (id, decision, minutes) => connected().decideRequest(id, decision, minutes),
      ownRequest: async () => connected().ownRequest(),
      requestAccess: async (role, scope) => connected().requestAccess(role, scope),
      breakGlass: async (patientId, reason) => connected().breakGlass(patientId, reason),
      readRecordAccess: async () => connected().readRecordAccess(),
    };
  }, [supabase.client, accountBinding]);
  if (!supabaseMode)
    return {
      ...supabase,
      credentials: undefined,
      enabled,
      pushApi,
      dispatch: () =>
        Promise.resolve({
          commandId: "",
          status: "cancelled",
          message: "Shared sign-in configuration is unavailable.",
        }),
      snapshot: null,
      eventLog: [],
      signedIn: false,
      status: "unavailable",
      error: "Shared sign-in configuration is unavailable.",
    };
  return {
    ...supabase,
    enabled,
    pushApi,
    accessApi,
    logRecordView: (patientId, surface) => {
      void supabase.client.current?.logRecordView(patientId, surface);
    },
    dispatch: (event) =>
      supabase.client.current?.dispatchConfirmed(event) ??
      Promise.resolve({
        commandId: "",
        status: "cancelled",
        message: "Sign in and review the board before trying again.",
      }),
    signOut: supabase.signOut,
  };
}

/**
 * Readiness review item 12: a new or recovered password is a passphrase of at least this length,
 * following the Australian Government ISM's passphrase guidance for single-factor sign-in (check
 * the current ISM before changing it). The sign-in service's own minimum is set to match in its
 * settings (docs/ward-flow/RETENTION-AND-BACKUP.md, steps for Josh).
 */
const NEW_PASSWORD_MIN_LENGTH = 15;

/** Observe only the supplied session deadline. The external snapshot is a stable boolean;
 * no report data is retained and the component does not read the wall clock during render. */
function useDisplaySessionLifetime(until: number | null | undefined): boolean {
  const current = useCallback(() => until == null || (Number.isFinite(until) && Date.now() < until), [until]);
  const subscribe = useCallback(
    (changed: () => void) => {
      if (until == null || !Number.isFinite(until)) return () => {};
      let timer: ReturnType<typeof setTimeout>;
      const check = () => {
        const remaining = until - Date.now();
        if (remaining <= 0) changed();
        else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
      };
      check();
      return () => clearTimeout(timer);
    },
    [until],
  );
  const server = useCallback(() => until == null, [until]);
  return useSyncExternalStore(subscribe, current, server);
}

function WardCredentialFields({ form }: { form: WardCredentialForm }) {
  const [signup, setSignup] = useState(false);
  const signInAutofillHint = "current-password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className={styles.credentials}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if ((form.recovery || signup) && password !== confirm) {
          setError("The passwords do not match.");
          return;
        }
        const entered = password;
        setPassword("");
        setConfirm("");
        void (form.recovery
          ? form.updatePassword(entered)
          : signup
            ? form.signUp(email.trim(), entered)
            : form.signIn(email.trim(), entered));
      }}
    >
      <h2>{form.recovery ? "Set a new password" : signup ? "Create a Ward Flow account" : "Sign in to Ward Flow"}</h2>
      {!form.recovery && (
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={form.busy}
          />
        </label>
      )}
      <label>
        {form.recovery ? "New password" : "Password"}
        <input
          type="password"
          autoComplete={form.recovery || signup ? "new-password" : signInAutofillHint}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={form.recovery || signup ? NEW_PASSWORD_MIN_LENGTH : undefined}
          aria-describedby={form.recovery || signup ? "ward-new-password-hint" : undefined}
          disabled={form.busy}
        />
      </label>
      {(form.recovery || signup) && (
        <p id="ward-new-password-hint">
          At least {NEW_PASSWORD_MIN_LENGTH} characters. A short phrase of unrelated words is easiest to remember. Use a
          password of your own; never share one between accounts.
        </p>
      )}
      {(form.recovery || signup) && (
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            disabled={form.busy}
          />
        </label>
      )}
      {(error || form.message) && <p role="status">{error ?? form.message}</p>}
      <button type="submit" disabled={form.busy}>
        {form.busy ? "Please wait…" : form.recovery ? "Update password" : signup ? "Create account" : "Sign in"}
      </button>
      {!form.recovery && !signup && (
        <button
          type="button"
          disabled={form.busy}
          onClick={() => {
            setPassword("");
            if (!email.trim()) {
              setError("Enter your email address first.");
              return;
            }
            setError(null);
            void form.recover(email.trim());
          }}
        >
          Forgot password
        </button>
      )}
      {!form.recovery && form.signupAvailable && (
        <button
          type="button"
          disabled={form.busy}
          onClick={() => {
            setSignup((value) => !value);
            setPassword("");
            setConfirm("");
            setError(null);
          }}
        >
          {signup ? "Use an existing account" : "Create a Ward Flow account"}
        </button>
      )}
      <button type="button" disabled={form.busy} onClick={form.cancel}>
        Cancel
      </button>
    </form>
  );
}

export function WardSharedAccess({ connection, children }: { connection: WardSharedConnection; children: ReactNode }) {
  const [showLiveInfo, setShowLiveInfo] = useState(false);
  const [slot, setSlot] = useState<DataModeSlot | null>(null);
  const displaySessionCurrent = useDisplaySessionLifetime(connection.sessionEndsAt);
  const connected = connection.enabled && ["ready", "saving"].includes(connection.status) && !!connection.snapshot;
  // Audit 1 (CS-13, Josh 20 Oct): Live chips read Stale while the shared board cannot refresh or
  // its last good refresh is more than two refreshes old. The one publisher; nothing in local mode.
  const refreshUnavailable = connection.enabled && connection.status === "unavailable";
  const receivedAt = connection.enabled && connection.receivedAt > 0 ? connection.receivedAt : undefined;
  useEffect(() => {
    publishLiveRefresh(
      connection.enabled
        ? { unavailable: refreshUnavailable, receivedAt, staleAfterMs: 2 * SHARED_REFRESH_MS }
        : undefined,
    );
  }, [connection.enabled, refreshUnavailable, receivedAt]);
  useEffect(() => () => publishLiveRefresh(undefined), []);
  // The server's role and place for this account. Checked against the access table, never widened.
  const accessKey = connection.enabled && connection.snapshot ? JSON.stringify(connection.access ?? null) : null;
  const serverAccess = useMemo(() => (accessKey ? parseStoredAccess(accessKey) : null), [accessKey]);
  // The desk follows the server's role, so every screen is scoped to it (a coordinator's preview
  // of another role is left alone until it ends).
  useEffect(() => {
    if (!serverAccess) return;
    const { desk, previewOf, covers } = readWardAccessSnapshot();
    if (!sameDesk(previewOf ?? desk, serverAccess) || covers.length > 0) {
      setWardAccess(serverAccess, { fromServer: true });
      // #804, #797: a page closed to this desk opens its home, not "Not part of your role".
      if (!sameDesk(previewOf ?? desk, serverAccess)) markSignInLanding(window.location.pathname);
    }
  }, [serverAccess]);
  const hearsAlerts = !serverAccess || PUSH_ROLES.includes(serverAccess.role);
  const pushKind = !connection.enabled
    ? "local"
    : connection.signedIn && connection.snapshot && connection.status !== "not-authorised"
      ? hearsAlerts
        ? "connected"
        : "role"
      : "signed-out";
  const { pushApi } = connection;
  const pushAccess = useMemo<PhonePushAccess>(
    () => (pushKind === "connected" ? { kind: "connected", api: pushApi } : { kind: pushKind }),
    [pushKind, pushApi],
  );
  const { accessApi, reauthenticate } = connection;
  // The connection's functions are new on every render; the session reads the latest through a
  // ref, so the idle lock and the record log do not restart on every poll.
  const latest = useRef(connection);
  useEffect(() => {
    latest.current = connection;
  });
  const sessionOpen = connection.enabled && connection.signedIn;
  const session = useMemo<SharedSession | null>(
    () =>
      sessionOpen
        ? {
            signOut: (reason) => latest.current.signOut(reason),
            logRecordView: (patientId, surface) => latest.current.logRecordView?.(patientId, surface),
          }
        : null,
    [sessionOpen],
  );
  const actorId = typeof connection.actorId === "string" ? connection.actorId : null;
  const sharedAccess = useMemo(
    () =>
      connection.enabled
        ? { api: connected && !connection.recovering && accessApi ? accessApi : unavailableAccessApi, actorId }
        : null,
    [connection.enabled, connection.recovering, connected, accessApi, actorId],
  );
  // Once the header holds the Prototype pill there is no bar above the app, so it takes 0px.
  useEffect(() => {
    document.documentElement.style.setProperty("--wf-data-bar-height", "0px");
    return () => {
      document.documentElement.style.removeProperty("--wf-data-bar-height");
    };
  }, []);
  const detail = `Invented records · ${
    connection.enabled
      ? connected
        ? "Shared database connected"
        : "Shared database not connected"
      : "Local demonstration"
  }`;
  const openLiveInfo = useCallback(() => {
    setShowLiveInfo(true);
  }, []);
  const shared = connection.enabled;
  const dataMode = useMemo<WardDataMode>(
    () => ({ detail, openHospitalRecords: openLiveInfo, shared }),
    [detail, openLiveInfo, shared],
  );
  const packAccessContext =
    typeof connection.snapshot?.accessContext === "string" && /^[a-f0-9]{64}$/u.test(connection.snapshot.accessContext)
      ? connection.snapshot.accessContext
      : null;
  // Account/client ownership is established by the existing connection, not by an opaque hash.
  // Only its exact already-adopted world may supply this display. Unknown session expiry adds
  // no invented lifetime; when supplied, it is enforced without waiting for another poll.
  const displayReady =
    connection.enabled &&
    connection.signedIn &&
    connection.status === "ready" &&
    connection.reportSnapshotReady === true &&
    actorId !== null &&
    actorId.length > 0 &&
    serverAccess !== null &&
    connection.snapshot !== null &&
    packAccessContext !== null &&
    displaySessionCurrent;
  const displayReadSource = useMemo<SenderReadSource | null>(() => {
    if (!displayReady || !serverAccess || !connection.snapshot) return null;
    return { access: serverAccess, snapshot: connection.snapshot };
  }, [displayReady, serverAccess, connection.snapshot]);
  const packIdentity = JSON.stringify([
    connection.enabled,
    connection.signedIn,
    actorId,
    connection.workingAs ?? null,
    accessKey,
    connection.snapshot?.payload.startedAt ?? null,
    packAccessContext,
  ]);
  const packUnavailable =
    connection.enabled && connection.signedIn && connection.snapshot && packAccessContext === null
      ? "Your current access must be confirmed before a downtime snapshot can be taken. Reconnect and try again."
      : null;
  const unconfirmedSave =
    connection.status === "saving" || ("unconfirmedSave" in connection && connection.unconfirmedSave === true);
  // Stable, so recovery consumers do not re-render on every poll; it still calls the latest retry.
  const retryLatest = useCallback(() => latest.current.retry(), []);
  const saveRecovery = useMemo<WardSharedSave | null>(
    () =>
      connection.enabled && connection.signedIn
        ? { unconfirmedSave, status: connection.status, error: connection.error, retry: retryLatest }
        : null,
    [connection.enabled, connection.signedIn, connection.status, connection.error, retryLatest, unconfirmedSave],
  );
  return (
    <DowntimePackBoundary
      identity={packIdentity}
      ready={connection.reportSnapshotReady !== false}
      unavailable={packUnavailable}
    >
      <PhonePushAccessContext.Provider value={pushAccess}>
        <StepUpReauthContext.Provider value={connected && reauthenticate ? reauthenticate : null}>
          <SharedSessionContext.Provider value={session}>
            <SharedAccessContext.Provider value={sharedAccess}>
              <DataModeSlotContext.Provider value={setSlot}>
                <DataModeContext.Provider value={dataMode}>
                  {/* The Prototype pill lives only in the header slot; the standalone data-mode bar was removed. */}
                  {slot ? createPortal(<DataModePill detail={detail} loadMenu={slot.menu} />, slot.element) : null}
                  {showLiveInfo && (
                    <section className={styles.notice} aria-label="Hospital records unavailable">
                      <h1>Hospital records are not connected</h1>
                      <p>
                        Hospital-record mode uses real clinical systems in a separately approved workspace. Prototype
                        mode uses invented records, including when it connects to a shared database.
                      </p>
                      <p>
                        Hospital approval, a separate clinical database and the data connection must be configured
                        before that mode can open. Selecting this option does not connect or relabel any data.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLiveInfo(false);
                        }}
                      >
                        Return to prototype
                      </button>
                    </section>
                  )}
                  <div hidden={showLiveInfo} inert={showLiveInfo}>
                    <WardSharedSaveContext.Provider value={saveRecovery}>
                      <WardPartialViewProvider
                        shared={shared}
                        response={displayReady ? connection.snapshot?.partialView : null}
                        currentRevision={displayReady ? (connection.snapshot?.revision ?? null) : null}
                        currentAccessContext={displayReady ? packAccessContext : null}
                        currentNow={displayReady ? (connection.snapshot?.now ?? null) : null}
                        previewAllowed={displayReady && serverAccess?.role === "coordinator"}
                        senderRequired={serverAccess?.role === "ward" || serverAccess?.role === "bed_manager"}
                        readSource={displayReadSource}
                      >
                        <WardSharedWorkspaceContent connection={connection} access={serverAccess}>
                          {children}
                        </WardSharedWorkspaceContent>
                      </WardPartialViewProvider>
                    </WardSharedSaveContext.Provider>
                  </div>
                </DataModeContext.Provider>
              </DataModeSlotContext.Provider>
            </SharedAccessContext.Provider>
          </SharedSessionContext.Provider>
        </StepUpReauthContext.Provider>
      </PhonePushAccessContext.Provider>
    </DowntimePackBoundary>
  );
}

/**
 * v10 header pill: "Synthetic prototype" (Audit 1 SS-4). Change 8 (D-77, 21 Oct 2026): it opens the
 * Demo menu, the scenario, clock and reset controls that left Tools. The pill's label still says
 * what the data is. The Board time pill opens the same menu (`requestDemoMenu`).
 */
function DataModePill({ detail, loadMenu }: { detail: string; loadMenu?: WardDemoMenuLoader }) {
  const [open, setOpen] = useState(false);
  const [Menu, setMenu] = useState<WardDemoMenuComponent | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const show = useCallback(
    (from?: HTMLElement) => {
      returnFocus.current = from ?? button.current;
      setOpen(true);
      // H-0309: a menu that fails to load closes again and says so, rather than sitting "expanded".
      void loadMenu?.()
        .then((menu) => setMenu(() => menu))
        .catch(() => {
          setOpen(false);
          announceToWardShell("The demo menu could not load.");
        });
    },
    [loadMenu],
  );
  // The menu closes itself on Escape (refocusing the opener) and on a press outside (not refocusing).
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) returnFocus.current?.focus();
  }, []);
  useEffect(() => subscribeDemoMenu(show), [show]);
  return (
    <div className={styles.pillWrap} data-data-mode="prototype">
      <button
        type="button"
        className={styles.pill}
        ref={button}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Data mode: Synthetic prototype. ${detail}. Opens the demo menu`}
        onClick={() => {
          if (open) close();
          else show();
        }}
      >
        <span className={styles.pillRing} aria-hidden="true" />
        <span>
          Synthetic
          <span className={styles.pillTail}> prototype</span>
        </span>
      </button>
      {open && Menu ? <Menu onClose={close} /> : null}
    </div>
  );
}

function WardSharedWorkspaceContent({
  connection,
  access,
  children,
}: {
  connection: WardSharedConnection;
  access: WardAccess | null;
  children: ReactNode;
}) {
  "use no memo";
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  // TV-13 (H-0787): a wall TV whose session ends says so at TV size, not as a small sign-in page.
  const onTv = isTvPath(usePathname() ?? "");
  useEffect(() => {
    if (!Number.isFinite(connection.accessUntil) || connection.accessUntil! <= checkedAt) return;
    // A checkpoint updates checkedAt and re-arms this effect while the deadline is still ahead.
    const timer = setTimeout(
      () => setCheckedAt(Date.now()),
      Math.min(2_147_483_647, Math.max(0, connection.accessUntil! - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [connection.accessUntil, checkedAt]);
  if (!connection.enabled) return children;
  if (connection.signedIn && connection.status === "choose-role")
    return (
      <WardRolePicker
        choices={connection.choices ?? []}
        onChoose={(id) => connection.chooseRole?.(id)}
        onSignOut={connection.signOut}
      />
    );
  if (connection.signedIn && connection.status === "no-role")
    return (
      <WardAskForAccess
        canRequest={connection.canRequest === true}
        reason={connection.noRoleReason}
        api={connection.accessApi ?? null}
        onRetry={connection.retry}
        onSignOut={connection.signOut}
      />
    );
  // Audit 24-5 RA-09: the server named a role this build cannot parse. The tab must not carry on
  // with the desk it held before, so it falls back to the no-role screen. A server that names no
  // access at all (`connection.access` absent) is the older shared workspace and still opens.
  if (connection.signedIn && connection.snapshot && connection.access != null && access === null)
    return (
      <WardAskForAccess
        canRequest={connection.canRequest === true}
        api={connection.accessApi ?? null}
        onRetry={connection.retry}
        onSignOut={connection.signOut}
      />
    );
  // Audit 24-5 RA-09: the server named a role this build cannot parse. The tab must not carry on
  // with the desk it held before, so it falls back to the no-role screen. A server that names no
  // access at all (`connection.access` absent) is the older shared workspace and still opens.
  if (connection.signedIn && connection.snapshot && connection.access != null && access === null)
    return (
      <WardAskForAccess
        canRequest={connection.canRequest === true}
        api={connection.accessApi ?? null}
        onRetry={connection.retry}
        onSignOut={connection.signOut}
      />
    );
  if (!connection.signedIn || !connection.snapshot)
    return (
      <main
        id="main-content"
        className={onTv ? `${styles.notice} ${styles.tvSignedOut}` : styles.notice}
        aria-label={onTv ? "TV signed out" : "Ward Flow sign-in"}
        aria-busy={connection.signedIn && connection.status === "loading"}
        data-testid={onTv ? "ward-tv-signed-out" : undefined}
      >
        {onTv ? (
          <>
            <h1>This TV is signed out</h1>
            <p>The bed meeting view is not showing. Sign in again to bring it back.</p>
          </>
        ) : (
          <>
            <h1>Ward Flow sign-in</h1>
            <p>Shared synthetic workspace. You see the screens your role needs.</p>
          </>
        )}
        {connection.error && <p role="alert">{connection.error}</p>}
        {connection.signedIn && connection.status === "loading" && !connection.error && (
          <p role="status" data-testid="ward-shared-connecting">
            Signed in. Connecting to the shared workspace. This can take up to 15 seconds.
          </p>
        )}
        {connection.credentials?.open ? (
          <WardCredentialFields form={connection.credentials} />
        ) : connection.signedIn && connection.status !== "not-authorised" ? (
          <button type="button" onClick={connection.retry}>
            Reconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={
              connection.status === "loading" || (!connection.credentials && connection.status === "unavailable")
            }
            onClick={connection.signIn}
          >
            Sign in with email
          </button>
        )}
        {connection.credentials && connection.status === "unavailable" && !connection.credentials.open && (
          <button type="button" onClick={connection.retry}>
            Retry sign-in service
          </button>
        )}
        {connection.signedIn && (
          <button type="button" onClick={connection.signOut}>
            Sign out
          </button>
        )}
      </main>
    );
  const outage =
    connection.status === "unavailable" &&
    Number.isFinite(connection.accessUntil) &&
    connection.accessUntil! > checkedAt;
  const blocked = connection.status !== "ready" && !outage;
  return (
    <>
      <WardSessionEndingNotice endsAt={connection.sessionEndsAt ?? null} />
      <WardSharedSaveStatus
        connection={connection}
        deskLabel={access && !accessIsWholeNetwork(access) ? sharedDeskLabel(access) : "Coordinator"}
      />
      {connection.recovery && <span role="alert"> {connection.recovery}</span>}
      <FocusKeepingInert
        key={JSON.stringify([
          connection.actorId,
          connection.workingAs,
          connection.access,
          connection.snapshot?.accessContext,
        ])}
        blocked={blocked}
      >
        {children}
      </FocusKeepingInert>
    </>
  );
}

/** Audit 4 A4-05 (Josh, 21 Oct 2026): the session limit is announced before it ends (`sessionWarning`). */
const SESSION_WARNING_MS = CLINICAL_VALUES.sessionWarning.value * 60_000;

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

export function WardSessionEndingNotice({ endsAt }: { endsAt: number | null }) {
  // Wall-clock time, not the demonstration clock: the server measures the limit in real time.
  const [now, setNow] = useState(() => Date.now());
  // TV-13 (H-0787): a full screen TV shows only its own element, so the warning goes inside it.
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement,
    () => null,
  );
  useEffect(() => {
    if (endsAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (endsAt === null || now < endsAt - SESSION_WARNING_MS) return null;
  const at = new Date(endsAt).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Perth",
  });
  const notice = (
    <p
      role="alert"
      className={fullscreen ? `${styles.sessionEnding} ${styles.sessionEndingOnTop}` : styles.sessionEnding}
      data-testid="ward-session-ending"
    >
      You will be signed out at {at}, the {CLINICAL_VALUES.sessionLimit.value}-hour sign-in limit. Finish what you are
      typing and save it now.
    </p>
  );
  return fullscreen ? createPortal(notice, fullscreen) : notice;
}

/**
 * Audit F-09: the app is inert while a shared save is out, so a second press cannot race the
 * first. Going inert drops keyboard focus, so the control last focused gets it back once the save
 * ends, unless the person has since moved focus somewhere else.
 */
function FocusKeepingInert({ blocked, children }: { blocked: boolean; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocused.current = event.target;
    };
    element.addEventListener("focusin", remember);
    return () => element.removeEventListener("focusin", remember);
  }, []);
  useEffect(() => {
    if (blocked) return;
    const target = lastFocused.current;
    const active = document.activeElement;
    if (
      target &&
      target.isConnected &&
      container.current?.contains(target) &&
      (active === null || active === document.body)
    )
      target.focus({ preventScroll: true });
  }, [blocked]);
  return (
    <div ref={container} inert={blocked}>
      {children}
    </div>
  );
}
