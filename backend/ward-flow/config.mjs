import { readPushConfig } from "./push.mjs";
import { readSupabaseIdentityConfig, readSupabaseDatabaseConfig } from "./supabase-config.mjs";
import { readPortablePostgresConfig } from "./postgres-config.mjs";

const STORAGE_ACCOUNT = "wflowdev7273a083aue";
// Fixed allowlist of approved Ward Flow storage accounts. Agreement between the two environment
// variables is not resource verification: a mistaken account set in both would otherwise be trusted.
// Add an account here, in a reviewed change, only after verifying it is a Ward Flow resource.
export const APPROVED_STORAGE_ACCOUNTS = Object.freeze([STORAGE_ACCOUNT]);
/** The single approved shared database target (matches infra/azure-settings.example.json). */
export const APPROVED_PG_SERVER = "wardflow-dev-aue";
export const APPROVED_PG_DATABASE = "wardflow_dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_IDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000001",
]);

export function readConfig(env = process.env) {
  const legacyAzurePreset =
    !env.WARD_SUPABASE_PROJECT_REF &&
    !env.WARD_SUPABASE_DATABASE_URL &&
    !env.WARD_SUPABASE_URL &&
    Boolean(
      env.AZURE_TENANT_ID ||
      env.WARD_ALLOWED_OBJECT_ID ||
      env.WARD_API_AUDIENCE ||
      env.AzureWebJobsStorage__accountName ||
      env.AZURE_STORAGE_ACCOUNT ||
      env.WARD_PG_HOST,
    );
  const databaseProvider = env.WARD_DATABASE_PROVIDER || (legacyAzurePreset ? "azure" : "supabase");
  const authProvider = env.WARD_AUTH_PROVIDER || (legacyAzurePreset ? "entra" : "supabase");
  if (!["azure", "supabase", "postgres"].includes(databaseProvider) || !["entra", "supabase"].includes(authProvider))
    throw new Error("Invalid provider configuration");
  const required = authProvider === "entra" ? ["AZURE_TENANT_ID", "WARD_API_AUDIENCE", "WARD_ALLOWED_OBJECT_ID"] : [];
  if (databaseProvider === "azure") required.push("AzureWebJobsStorage__accountName");
  if (required.some((key) => !env[key]?.trim())) throw new Error("Missing backend configuration");
  const tenant = authProvider === "entra" ? env.AZURE_TENANT_ID.toLowerCase() : undefined;
  const allowedObjectId = authProvider === "entra" ? env.WARD_ALLOWED_OBJECT_ID.toLowerCase() : undefined;
  if (
    authProvider === "entra" &&
    (!UUID.test(tenant) ||
      !UUID.test(allowedObjectId) ||
      PLACEHOLDER_IDS.has(tenant) ||
      PLACEHOLDER_IDS.has(allowedObjectId))
  )
    throw new Error("Invalid identity configuration");
  if (authProvider === "entra" && env.WARD_API_AUDIENCE !== "9b7b160d-9bc7-4712-b748-17ff3e70b706")
    throw new Error("Unapproved backend identity configuration");
  const storageAccount = env.AZURE_STORAGE_ACCOUNT?.trim() || STORAGE_ACCOUNT;
  if (
    databaseProvider === "azure" &&
    (!APPROVED_STORAGE_ACCOUNTS.includes(storageAccount) || env.AzureWebJobsStorage__accountName !== storageAccount)
  )
    throw new Error("Unapproved storage account");
  const origin = env.WARD_ALLOWED_ORIGIN || null;
  if (origin) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      throw new Error("Invalid origin configuration");
  }
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port configuration");
  const allowTenantUsers = env.WARD_ALLOW_TENANT_USERS === "true";
  const shared = env.WARD_SHARED_ENABLED === "true";
  const dataMode = env.WARD_DATA_MODE || "prototype";
  if (dataMode !== "prototype") throw new Error("Live data mode is not commissioned in this release");
  const coordinatorIds = (
    authProvider === "supabase"
      ? env.WARD_COORDINATOR_USER_IDS || ""
      : env.WARD_COORDINATOR_OBJECT_IDS || allowedObjectId
  )
    .split(",")
    .map((id) => id.trim().toLowerCase());
  if (coordinatorIds.some((id) => !UUID.test(id) || PLACEHOLDER_IDS.has(id)))
    throw new Error("Invalid coordinator configuration");
  let postgres = null;
  if ((databaseProvider === "supabase" || databaseProvider === "postgres") && shared) {
    postgres = databaseProvider === "supabase" ? readSupabaseDatabaseConfig(env) : readPortablePostgresConfig(env);
    if (!UUID.test(env.WARD_WORKSPACE_ID ?? "") || PLACEHOLDER_IDS.has(env.WARD_WORKSPACE_ID.toLowerCase()))
      throw new Error("Invalid workspace configuration");
  } else if (shared) {
    // Provisioning verifies this resource ID against Azure before writing application settings.
    // Only the one approved server is accepted: rg-wardflow-dev-aue / wardflow-dev-aue, database
    // wardflow_dev. Any other server, even in the same resource group, is refused. The host is
    // derived from the resource rather than trusting a supplied hostname.
    const resource =
      /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/rg-wardflow-dev-aue\/providers\/Microsoft\.DBforPostgreSQL\/flexibleServers\/wardflow-dev-aue$/i.test(
        env.WARD_PG_RESOURCE_ID ?? "",
      );
    if (
      !resource ||
      env.WARD_PG_HOST !== `${APPROVED_PG_SERVER}.postgres.database.azure.com` ||
      env.WARD_PG_DATABASE !== APPROVED_PG_DATABASE ||
      env.WARD_PG_USER !== "wardflow_backend"
    )
      throw new Error("Unapproved shared database target");
    if (!UUID.test(env.WARD_WORKSPACE_ID ?? "") || PLACEHOLDER_IDS.has(env.WARD_WORKSPACE_ID.toLowerCase()))
      throw new Error("Invalid workspace configuration");
    postgres = { host: env.WARD_PG_HOST, database: env.WARD_PG_DATABASE, user: env.WARD_PG_USER };
  }
  return {
    databaseProvider,
    authProvider,
    tenant,
    audience: authProvider === "entra" ? env.WARD_API_AUDIENCE : undefined,
    allowedObjectId,
    allowTenantUsers,
    shared,
    dataMode,
    coordinatorIds,
    workspaceId: env.WARD_WORKSPACE_ID?.toLowerCase(),
    postgres,
    ...(authProvider === "supabase" ? { supabase: readSupabaseIdentityConfig(env) } : {}),
    // Phone push needs the shared workspace (subscriptions and act-now state live in PostgreSQL).
    push: shared ? readPushConfig(env) : null,
    origin,
    host: env.HOST || "127.0.0.1",
    port,
    storage: databaseProvider === "azure" ? { account: storageAccount, container: "ward-flow-sessions" } : null,
  };
}
