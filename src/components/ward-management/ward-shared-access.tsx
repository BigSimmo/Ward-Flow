"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";
import { SharedWorkspaceClient, type SharedView } from "./ward-shared-client";
import type { WardFlowEvent } from "./ward-flow-events";

export type WardSharedConnection = SharedView & {
  enabled: boolean;
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  retry: () => void;
  dispatch: (event: WardFlowEvent) => void;
};

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
      client.current?.dispose();
      setView({ snapshot: null, receivedAt: 0, status: "loading", error: null });
      setSignedIn(false);
      void auth.current?.logoutRedirect({
        account: account.current,
        postLogoutRedirectUri: `${window.location.origin}/mockups/ward-flow`,
      });
    },
    retry: () => {
      void client.current?.retry();
    },
    dispatch,
  };
}

export function WardSharedAccess({ connection, children }: { connection: WardSharedConnection; children: ReactNode }) {
  if (!connection.enabled) return children;
  if (!connection.signedIn || !connection.snapshot)
    return (
      <main aria-label="Coordinator sign-in">
        <h1>Ward Flow coordinator</h1>
        <p>Shared synthetic workspace. Your coordinator account has access to all Ward Flow workflows.</p>
        {connection.error && <p role="alert">{connection.error}</p>}
        {connection.signedIn && connection.status !== "not-authorised" ? (
          <button type="button" onClick={connection.retry}>
            Reconnect
          </button>
        ) : (
          <button type="button" disabled={connection.status === "loading"} onClick={connection.signIn}>
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
