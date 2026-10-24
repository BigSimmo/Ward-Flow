/** Thin adapter for the Supabase Auth REST contract: https://github.com/supabase/auth/blob/master/openapi.yaml. */
const WARD_SUPABASE_ORIGIN = "https://zakzoemeedfepxcstsou.supabase.co";
import {
  WARD_AUTH_STORAGE_KEY,
  WardAuthError,
  consumeRecoveryFragment,
  type WardAuthSession,
  type WardAuthUser,
} from "./ward-auth-link";

export { WARD_AUTH_STORAGE_KEY, WardAuthError, consumeRecoveryFragment };
type User = WardAuthUser;
type Session = WardAuthSession;
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function isValidSession(parsed: unknown): parsed is Session {
  if (!parsed || typeof parsed !== "object") return false;
  const row = parsed as Record<string, unknown>;
  const user = row.user;
  const userId = user && typeof user === "object" ? (user as Record<string, unknown>).id : undefined;
  return (
    typeof row.access_token === "string" &&
    row.access_token.length > 0 &&
    typeof row.refresh_token === "string" &&
    row.refresh_token.length > 0 &&
    typeof row.expiresAt === "number" &&
    Number.isFinite(row.expiresAt) &&
    typeof row.recovery === "boolean" &&
    (!row.recovery ? typeof userId === "string" && userId.length > 0 : true)
  );
}
export type WardBrowserAuthAdapter = {
  readonly isRecovery: boolean;
  readonly userId: string | null;
  reauthenticate(password: string): Promise<void>;
  restore(recovery?: ReturnType<typeof consumeRecoveryFragment>): Promise<void>;
  signUp(email: string, password: string, redirectTo?: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  token(options?: { refresh?: boolean }): Promise<string>;
  recover(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  captureAccessTokenForSignOut(): string | null;
  signOut(thisTabOnly?: boolean): Promise<void>;
  dispose(): void;
};
export class SupabaseWardAuth implements WardBrowserAuthAdapter {
  private session: Session | null = null;
  private generation = 0;
  private disposed = false;
  private requests = new Set<AbortController>();
  private refreshTask: Promise<void> | null = null;
  /** The signed-in account's email, for the step-up sign-in. Memory only, never stored. */
  private email: string | null = null;
  constructor(
    private readonly options: {
      url: string;
      publishableKey: string;
      storage?: StoragePort;
      fetch?: typeof fetch;
      timeoutMs?: number;
      coordinatorEmail?: string;
      /**
       * Called once whenever a held or saved session ends here: sign-out, expiry, a refused token
       * or a changed account. The app clears Ward Flow's browser storage with it
       * (`ward-browser-data.ts`).
       */
      onSessionEnded?: () => void;
    },
  ) {
    if (
      options.url.replace(/\/$/, "") !== WARD_SUPABASE_ORIGIN ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(options.publishableKey)
    )
      throw new WardAuthError("unavailable", "Shared sign-in configuration is unavailable.");
  }
  get isRecovery() {
    return this.session?.recovery === true;
  }
  get userId() {
    return this.session?.user?.id ?? null;
  }
  private assert(generation: number) {
    if (this.disposed || generation !== this.generation)
      throw new WardAuthError("cancelled", "Sign-in request cancelled.");
  }
  private clear() {
    let ended = this.session !== null;
    try {
      ended ||= this.options.storage?.getItem(WARD_AUTH_STORAGE_KEY) != null;
    } catch {
      // Storage blocked: only the in-memory session can have ended.
    }
    this.session = null;
    this.email = null;
    let removed: boolean;
    try {
      this.options.storage?.removeItem(WARD_AUTH_STORAGE_KEY);
      removed = true;
    } catch {
      // Browser storage is optional; it must never prevent memory or provider revocation.
      removed = false;
    }
    if (ended) this.options.onSessionEnded?.();
    return removed;
  }
  private invalidate() {
    this.generation++;
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
    this.refreshTask = null;
  }
  private save(session: Session) {
    this.session = session;
    try {
      this.options.storage?.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Keep rotated credentials in memory. Remove an older saved session when possible.
      try {
        this.options.storage?.removeItem(WARD_AUTH_STORAGE_KEY);
      } catch {
        // A storage failure does not invalidate the verified in-memory session.
      }
    }
  }
  private async request(
    path: string,
    init: RequestInit = {},
    token?: string,
    generation = this.generation,
  ): Promise<unknown> {
    this.assert(generation);
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10000);
    try {
      const response = await (this.options.fetch ?? fetch)(WARD_SUPABASE_ORIGIN + "/auth/v1" + path, {
        ...init,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
        headers: {
          apikey: this.options.publishableKey,
          ...(token ? { authorization: "Bearer " + token } : {}),
          "content-type": "application/json",
        },
      });
      this.assert(generation);
      if (!response.ok) {
        const rejected = [400, 401, 403, 422].includes(response.status);
        if (
          (token && [401, 403].includes(response.status)) ||
          (response.status === 400 && path.includes("grant_type=refresh_token"))
        ) {
          this.clear();
          throw new WardAuthError("session", "Your session has expired. Sign in again.");
        }
        throw new WardAuthError(
          rejected ? "credentials" : "unavailable",
          rejected
            ? "Sign-in or password request was refused. Check your details or request a new recovery link."
            : "Sign-in service is unavailable. Try again.",
        );
      }
      if (response.status === 204) return null;
      const result = await response.json();
      this.assert(generation);
      return result;
    } catch (error) {
      this.assert(generation);
      if (error instanceof WardAuthError) throw error;
      throw new WardAuthError("unavailable", "Sign-in service is unavailable. Try again.");
    } finally {
      clearTimeout(timer);
      this.requests.delete(controller);
    }
  }
  private readSession(value: unknown, recovery: boolean): Session {
    const row = value as Record<string, unknown>;
    if (
      !row ||
      typeof row.access_token !== "string" ||
      !row.access_token ||
      typeof row.refresh_token !== "string" ||
      !row.refresh_token ||
      typeof row.expires_in !== "number" ||
      !Number.isFinite(row.expires_in) ||
      row.expires_in <= 0
    )
      throw new WardAuthError("unavailable", "Sign-in returned an invalid session.");
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expiresAt: Date.now() + row.expires_in * 1000,
      recovery,
    };
  }
  private async verify(session: Session, generation = this.generation) {
    const user = (await this.request("/user", {}, session.access_token, generation)) as User;
    if (!user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id))
      throw new WardAuthError("unavailable", "Sign-in returned an invalid account.");
    if (session.user && session.user.id !== user.id) {
      this.clear();
      throw new WardAuthError("session", "The signed-in account changed. Sign in again.");
    }
    this.assert(generation);
    // Only the id is kept in the saved session. The email stays in memory, for the step-up.
    this.save({ ...session, user: { id: user.id } });
    const email = (user as { email?: unknown }).email;
    this.email = typeof email === "string" && email ? email : null;
  }
  /**
   * The step-up sign-in (role access plan feature 9): the same account signs in again with its
   * password, so the server sees a recent sign-in. A different account, or none, is refused and
   * the session is cleared. A wrong password is a form answer and keeps the session.
   */
  async reauthenticate(password: string) {
    const id = this.userId;
    const email = this.email;
    if (!this.session || this.isRecovery || !id || !email)
      throw new WardAuthError("session", "Sign in again to carry on.");
    const generation = this.generation;
    const value = await this.request(
      "/token?grant_type=password",
      { method: "POST", body: JSON.stringify({ email, password }) },
      undefined,
      generation,
    );
    await this.verify({ ...this.readSession(value, false), user: { id } }, generation);
  }
  async restore(recovery: Session | null = null) {
    if (recovery) {
      this.invalidate();
      this.clear();
      this.save(recovery);
      await this.verify(recovery);
      return;
    }
    let saved: string | null | undefined;
    try {
      saved = this.options.storage?.getItem(WARD_AUTH_STORAGE_KEY);
    } catch {
      // No readable saved credentials: start signed out, as with memory-only auth.
      return;
    }
    if (!saved) return;
    try {
      const parsed: unknown = JSON.parse(saved);
      if (!isValidSession(parsed)) throw new Error();
      this.session = parsed;
    } catch {
      this.clear();
      throw new WardAuthError("session", "Your session has expired. Sign in again.");
    }
    await this.refreshIfNeeded();
    if (this.session) await this.verify(this.session);
  }
  async signUp(email: string, password: string, redirectTo?: string) {
    const nominated = this.options.coordinatorEmail?.trim().toLowerCase();
    const normalized = email.trim().toLowerCase();
    if (!nominated || normalized !== nominated)
      throw new WardAuthError("credentials", "Account creation is restricted to the nominated coordinator email.");
    this.invalidate();
    this.clear();
    const redirect = redirectTo ? new URL(redirectTo) : null;
    if (redirect && (redirect.pathname !== "/ward-flow" || redirect.search || redirect.hash))
      throw new WardAuthError("unavailable", "Invalid confirmation destination.");
    const result = (await this.request(
      "/signup" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect.toString()) : ""),
      { method: "POST", body: JSON.stringify({ email: normalized, password }) },
    )) as Record<string, unknown>;
    // Never adopt a signup session: confirmation and a separate sign-in are required.
    if (result?.access_token || result?.refresh_token)
      throw new WardAuthError(
        "credentials",
        "Email confirmation must be enabled before coordinator setup can continue.",
      );
  }
  async signIn(email: string, password: string) {
    this.invalidate();
    this.clear();
    const generation = this.generation;
    const value = await this.request(
      "/token?grant_type=password",
      { method: "POST", body: JSON.stringify({ email, password }) },
      undefined,
      generation,
    );
    await this.verify(this.readSession(value, false), generation);
  }
  private async refreshIfNeeded(force = false) {
    if (!this.session || (!force && this.session.expiresAt > Date.now() + 60000)) return;
    if (this.refreshTask) return this.refreshTask;
    const session = this.session;
    const generation = this.generation;
    const task = (async () => {
      const value = await this.request(
        "/token?grant_type=refresh_token",
        { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) },
        undefined,
        generation,
      );
      const next = { ...this.readSession(value, session.recovery), user: session.user };
      // Supabase may rotate the refresh token on success; keep it so a transient
      // verification failure can retry without reusing the consumed token.
      this.assert(generation);
      this.save(next);
      await this.verify(next, generation);
    })();
    this.refreshTask = task;
    try {
      await task;
    } finally {
      if (this.refreshTask === task) this.refreshTask = null;
    }
  }
  /** `refresh` forces one refresh, for the single retry after a Ward Flow server 401 (audit 24-3 SM-2). */
  async token(options: { refresh?: boolean } = {}) {
    this.assert(this.generation);
    if (!this.session || this.isRecovery)
      throw new WardAuthError("session", "Complete sign-in or password recovery first.");
    await this.refreshIfNeeded(options.refresh);
    if (!this.session) throw new WardAuthError("session", "Sign in again.");
    return this.session.access_token;
  }
  async recover(email: string, redirectTo: string) {
    const redirect = new URL(redirectTo);
    if (redirect.pathname !== "/ward-flow" || redirect.search || redirect.hash)
      throw new WardAuthError("unavailable", "Invalid recovery destination.");
    await this.request("/recover?redirect_to=" + encodeURIComponent(redirect.toString()), {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }
  async updatePassword(password: string) {
    if (!this.isRecovery || !this.session) throw new WardAuthError("session", "Open a password recovery link first.");
    await this.refreshIfNeeded();
    const session = this.session;
    if (!session) throw new WardAuthError("session", "Your session has expired. Sign in again.");
    const generation = this.generation;
    const user = (await this.request(
      "/user",
      { method: "PUT", body: JSON.stringify({ password }) },
      session.access_token,
      generation,
    )) as User;
    if (user?.id !== session.user?.id) {
      this.clear();
      throw new WardAuthError("session", "The signed-in account changed. Sign in again.");
    }
    this.save({ ...session, recovery: false });
  }
  /** Capture a verified token only for bounded phone-alert cleanup during sign-out. */
  captureAccessTokenForSignOut() {
    return !this.disposed && this.session?.user && !this.isRecovery && this.session.expiresAt > Date.now()
      ? this.session.access_token
      : null;
  }
  async signOut(thisTabOnly = false) {
    const token = this.session?.access_token;
    this.invalidate();
    // Audit 24-3 SM-1: another tab on this sign-in is in use, so its saved session stays.
    if (thisTabOnly) {
      this.session = null;
      return;
    }
    const removed = this.clear();
    let logoutFailure: unknown;
    try {
      if (token) await this.request("/logout?scope=local", { method: "POST" }, token);
    } catch (error) {
      logoutFailure = error;
    }
    if (!removed)
      throw new WardAuthError(
        "unavailable",
        "Signed out here, but this browser could not remove saved sign-in details. Clear this site's browser data before sharing the device.",
      );
    if (logoutFailure) throw logoutFailure;
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
    this.session = null;
  }
}
