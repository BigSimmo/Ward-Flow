"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { SharedChangeResult, SharedView, SharedWorkspaceClient, WardCommandDispatch } from "./ward-shared-client";
import { PhonePushAccessContext, type PhonePushAccess, type PhonePushApi } from "./shell/ward-phone-push";
import { useWardSupabaseShared, type WardCredentialForm } from "./use-ward-supabase-shared";
import { PUSH_ROLES } from "./ward-access-shell-rules";
import { accessIsWholeNetwork, type WardAccess } from "./ward-role-access";
import { parseStoredAccess, readWardAccessSnapshot, sameDesk, setWardAccess } from "./shell/ward-access-store";
import { StepUpReauthContext } from "./shell/ward-step-up-context";
import { SharedAccessContext, type SharedAccessApi } from "./shell/ward-shared-access-context";
import { SharedSessionContext, type SharedSession } from "./shell/ward-shared-session-context";
import { sharedDeskLabel } from "./shell/ward-access-labels";
import styles from "./ward-shared-access.module.css";
import { DowntimePackBoundary } from "./reports/downtime-pack-context";

// The role picker and Ask for access show only in the shared workspace, before the board opens,
// so a first load skips their code.
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
  signOut: () => void;
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
  logRecordView?: (patientId: string, surface: "patient" | "movement") => void;
};

/**
 * Where the header asks the data mode to sit (v10: the Prototype pill beside the service pill).
 * Without a header slot (a test, a page with no shell) the full Data mode bar shows above the app.
 */
const DataModeSlotContext = createContext<((slot: HTMLElement | null) => void) | null>(null);

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
export function WardDataModeSlot({ className }: { className?: string }) {
  const setSlot = useContext(DataModeSlotContext);
  return setSlot ? <span ref={setSlot} className={className} data-wf-data-mode-slot="" /> : null;
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
      grantAccess: async (input): Promise<SharedChangeResult> => connected().grantAccess(input),
      revokeAccess: async (id) => connected().revokeAccess(id),
      giveCover: async (input) => connected().giveCover(input),
      decideRequest: async (id, decision, minutes) => connected().decideRequest(id, decision, minutes),
      ownRequest: async () => connected().ownRequest(),
      requestAccess: async (role, scope) => connected().requestAccess(role, scope),
      breakGlass: async (patientId, reason) => connected().breakGlass(patientId, reason),
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
      <h2>{form.recovery ? "Set a new password" : signup ? "Create coordinator account" : "Coordinator sign-in"}</h2>
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
          {signup ? "Use existing account" : "Create coordinator account"}
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
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const connected = connection.enabled && ["ready", "saving"].includes(connection.status) && !!connection.snapshot;
  // The server's role and place for this account. Checked against the access table, never widened.
  const accessKey = connection.enabled && connection.snapshot ? JSON.stringify(connection.access ?? null) : null;
  const serverAccess = useMemo(() => (accessKey ? parseStoredAccess(accessKey) : null), [accessKey]);
  // The desk follows the server's role, so every screen is scoped to it (a coordinator's preview
  // of another role is left alone until it ends).
  useEffect(() => {
    if (!serverAccess) return;
    const { desk, previewOf, covers } = readWardAccessSnapshot();
    if (!sameDesk(previewOf ?? desk, serverAccess) || covers.length > 0)
      setWardAccess(serverAccess, { fromServer: true });
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
            signOut: () => latest.current.signOut(),
            logRecordView: (patientId, surface) => latest.current.logRecordView?.(patientId, surface),
          }
        : null,
    [sessionOpen],
  );
  const actorId = typeof connection.actorId === "string" ? connection.actorId : null;
  const sharedAccess = useMemo(
    () => (connected && accessApi ? { api: accessApi, actorId } : null),
    [connected, accessApi, actorId],
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
                  {slot ? createPortal(<DataModePill detail={detail} onHospitalRecords={openLiveInfo} />, slot) : null}
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
                    <WardSharedWorkspaceContent connection={connection} access={serverAccess}>
                      {children}
                    </WardSharedWorkspaceContent>
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

/** v10 header pill: "Prototype", opening a small panel that says what the data is. */
function DataModePill({ detail, onHospitalRecords }: { detail: string; onHospitalRecords: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className={styles.pillWrap} data-data-mode="prototype">
      <button
        type="button"
        className={styles.pill}
        aria-expanded={open}
        aria-label={`Data mode: Prototype. ${detail}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <span className={styles.pillRing} aria-hidden="true" />
        Prototype
      </button>
      {open && (
        <section className={styles.pop} aria-label="Ward Flow data mode">
          <strong>Data mode: Prototype</strong>
          <span className={styles.detail}>{detail}</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onHospitalRecords();
            }}
          >
            Hospital records (unavailable)
          </button>
        </section>
      )}
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
        api={connection.accessApi ?? null}
        onRetry={connection.retry}
        onSignOut={connection.signOut}
      />
    );
  if (!connection.signedIn || !connection.snapshot)
    return (
      <main id="main-content" className={styles.notice} aria-label="Coordinator sign-in">
        <h1>Ward Flow coordinator</h1>
        <p>Shared synthetic workspace. Your coordinator account has access to all Ward Flow workflows.</p>
        {connection.error && <p role="alert">{connection.error}</p>}
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
  const blocked = connection.status !== "ready";
  return (
    <>
      <div role="status" aria-live="polite">
        {connection.status === "saving"
          ? "Saving shared changes…"
          : connection.status === "unavailable"
            ? "Connection unavailable — changes are disabled."
            : `${access && !accessIsWholeNetwork(access) ? sharedDeskLabel(access) : "Coordinator"} · shared synthetic workspace`}
        {connection.error && <span> {connection.error}</span>}
        {connection.canSwitch && connection.switchRole && (
          <button type="button" onClick={connection.switchRole}>
            Switch role
          </button>
        )}
        {connection.status === "unavailable" && (
          <button type="button" onClick={connection.retry}>
            Retry
          </button>
        )}
        <button type="button" onClick={connection.signOut}>
          Sign out
        </button>
      </div>
      <FocusKeepingInert blocked={blocked}>{children}</FocusKeepingInert>
    </>
  );
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
