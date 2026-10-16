/** Thin adapter for the Supabase Auth REST contract: https://github.com/supabase/auth/blob/master/openapi.yaml. */
const WARD_SUPABASE_ORIGIN = "https://zakzoemeedfepxcstsou.supabase.co";
export const WARD_AUTH_STORAGE_KEY = "ward-flow:auth:zakzoemeedfepxcstsou:v1";
export class WardAuthError extends Error {
  constructor(
    public readonly kind: "credentials" | "session" | "unavailable" | "cancelled",
    message: string,
  ) {
    super(message);
  }
}
type User = { id: string };
type Session = { access_token: string; refresh_token: string; expiresAt: number; recovery: boolean; user?: User };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function consumeRecoveryFragment(
  location: Pick<Location, "hash" | "pathname" | "search">,
  replace: (url: string) => void,
): Session | null {
  const parts = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (
    !["access_token", "refresh_token", "error", "error_code", "error_description", "type"].some((key) => parts.has(key))
  )
    return null;
  replace(location.pathname + location.search);
  const failed = ["error", "error_code", "error_description"].some((key) => parts.has(key));
  if (parts.get("type") === "signup" && !failed) return null;
  if (failed || parts.get("type") !== "recovery" || !parts.get("access_token") || !parts.get("refresh_token"))
    throw new WardAuthError("session", "The recovery link is invalid or expired. Request a new link.");
  const expires = Number(parts.get("expires_in"));
  if (!Number.isFinite(expires) || expires <= 0)
    throw new WardAuthError("session", "The recovery link is invalid or expired. Request a new link.");
  return {
    access_token: parts.get("access_token")!,
    refresh_token: parts.get("refresh_token")!,
    expiresAt: Date.now() + expires * 1000,
    recovery: true,
  };
}
export class SupabaseWardAuth {
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
    this.session = null;
    this.email = null;
    this.options.storage?.removeItem(WARD_AUTH_STORAGE_KEY);
  }
  private invalidate() {
    this.generation++;
    for (const controller of this.requests) controller.abort();
    this.requests.clear();
    this.refreshTask = null;
  }
  private save(session: Session) {
    this.session = session;
    this.options.storage?.setItem(WARD_AUTH_STORAGE_KEY, JSON.stringify(session));
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
    this.save({ ...session, user });
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
    const saved = this.options.storage?.getItem(WARD_AUTH_STORAGE_KEY);
    if (!saved) return;
    try {
      const row = JSON.parse(saved) as Session;
      if (
        typeof row.access_token !== "string" ||
        !row.access_token ||
        typeof row.refresh_token !== "string" ||
        !row.refresh_token ||
        !Number.isFinite(row.expiresAt) ||
        typeof row.recovery !== "boolean" ||
        (!row.recovery && !row.user?.id)
      )
        throw new Error();
      this.session = row;
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
    if (redirect && (redirect.pathname !== "/mockups/ward-flow" || redirect.search || redirect.hash))
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
  private async refreshIfNeeded() {
    if (!this.session || this.session.expiresAt > Date.now() + 60000) return;
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
  async token() {
    this.assert(this.generation);
    if (!this.session || this.isRecovery)
      throw new WardAuthError("session", "Complete sign-in or password recovery first.");
    await this.refreshIfNeeded();
    if (!this.session) throw new WardAuthError("session", "Sign in again.");
    return this.session.access_token;
  }
  async recover(email: string, redirectTo: string) {
    const redirect = new URL(redirectTo);
    if (redirect.pathname !== "/mockups/ward-flow" || redirect.search || redirect.hash)
      throw new WardAuthError("unavailable", "Invalid recovery destination.");
    await this.request("/recover?redirect_to=" + encodeURIComponent(redirect.toString()), {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }
  async updatePassword(password: string) {
    if (!this.isRecovery || !this.session) throw new WardAuthError("session", "Open a password recovery link first.");
    await this.refreshIfNeeded();
    const session = this.session!;
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
  async signOut() {
    const token = this.session?.access_token;
    this.invalidate();
    this.clear();
    if (token) await this.request("/logout?scope=local", { method: "POST" }, token);
  }
  dispose() {
    this.disposed = true;
    this.invalidate();
    this.session = null;
  }
}
