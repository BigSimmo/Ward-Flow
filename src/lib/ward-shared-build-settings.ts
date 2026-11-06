/**
 * CB-5 (front-end audit, 5 Nov 2026): a shared build bakes its browser settings in at build time.
 * Without the API address, the Supabase address or the publishable key, sign-in used to fail only
 * in the browser, and the CSP (`security-headers.ts`) blocked it with no message. `next.config.ts`
 * calls this and stops the build with a plain sentence instead. Values are never echoed, only names.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type BuildEnvironment = Readonly<Record<string, string | undefined>>;

function addressProblem(name: string, value: string | undefined, development: boolean): string | null {
  const text = value?.trim();
  if (!text) return `${name} is not set.`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return `${name} is not a web address.`;
  }
  if (url.username || url.password) return `${name} must not carry a user name or password.`;
  if (url.protocol === "https:") return null;
  // Plain http to this computer is for `next dev` only, as the CSP allows it (security-headers.ts):
  // a production build that names it would have its sign-in blocked in the browser.
  if (development && url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return null;
  return `${name} must start with https:// (plain http to this computer is allowed only in development).`;
}

/** Each missing or unusable shared-build setting, as a sentence. Empty when the build may go on. */
export function sharedBuildSettingProblems(environment: BuildEnvironment): string[] {
  if (environment.NEXT_PUBLIC_WARD_SHARED_ENABLED !== "true") return [];
  const development = environment.NODE_ENV === "development";
  const problems = [
    addressProblem("NEXT_PUBLIC_WARD_API_BASE_URL", environment.NEXT_PUBLIC_WARD_API_BASE_URL, development),
  ];
  // Supabase is the only shipped sign-in provider, and blank selects it (resolveWardAuthProvider).
  if ((environment.NEXT_PUBLIC_WARD_AUTH_PROVIDER?.trim() || "supabase") === "supabase") {
    problems.push(
      addressProblem("NEXT_PUBLIC_WARD_SUPABASE_URL", environment.NEXT_PUBLIC_WARD_SUPABASE_URL, development),
    );
    if (!environment.NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY?.trim())
      problems.push("NEXT_PUBLIC_WARD_SUPABASE_PUBLISHABLE_KEY is not set.");
  }
  return problems.filter((problem): problem is string => problem !== null);
}

/** Throws one plain message naming every problem, for `next.config.ts`. */
export function assertSharedBuildSettings(environment: BuildEnvironment): void {
  const problems = sharedBuildSettingProblems(environment);
  if (problems.length === 0) return;
  throw new Error(
    `This shared build (NEXT_PUBLIC_WARD_SHARED_ENABLED=true) cannot sign anyone in:\n- ${problems.join("\n- ")}\n` +
      "Set them in the build environment (see .env.example), or build the demo without NEXT_PUBLIC_WARD_SHARED_ENABLED.",
  );
}
