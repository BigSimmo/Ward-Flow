export const APPROVED_SUPABASE_PROJECT = "zakzoemeedfepxcstsou";
export const APPROVED_SUPABASE_URL = `https://${APPROVED_SUPABASE_PROJECT}.supabase.co`;
export const APPROVED_SUPABASE_POOLER = "aws-0-ap-southeast-2.pooler.supabase.com";

export function validateSupabaseDatabaseUrl(connectionString, { runtime = true } = {}) {
  if (typeof connectionString !== "string" || /[\r\n]|\?$|#$/.test(connectionString))
    throw new Error("Invalid shared database configuration");
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid shared database configuration");
  }
  const user = decodeURIComponent(url.username);
  const direct =
    url.hostname === `db.${APPROVED_SUPABASE_PROJECT}.supabase.co` &&
    (runtime ? user === "wardflow_backend" : Boolean(user && user !== "wardflow_backend"));
  const poolerSuffix = `.${APPROVED_SUPABASE_PROJECT}`;
  const pooler =
    url.hostname === APPROVED_SUPABASE_POOLER &&
    (runtime
      ? user === `wardflow_backend${poolerSuffix}`
      : Boolean(
          user.endsWith(poolerSuffix) &&
          user.length > poolerSuffix.length &&
          user !== `wardflow_backend${poolerSuffix}`,
        ));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    (!direct && !pooler) ||
    url.pathname !== "/postgres" ||
    !url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== "5432")
  )
    throw new Error("Unapproved shared database target or runtime role");
  return connectionString;
}

export function readSupabaseIdentityConfig(env) {
  if (env.WARD_SUPABASE_PROJECT_REF !== APPROVED_SUPABASE_PROJECT || env.WARD_SUPABASE_URL !== APPROVED_SUPABASE_URL)
    throw new Error("Unapproved Supabase project configuration");
  // This adapter requires a publishable key, never a service-role or secret key.
  const key = env.WARD_SUPABASE_PUBLISHABLE_KEY;
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? ""))
    throw new Error("Invalid Supabase publishable key configuration");
  return { projectRef: APPROVED_SUPABASE_PROJECT, url: APPROVED_SUPABASE_URL, publishableKey: key };
}

export function readSupabaseDatabaseConfig(env) {
  if (env.WARD_SUPABASE_PROJECT_REF !== APPROVED_SUPABASE_PROJECT)
    throw new Error("Unapproved Supabase project configuration");
  return {
    connectionString: validateSupabaseDatabaseUrl(env.WARD_SUPABASE_DATABASE_URL),
    ...(env.WARD_SUPABASE_CA_CERT_FILE?.trim() ? { caCertificateFile: env.WARD_SUPABASE_CA_CERT_FILE.trim() } : {}),
  };
}
