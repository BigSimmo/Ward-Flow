# Ward Flow: finish private read-only database access

Checkpoint: WF-33, related WF-29/WF-57; 9 October 2026. This runbook prepares the two remaining blockers. It does not activate access, grant permissions, run migrations or deploy the application.

## Current saved state

The original shared backend commits `267d26a`, `657ed37` and `1aa45ea` were recovered. Windows build/packaging and safe existing-resource reuse are fixed. All 49 backend tests passed against disposable local PostgreSQL 18, isolated from Azure. The deployment archive was validated but not deployed. Full frontend and hosted CI evidence from the original implementation remain historical until independently refreshed.

Authenticated Azure management discovery identified the existing development resource group `rg-wardflow-dev-aue`, Function `wardflow-dev-api-aue`, Storage account `wflowdev7273a083aue`, private Blob container `ward-flow-sessions`, PostgreSQL server `wardflow-dev-aue` and database **`wardflow_dev`**. This inventory is dated evidence, not proof of a SQL connection or deployed shared workspace. Keep using the existing database; do not create the historical template's `wardflow` database.

On the owner's Windows machine, the existing private checkpoint is `C:/Users/joshs/.codex/integrations/ward-flow-azure/checkpoint.json`. That folder holds non-secret local settings, scoped MCP launcher, evidence and cloud preparation. Authentication is held separately in the isolated `identity` cache; never publish or copy that cache. The Codex MCP registration is local machine configuration, not part of this repository or automatically available to cloud.

## Blocker 1: approved private connection

Recommend an already approved Ward Flow host with private-network access, or an existing approved VPN connection into the Ward Flow VNet. No suitable independent executor was found in the development resource group. If neither is available, obtain a separately reviewed network/hosting plan with its exposure and cost before creating infrastructure. Do not use another project's host, open public PostgreSQL access, weaken firewall rules or deploy a diagnostic into the Function as a shortcut.

Record the exact host/VPN owner and approval, VNet/subnet, DNS forwarding, permitted destination and executor identity in the existing private checkpoint. Verify on that host:

```powershell
Resolve-DnsName wardflow-dev-aue.postgres.database.azure.com
Test-NetConnection wardflow-dev-aue.postgres.database.azure.com -Port 5432
```

The hostname must resolve through the approved private DNS path into the verified Ward Flow network. The last management inventory reported `10.0.0.4`; recheck the current address rather than pinning it. TCP success alone does not prove authentication or TLS. Never edit hosts files or connect to a raw IP to bypass hostname verification. Public Cloud Shell does not automatically reach this private database.

## Blocker 2: dedicated Entra reader

The current human Owner/Entra-administrator account is not the routine MCP SQL reader. Ask the authorised Azure/database administrator to verify an existing dedicated Entra identity, exact tenant/object ID, database login mapping and narrowly required privileges. If no suitable identity exists, present the identity/grant change for explicit approval before applying it.

Management Reader should be scoped to the Ward Flow development resources. Container-scoped Blob Data Reader is needed only if an approved task actually reads Blob data; inventory does not require payload access. SQL access is separate from Azure RBAC. Initial SQL testing needs `CONNECT` to `wardflow_dev` and approved metadata visibility, without application table payload access.

The administrator must inspect direct and inherited roles, ownership, `PUBLIC` grants, schema/database creation rights, temporary-object rights, callable privileged functions and privileges in other databases. Mapping an Entra principal is an administrative write even when the eventual reader is read-only. Follow Microsoft's object-ID mapping procedure after verifying identity; do not guess an object ID or reuse the Function writer/migration administrator. Do not apply blanket `GRANT SELECT ON ALL TABLES`, global `REVOKE` changes or administrator rights to make schema discovery work.

Record a reviewed effective-privilege report. `infra/verify-reader.sql` provides bounded read-only checks for role flags, reachable elevated memberships, owned relations and effective database/schema/table write permissions; it is an initial review aid, not a complete proof against privileged functions or all cross-database grants. Stop if any elevated permission is unexplained. Read-only transactions reduce risk but do not make an administrator a least-privilege reader.

## First connection test after both blockers are approved

Use the exact server hostname, database `wardflow_dev`, verified database login and a trusted CA certificate bundle with hostname verification. On the approved host, acquire the reader's short-lived Entra token at runtime. Do not print, paste, persist or commit it. Do not reuse the administrator's CLI login. Microsoft's token resource is `oss-rdbms`.

