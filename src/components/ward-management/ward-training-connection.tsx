import { useMemo, type ReactNode } from "react";

import { useTrainingMode } from "./demo-reset/ward-training-mode";
import type { WardSharedConnection } from "./ward-shared-access";
import { SharedSessionContext, type SharedSession } from "./shell/ward-shared-session-context";

/**
 * Feature 47: the connection the provider runs on while the training sandbox is on
 * (`demo-reset/ward-training-mode.ts`). Built fresh rather than spread from the real connection,
 * so no shared snapshot, event log, access API or audit call can travel into the training world.
 * `enabled: false` makes the provider seed and run its ordinary local synthetic world, and makes the
 * inner `WardSharedAccess` run in local mode, which withholds every shared context (access requests,
 * activity audit reads, phone alerts, step-up sign-in, partial views). Its `dispatch` refuses as a
 * second wall: the provider never routes to it while training.
 */
const TRAINING_ONLY = "Training is on: changes stay in this practice world and are not saved for anyone.";
const refuse = () => Promise.reject(new Error(TRAINING_ONLY));
const EMPTY_LOG: NonNullable<WardSharedConnection["eventLog"]> = [];

function trainingConnection(signOut: (reason?: unknown) => void): WardSharedConnection {
  return {
    enabled: false,
    signedIn: false,
    snapshot: null,
    executiveSnapshot: null,
    receivedAt: 0,
    status: "ready",
    error: null,
    eventLog: EMPTY_LOG,
    signIn: () => undefined,
    signOut,
    retry: () => undefined,
    dispatch: () => Promise.resolve({ commandId: "", status: "cancelled", message: TRAINING_ONLY }),
    pushApi: { pushKey: refuse, pushStatus: refuse, pushSubscribe: refuse, pushUnsubscribe: refuse },
  };
}

/**
 * The signed-in session the shell still needs while training: Sign out and the idle sign-out keep
 * working on the real account. Opening a training record logs nothing on the server; it answers
 * "shown" because the training world already holds the whole synthetic record.
 */
function trainingSession(signOut: (reason?: string) => void, accountEmail?: string): SharedSession {
  return { signOut, logRecordView: () => Promise.resolve(true), accountEmail };
}

/** Each training connection's session, so the provider's world knows it runs a training world. */
const sessions = new WeakMap<WardSharedConnection, SharedSession | null>();
export type WardTraining = { session: SharedSession | null };
export const trainingOf = (connection: WardSharedConnection): WardTraining | undefined =>
  sessions.has(connection) ? { session: sessions.get(connection) ?? null } : undefined;

/**
 * Feature 47 wiring for `WardFlowConnection`: undefined outside training, otherwise the local-only
 * connection to run the training world on.
 */
export function useTrainingRuntime(shared: WardSharedConnection): WardSharedConnection | undefined {
  const training = useTrainingMode();
  const sessionOpen = shared.enabled && shared.signedIn;
  const accountEmail = shared.accountEmail ?? undefined;
  const { signOut } = shared;
  return useMemo(() => {
    if (!training) return undefined;
    const connection = trainingConnection(signOut);
    sessions.set(connection, sessionOpen ? trainingSession(signOut, accountEmail) : null);
    return connection;
  }, [training, sessionOpen, accountEmail, signOut]);
}

/** Sign out and the idle sign-out stay on the real account while training; record views log nothing. */
export function TrainingSessionScope({ training, children }: { training?: WardTraining; children: ReactNode }) {
  return training ? (
    <SharedSessionContext.Provider value={training.session}>{children}</SharedSessionContext.Provider>
  ) : (
    children
  );
}
