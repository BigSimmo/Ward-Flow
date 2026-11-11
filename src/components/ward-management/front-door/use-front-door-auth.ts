"use client";

import { useEffect, useRef, useState } from "react";

import type {
  WardCredentialForm,
  WardCredentialMessageKind,
} from "@/components/ward-management/use-ward-supabase-shared";
import { consumeRecoveryLink, deviceStorage, WardAuthError } from "@/components/ward-management/ward-auth-link";
import { createWardAuth } from "@/components/ward-management/ward-auth-session";
import { requestFrontDoorPass } from "./front-door-pass-client";
import type { WardBrowserAuthAdapter } from "@/components/ward-management/ward-supabase-auth";

type Phase = "checking" | "ready" | "opening";
type FormState = {
  busy: boolean;
  message: string | null;
  messageKind: WardCredentialMessageKind | null;
  recovery: boolean;
  accountEmail: string | null;
};
const READY: FormState = { busy: false, message: null, messageKind: null, recovery: false, accountEmail: null };

/** The kind of message a failed sign-in step shows, as the app itself words it. */
function failure(error: unknown): Pick<FormState, "message" | "messageKind"> {
  if (error instanceof WardAuthError)
    return {
      message: error.message,
      messageKind: error.kind === "credentials" ? "credentials" : error.kind === "session" ? "info" : "unavailable",
    };
  return { message: "Sign-in service is unavailable. Try again.", messageKind: "unavailable" };
}

/**
 * The sign-in page's own sign-in, for a site behind the front door. It signs in with the same
 * Supabase sign-in the app uses (kept in this tab, as the app keeps it), asks the server for the
 * front door's pass, then opens `next`. The app then picks the sign-in up and lands the account on
 * its role's own home. A tab that is still signed in (another tab's idle sign-out ended the pass,
 * say) goes straight through.
 */
export function useFrontDoorAuth(next: string): { phase: Phase; form: WardCredentialForm | undefined } {
  const [phase, setPhase] = useState<Phase>("checking");
  const [state, setState] = useState<FormState>(READY);
  const [configured, setConfigured] = useState(true);
  const auth = useRef<WardBrowserAuthAdapter | null>(null);
  const opening = useRef(0);

  const open = async (adapter: WardBrowserAuthAdapter) => {
    if (auth.current !== adapter) return;
    const attempt = ++opening.current;
    const current = () => auth.current === adapter && opening.current === attempt;
    setPhase("opening");
    try {
      const token = await adapter.token();
      if (!current()) return;
      const response = await requestFrontDoorPass({ token });
      if (!current()) return;
      if (response?.ok) {
        window.location.replace(next);
        return;
      }
      const said = (await response?.json().catch(() => null)) as { error?: unknown } | null;
      if (!current()) return;
      setPhase("ready");
      setState((old) => ({
        ...old,
        busy: false,
        message: typeof said?.error === "string" ? said.error : "Sign-in service is unavailable. Try again.",
        messageKind: response?.status === 401 ? "info" : "unavailable",
      }));
    } catch (error) {
      if (!current()) return;
      setPhase("ready");
      setState((old) => ({ ...old, busy: false, ...failure(error) }));
    }
  };

  useEffect(() => {
    let closed = false;
    void (async () => {
      let recovery: ReturnType<typeof consumeRecoveryLink> = null;
      let linkError: unknown = null;
      try {
        // Erase a recovery link's code from the address before anything else runs.
        recovery = consumeRecoveryLink(
          window.location,
          (url) => window.history.replaceState(window.history.state, "", url),
          deviceStorage,
        );
      } catch (error) {
        linkError = error;
      }
      let adapter: WardBrowserAuthAdapter;
      try {
        adapter = await createWardAuth();
      } catch {
        if (!closed) {
          setConfigured(false);
          setPhase("ready");
        }
        return;
      }
      if (closed) {
        adapter.dispose();
        return;
      }
      auth.current = adapter;
      if (linkError) {
        setState({ ...READY, ...failure(linkError) });
        setPhase("ready");
        return;
      }
      try {
        await adapter.restore(recovery);
      } catch (error) {
        if (!closed) setState({ ...READY, ...failure(error) });
      }
      if (closed) return;
      if (adapter.isRecovery) {
        setState({ ...READY, recovery: true, accountEmail: adapter.accountEmail });
        setPhase("ready");
      } else if (adapter.userId) await open(adapter);
      else setPhase("ready");
    })();
    return () => {
      closed = true;
      opening.current += 1;
      auth.current?.dispose();
      auth.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Once per page: `open` closes over `next`, which is fixed for the page's life (the server read it from the address).
  }, []);

  const run = async (step: (adapter: WardBrowserAuthAdapter) => Promise<void>) => {
    const adapter = auth.current;
    if (!adapter) return;
    setState((old) => ({ ...old, busy: true, message: null, messageKind: null }));
    try {
      await step(adapter);
    } catch (error) {
      if (auth.current === adapter) setState((old) => ({ ...old, busy: false, ...failure(error) }));
    }
  };
  const home = () => window.location.origin + "/ward-flow";

  if (!configured) return { phase, form: undefined };
  return {
    phase,
    form: {
      open: true,
      ...state,
      signupAvailable:
        process.env.NEXT_PUBLIC_WARD_OPEN_SIGNUP === "true" && !!process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL?.trim(),
      signIn: (email, password) =>
        run(async (adapter) => {
          await adapter.signIn(email, password);
          await open(adapter);
        }),
      recover: (email) =>
        run(async (adapter) => {
          await adapter.recover(email, home());
          setState((old) => ({
            ...old,
            busy: false,
            message: "If this account is registered, a recovery link will be emailed.",
            messageKind: "sent",
          }));
        }),
      updatePassword: (password) =>
        run(async (adapter) => {
          await adapter.updatePassword(password);
          await open(adapter);
        }),
      signUp: (email, password) =>
        run(async (adapter) => {
          await adapter.signUp(email, password, home());
          setState((old) => ({
            ...old,
            busy: false,
            message:
              "Check your email and confirm the account, then sign in. An access admin still needs to give you a role.",
            messageKind: "info",
          }));
        }),
      cancel: () => {
        if (state.recovery) void auth.current?.signOut().catch(() => {});
        setState(READY);
      },
    },
  };
}
