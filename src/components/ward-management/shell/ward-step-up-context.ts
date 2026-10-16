import { createContext } from "react";

/**
 * The shared workspace's fresh sign-in with the account's own password (`ward-step-up.tsx`).
 * Absent in the local demo. Its own module, so the shared workspace can supply it without
 * importing the app's state.
 */
export type StepUpReauthenticate = (password: string) => Promise<void>;

export const StepUpReauthContext = createContext<StepUpReauthenticate | null>(null);
