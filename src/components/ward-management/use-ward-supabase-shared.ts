"use client";
import { useEffect, useRef, useState } from "react";
import { setActNowAppBadge } from "./shell/ward-act-now-notifications";
import { releasePhonePush } from "./shell/ward-phone-push";
import { SharedWorkspaceClient, type SharedView } from "./ward-shared-client";
import { SupabaseWardAuth, WardAuthError, consumeRecoveryFragment, WARD_AUTH_STORAGE_KEY } from "./ward-supabase-auth";
export type WardCredentialForm = {
  open: boolean;
  recovery: boolean;
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
export function useWardSupabaseShared(enabled: boolean) {
  const [view, setView] = useState<SharedView>(emptyView);
  const [signedIn, setSignedIn] = useState(false);
  const [form, setForm] = useState({ open: false, recovery: false, busy: false, message: null as string | null });
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
    signOut: () => Promise<void>;
    retry: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let onVisibilityChange: (() => void) | undefined;
    let auth: SupabaseWardAuth | null = null;
    const disconnect = () => {
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
      if (closed || !auth?.userId || auth.isRecovery) return;
      disconnect();
      setSignedIn(true);
      setForm({ open: false, recovery: false, busy: false, message: null });
      const baseUrl = process.env.NEXT_PUBLIC_WARD_API_BASE_URL!;
      const instance = auth;
      const client = new SharedWorkspaceClient({
        baseUrl: baseUrl.replace(/\/$/, ""),
        token: () => instance.token(),
        changed: (next) => {
          if (closed) return;
          if (next.status === "not-authorised") {
            // A refused session or role ends this connection: stop polling, drop the refused
            // local session so it is not left stored, and keep the not-authorised message visible.
            disconnect();
            setActNowAppBadge(0);
            void instance.signOut().catch(() => {});
          }
          setView(next);
        },
      });
      connection.current = client;
      await client.refresh();
      if (closed || connection.current !== client) return;
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
      }, 3000);
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
        auth = new SupabaseWardAuth({
          url: process.env.NEXT_PUBLIC_WARD_SUPABASE_URL ?? "",
          publishableKey: process.env.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY ?? "",
          storage: window.sessionStorage,
          coordinatorEmail: process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL,
        });
        actions.current = {
          signUp: (email, password) =>
            run(async () => {
              disconnect();
              await auth!.signUp(email, password, window.location.origin + "/mockups/ward-flow");
              if (!closed) {
                setForm((old) => ({
                  ...old,
                  message:
                    "Check your email and confirm the coordinator account, then sign in. Coordinator access still requires setup.",
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
              await auth!.recover(email, window.location.origin + "/mockups/ward-flow");
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
          signOut: async () => {
            const token = auth!.captureAccessTokenForSignOut();
            // Stop board reads, queued writes and late responses in the click's own call stack.
            disconnect();
            setForm({ open: false, recovery: false, busy: false, message: null });
            // The next account on a shared phone never sees this one's act-now count, even when
            // the session has expired and the phone alert cleanup below cannot run.
            setActNowAppBadge(0);
            if (token) {
              const cleanup = new SharedWorkspaceClient({
                baseUrl: base.toString().replace(/\/$/, ""),
                token: async () => token,
                changed: () => {},
              });
              let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
              void Promise.race([
                releasePhonePush({
                  pushKey: () => cleanup.pushKey(),
                  pushStatus: (endpoint) => cleanup.pushStatus(endpoint),
                  pushSubscribe: (subscription) => cleanup.pushSubscribe(subscription),
                  pushUnsubscribe: (endpoint) => cleanup.pushUnsubscribe(endpoint),
                }),
                new Promise<void>((resolve) => {
                  cleanupTimer = setTimeout(resolve, 2000);
                }),
              ])
                .catch(() => {})
                .finally(() => {
                  clearTimeout(cleanupTimer);
                  cleanup.dispose();
                });
            }
            // Auth clears its local session synchronously; remote logout and phone cleanup are independent.
            // The local session is already cleared, so remote logout is best-effort.
            await auth!.signOut().catch(() => {});
          },
          retry: () =>
            run(async () => {
              if (connection.current) {
                await connection.current.retry();
                return;
              }
              await auth!.restore();
              if (auth!.isRecovery) {
                setForm((old) => ({ ...old, open: true, recovery: true }));
                setView({ ...emptyView, status: "ready" });
              } else if (auth!.userId) {
                await connect();
              } else {
                setView({ ...emptyView, status: "ready" });
              }
            }),
        };
        if (fragmentError) {
          fail(fragmentError);
          return;
        }
        await auth.restore(recovery);
        if (closed) return;
        if (auth.isRecovery) {
          setForm((old) => ({ ...old, open: true, recovery: true }));
          setView({ ...emptyView, status: "ready" });
        } else if (auth.userId) await connect();
        else {
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
      disconnect();
      auth?.dispose();
      actions.current = null;
    };
  }, [enabled]);
  return {
    ...view,
    role: view.role ?? view.snapshot?.role,
    membershipId: view.membershipId ?? view.snapshot?.membershipId,
    memberships: view.memberships ?? view.snapshot?.memberships,
    grants: view.grants ?? view.snapshot?.grants,
    signedIn,
    client: connection,
    selectMembership: async (membershipId: string) => {
      if (!connection.current) throw new Error("Shared connection is not active");
      return connection.current.selectMembership(membershipId);
    },
    breakGlass: async (input: Parameters<SharedWorkspaceClient["breakGlass"]>[0]) => {
      if (!connection.current) throw new Error("Shared connection is not active");
      return connection.current.breakGlass(input);
    },
    signIn: () => setForm((old) => ({ ...old, open: true, message: null })),
    signOut: () => {
      void actions.current?.signOut();
    },
    retry: () => {
      void actions.current?.retry();
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
        if (form.recovery) void actions.current?.signOut();
        else setForm((old) => ({ ...old, open: false, message: null }));
      },
    } satisfies WardCredentialForm,
  };
}

export type UseWardSupabaseSharedResult = ReturnType<typeof useWardSupabaseShared>;