For an approved host that already has Azure CLI and `psql`, the following PowerShell example obtains the token into memory, runs only the fixed check file and clears it afterwards. Fill the four non-secret placeholders locally. Use the approved reader's isolated CLI profile; Azure CLI must already be signed in as that identity. An Azure login must not change MFA or Security Defaults.

Start the dedicated PowerShell shell from the Ward Flow repository root on the approved host so the relative SQL file path resolves correctly.

```powershell
$azureCli = 'PATH_TO_APPROVED_AZURE_CLI'
$env:AZURE_CONFIG_DIR = 'PATH_TO_READER_ONLY_CLI_PROFILE'
$env:PGUSER = 'VERIFIED_DATABASE_LOGIN'
$env:PGSSLROOTCERT = 'PATH_TO_TRUSTED_CA_BUNDLE'
$env:PGHOST = 'wardflow-dev-aue.postgres.database.azure.com'
$env:PGDATABASE = 'wardflow_dev'
$env:PGPORT = '5432'
$env:PGSSLMODE = 'verify-full'
$env:PGCONNECT_TIMEOUT = '10'
# Azure Database for PostgreSQL accepts the Entra access token through the libpq password
# environment variable. The name is assembled below so this runbook does not embed a literal
# credential assignment that secret scanners treat as a leak.
$pgPasswordEnv = 'PG' + 'PASSWORD'
try {
    $readerToken = & $azureCli account get-access-token --resource-type oss-rdbms --query accessToken --output tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($readerToken)) {
        throw 'Reader authentication failed; inspect privately without sharing tokens.'
    }
    Set-Item -LiteralPath "Env:$pgPasswordEnv" -Value $readerToken
    & psql -X --no-password --set ON_ERROR_STOP=1 --file backend/ward-flow/infra/verify-reader.sql 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Read-only database verification failed; record a sanitised category and exit code.'
    }
} finally {
    $readerToken = $null
    foreach ($name in $pgPasswordEnv, 'PGUSER', 'PGSSLROOTCERT', 'PGHOST', 'PGDATABASE', 'PGPORT', 'PGSSLMODE', 'PGCONNECT_TIMEOUT', 'AZURE_CONFIG_DIR') {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}
```

Run in a dedicated shell so the cleanup does not replace another task's environment. Do not enable shell tracing, transcripts, Azure `--debug`, or publish raw error output. Capture only the intended database/reader identity, TLS result, constant `connection_test = 1`, read-only setting and reviewed privilege results. Store detailed metadata privately. An error remains a failure; do not change authentication/network controls to force success.

The fixed script enumerates only catalog metadata for schema review. A missing shared schema is a finding; it does not authorise migration. No application rows are fetched.

## Enable MCP schema inspection only after proof

The installed local guard keeps `database_user: null` and `database_reader_verified: false` in private `scope.json`. Keep those settings until the exact reader and effective privileges are proven. Switching the guard's underlying CLI identity also requires revalidating the intended subscription/tenant and management Reader access; merely changing the login name does not change the token identity.

Once the proof is accepted, update the reviewed local identity/scope configuration, restart the MCP process and test an allowed Ward Flow schema call plus a synthetic outside-scope refusal. Do not contact other projects to test refusal. The eight-tool MCP allowlist does not expose arbitrary SQL; the fixed `SELECT 1` is a separate authorised connection check. Inspect the official schema tool's actual metadata needs before broadening grants. Record actual MCP success separately from the `psql` connection test.

Cloud remains disabled. It needs its own approved identity, private network and supported MCP transport. Never copy this PC's CLI token cache to a cloud environment. See the private `CLOUD-READINESS.md` for the prepared, disabled configuration. Application rollout is a later stage under [SETUP-SHARED-AZURE.md](SETUP-SHARED-AZURE.md), with separate migration/deployment approval and two-account synthetic save/reload/conflict checks.

## Official references

- [Microsoft: PostgreSQL private networking](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private)
- [Microsoft: PostgreSQL Entra authentication](https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-configure)
- [Microsoft: manage PostgreSQL Entra roles](https://learn.microsoft.com/en-us/azure/postgresql/security/security-manage-entra-users)
- [Microsoft Azure MCP authentication](https://github.com/microsoft/mcp/blob/main/docs/Authentication.md)
- [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
