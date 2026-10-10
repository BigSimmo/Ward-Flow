"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";
import { SharedWorkspaceClient, type SharedView } from "./ward-shared-client";
import {
  PhonePushAccessContext,
  releasePhonePush,
  type PhonePushAccess,
  type PhonePushApi,
} from "./shell/ward-phone-push";
import type { WardFlowEvent } from "./ward-flow-events";
import styles from "./ward-shared-access.module.css";

export type WardSharedConnection = SharedView & {
  enabled: boolean;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  retry: () => void;
  dispatch: (event: WardFlowEvent) => void;
  /** Phone alerts (feature 4) through the signed-in connection. Rejects when not connected. */
  pushApi: PhonePushApi;
};

/** How long sign-out waits for this device's phone alerts to be released. */
const PHONE_RELEASE_WAIT_MS = 2000;

export function useWardShared(enabled: boolean): WardSharedConnection {
  const [view, setView] = useState<SharedView>({ snapshot: null, receivedAt: 0, status: "loading", error: null });
  const [signedIn, setSignedIn] = useState(false);
  const auth = useRef<PublicClientApplication | null>(null);
  const client = useRef<SharedWorkspaceClient | null>(null);
  const account = useRef<AccountInfo | null>(null);
  const scope = process.env.NEXT_PUBLIC_WARD_API_SCOPE ?? "";
  const dispatch = useCallback((event: WardFlowEvent) => {
    client.current?.dispatch(event);
  }, []);
  const pushApi = useMemo<PhonePushApi>(() => {
    const connected = () => {
      if (!client.current) throw new Error("Shared workspace not connected");
      return client.current;
    };
    return {
      pushKey: async () => connected().pushKey(),
      pushStatus: async (endpoint) => connected().pushStatus(endpoint),
      pushSubscribe: async (subscription) => connected().pushSubscribe(subscription),
      pushUnsubscribe: async (endpoint) => connected().pushUnsubscribe(endpoint),
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const boot = async () => {
      try {
        const tenant = process.env.NEXT_PUBLIC_WARD_TENANT_ID;
        const clientId = process.env.NEXT_PUBLIC_WARD_CLIENT_ID;
        const baseUrl = process.env.NEXT_PUBLIC_WARD_API_BASE_URL;
        const redirectUri = `${window.location.origin}/mockups/ward-flow`;
        if (
          !tenant ||
          !clientId ||
          !baseUrl ||
          !scope ||
          !/^[0-9a-f-]{36}$/i.test(tenant) ||
          !/^[0-9a-f-]{36}$/i.test(clientId) ||
          !baseUrl.startsWith("https://") ||
          !scope.endsWith("/WardFlow.Access")
        )
          throw new Error("Missing shared configuration");
        const instance = new PublicClientApplication({
          auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}`, redirectUri },
          cache: { cacheLocation: "sessionStorage" },
        });
        await instance.initialize();
        const result = await instance.handleRedirectPromise();
        if (closed) return;
        auth.current = instance;
        const selected =
          result?.account ??
          instance.getActiveAccount() ??
          (instance.getAllAccounts().length === 1 ? instance.getAllAccounts()[0] : null);
        account.current = selected;
        if (!selected) {
          setView({ snapshot: null, receivedAt: 0, status: "ready", error: null });
          return;
        }
        instance.setActiveAccount(selected);
        setSignedIn(true);
        const connection = new SharedWorkspaceClient({
          baseUrl: baseUrl.replace(/\/$/, ""),
          changed: (next) => {
            if (!closed) setView(next);
          },
          token: async () => (await instance.acquireTokenSilent({ account: selected, scopes: [scope] })).accessToken,
        });
        client.current = connection;
        await connection.refresh();
        if (closed) return;
        timer = setInterval(() => {
          void connection.refresh();
        }, 3000);
      } catch {
        if (!closed)
          setView({
            snapshot: null,
            receivedAt: 0,
            status: "unavailable",
            error: "Microsoft sign-in or shared workspace configuration is unavailable.",
          });
      }
    };
    void boot();
    return () => {
      closed = true;
      if (timer) clearInterval(timer);
      client.current?.dispose();
      client.current = null;
      auth.current = null;
      account.current = null;
    };
  }, [enabled, scope]);

  return {
    ...view,
    enabled,
    signedIn,
    signIn: () => {
      void auth.current?.loginRedirect({ scopes: [scope], prompt: "select_account" });
    },
    signOut: () => {
      // Release this account's phone alerts for this device first, so the next account on a
      // shared device does not receive them. Best effort and bounded: it never blocks sign-out.
      let timer: ReturnType<typeof setTimeout> | undefined;
      void Promise.race([
        releasePhonePush(pushApi),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, PHONE_RELEASE_WAIT_MS);
        }),
      ]).then(() => {
        clearTimeout(timer);
        client.current?.dispose();
        setView({ snapshot: null, receivedAt: 0, status: "loading", error: null });
        setSignedIn(false);
        void auth.current?.logoutRedirect({
          account: account.current,
          postLogoutRedirectUri: `${window.location.origin}/mockups/ward-flow`,
        });
      });
    },
    retry: () => {
      void client.current?.retry();
    },
    dispatch,
    pushApi,
  };
}

export function WardSharedAccess({ connection, children }: { connection: WardSharedConnection; children: ReactNode }) {
  const [showLiveInfo, setShowLiveInfo] = useState(false);
  const connected = connection.enabled && ["ready", "saving"].includes(connection.status) && !!connection.snapshot;
  const pushKind = !connection.enabled
    ? "local"
    : connection.signedIn && connection.snapshot && connection.status !== "not-authorised"
      ? "connected"
      : "signed-out";
  const { pushApi } = connection;
  const pushAccess = useMemo<PhonePushAccess>(
    () => (pushKind === "connected" ? { kind: "connected", api: pushApi } : { kind: pushKind }),
    [pushKind, pushApi],
  );
  const toolbar = useRef<HTMLElement>(null);
  // Pinned side columns and panel heights size themselves against the window, so they need to
  // know how much of it this bar takes (globals.css, --wf-data-bar-height). The bar only changes
  // height when its text changes (a render) or the window width wraps it (a resize), so those two
  // re-measure it; no ResizeObserver, which screens' own overflow tests stub as a single instance.
  const syncBarHeight = useCallback(() => {
    const bar = toolbar.current;
    if (bar) document.documentElement.style.setProperty("--wf-data-bar-height", `${bar.offsetHeight}px`);
  }, []);
  useEffect(syncBarHeight);
  useEffect(() => {
    window.addEventListener("resize", syncBarHeight);
    return () => {
      window.removeEventListener("resize", syncBarHeight);
      document.documentElement.style.removeProperty("--wf-data-bar-height");
    };
  }, [syncBarHeight]);
  return (
    <PhonePushAccessContext.Provider value={pushAccess}>
      <section ref={toolbar} className={styles.toolbar} aria-label="Ward Flow data mode" data-data-mode="prototype">
        <div>
          <strong>Data mode: Prototype</strong>
          <span className={styles.detail}>
            Invented records ·{" "}
            {connection.enabled
              ? connected
                ? "Shared database connected"
                : "Shared database not connected"
              : "Local demonstration"}
          </span>
        </div>
        <div className={styles.controls} role="group" aria-label="Data mode controls">
          <button
            type="button"
            aria-pressed={!showLiveInfo}
            onClick={() => {
              setShowLiveInfo(false);
            }}
          >
            Prototype
          </button>
          <button
            type="button"
            aria-expanded={showLiveInfo}
            onClick={() => {
              setShowLiveInfo(true);
            }}
          >
            Hospital records (unavailable)
          </button>
        </div>
      </section>
      {showLiveInfo && (
        <section className={styles.notice} aria-label="Hospital records unavailable">
          <h1>Hospital records are not connected</h1>
          <p>
            Hospital-record mode uses real clinical systems in a separately approved workspace. Prototype mode uses
            invented records, including when it connects to Azure.
          </p>
          <p>
            Hospital approval, a separate clinical database and the data connection must be configured before that mode
            can open. Selecting this option does not connect or relabel any data.
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
        <WardSharedWorkspaceContent connection={connection}>{children}</WardSharedWorkspaceContent>
      </div>
    </PhonePushAccessContext.Provider>
  );
}

function WardSharedWorkspaceContent({
  connection,
  children,
}: {
  connection: WardSharedConnection;
  children: ReactNode;
}) {
  if (!connection.enabled) return children;
  if (!connection.signedIn || !connection.snapshot)
    return (
      <main id="main-content" aria-label="Coordinator sign-in">
        <h1>Ward Flow coordinator</h1>
        <p>Shared synthetic workspace. Your coordinator account has access to all Ward Flow workflows.</p>
        {connection.error && <p role="alert">{connection.error}</p>}
        {connection.signedIn && connection.status !== "not-authorised" ? (
          <button type="button" onClick={connection.retry}>
            Reconnect
          </button>
        ) : (
          <button
            type="button"
            disabled={connection.status === "loading" || connection.status === "unavailable"}
            onClick={connection.signIn}
          >
            Sign in with Microsoft
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
            : "Coordinator · shared synthetic workspace"}
        {connection.error && <span> {connection.error}</span>}
        {connection.status === "unavailable" && (
          <button type="button" onClick={connection.retry}>
            Retry
          </button>
        )}
        <button type="button" onClick={connection.signOut}>
          Sign out
        </button>
      </div>
      <div inert={blocked}>{children}</div>
    </>
  );
}
