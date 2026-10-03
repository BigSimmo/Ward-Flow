const STORAGE_ACCOUNT = "wflowdev7273a083aue";
// Fixed allowlist of approved Ward Flow storage accounts. Agreement between the two environment
// variables is not resource verification: a mistaken account set in both would otherwise be trusted.
// Add an account here, in a reviewed change, only after verifying it is a Ward Flow resource.
export const APPROVED_STORAGE_ACCOUNTS = Object.freeze([STORAGE_ACCOUNT]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_IDS = new Set([
  "00000000-0000-0000-0000-000000000000",
  "00000000-0000-4000-8000-000000000000",
  "00000000-0000-4000-8000-000000000001",
]);

export function readConfig(env = process.env) {
  const required = [
    "AZURE_TENANT_ID",
    "WARD_API_AUDIENCE",
    "WARD_ALLOWED_OBJECT_ID",
    "AzureWebJobsStorage__accountName",
  ];
  if (required.some((key) => !env[key]?.trim())) throw new Error("Missing backend configuration");
  const tenant = env.AZURE_TENANT_ID.toLowerCase();
  const allowedObjectId = env.WARD_ALLOWED_OBJECT_ID.toLowerCase();
  if (
    !UUID.test(tenant) ||
    !UUID.test(allowedObjectId) ||
    PLACEHOLDER_IDS.has(tenant) ||
    PLACEHOLDER_IDS.has(allowedObjectId)
  )
    throw new Error("Invalid identity configuration");
  if (env.WARD_API_AUDIENCE !== "9b7b160d-9bc7-4712-b748-17ff3e70b706")
    throw new Error("Unapproved backend identity configuration");
  const storageAccount = env.AZURE_STORAGE_ACCOUNT?.trim() || STORAGE_ACCOUNT;
  if (!APPROVED_STORAGE_ACCOUNTS.includes(storageAccount) || env.AzureWebJobsStorage__accountName !== storageAccount)
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
  return {
    tenant,
    audience: env.WARD_API_AUDIENCE,
    allowedObjectId,
    allowTenantUsers,
    origin,
    host: env.HOST || "127.0.0.1",
    port,
    storage: { account: storageAccount, container: "ward-flow-sessions" },
  };
}
