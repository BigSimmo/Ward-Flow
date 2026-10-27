import type { WardBrowserAuthAdapter } from "./ward-supabase-auth";
import { endWardFlowBrowserSession } from "./ward-browser-data";

// H-0305: a browser that blocks storage throws on reaching window.sessionStorage at all. Then
// reads find nothing and writes are skipped, so sign-in still starts and the session lives in
// memory. A failing call on storage that exists still throws, so its caller can say so.
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** This tab's own storage, where the sign-in keeps its refresh token (H-0044). */
export const tabStorage = {
  getItem: (key: string): string | null => sessionStore()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => sessionStore()?.setItem(key, value),
  removeItem: (key: string) => sessionStore()?.removeItem(key),
};

/**
 * The one Supabase sign-in this site uses, shared by the app and the front door's sign-in page so
 * both keep the sign-in in the same place. The adapter loads only when asked for, so the demo's
 * first load does not carry it.
 */
export const createWardAuth = async (): Promise<WardBrowserAuthAdapter> =>
  new (await import("./ward-supabase-auth")).SupabaseWardAuth({
    url: process.env.NEXT_PUBLIC_WARD_SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY ?? "",
    storage: tabStorage,
    coordinatorEmail: process.env.NEXT_PUBLIC_WARD_COORDINATOR_EMAIL,
    // Sign-out, expiry and a refused session all clear Ward Flow's browser storage.
    onSessionEnded: endWardFlowBrowserSession,
  });
