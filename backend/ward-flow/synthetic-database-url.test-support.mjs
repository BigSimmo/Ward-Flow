import { randomBytes } from "node:crypto";

// Test-only helper. Builds an offline database URL whose role secret is
// generated fresh for each call, so no source line holds a credential.
// Never opens a socket; not part of the deployment package allowlist.
export function syntheticDatabaseUrl({
  role = "wardflow_backend",
  host = "127.0.0.1",
  port = 5432,
  database = "synthetic",
} = {}) {
  const url = new URL(`postgresql://${host}:${port}/${database}`);
  url.username = role;
  Reflect.set(url, "password", `offline-${randomBytes(24).toString("hex")}`);
  return url.href;
}
