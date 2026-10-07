import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const [mode, settingsPath] = process.argv.slice(2);
if (!["inspect", "provision", "configure", "verify"].includes(mode) || !settingsPath)
  throw new Error(
    "Usage: node azure-setup.mjs inspect|provision|configure|verify /absolute/path/to/azure-settings.local.json",
  );
const config = JSON.parse(await readFile(settingsPath, "utf8"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (config.resourceGroup !== "rg-wardflow-dev-aue" || config.functionName !== "wardflow-dev-api-aue")
  throw new Error("Wrong Ward Flow Azure target");
if (![config.subscriptionId, config.tenantId].every((id) => UUID.test(id)))
  throw new Error("Set the actual Ward Flow subscription and tenant IDs before inspecting Azure");
if (
  mode !== "inspect" &&
  (!Array.isArray(config.coordinatorObjectIds) ||
    !config.coordinatorObjectIds.length ||
    ![config.frontendClientId, config.administratorObjectId, ...config.coordinatorObjectIds].every((id) =>
      UUID.test(id),
    ))
)
  throw new Error("Set the actual Ward Flow coordinator, frontend and administrator identity IDs before running setup");
if (new URL(config.frontendOrigin).origin !== config.frontendOrigin || !config.frontendOrigin.startsWith("https://"))
  throw new Error("An exact HTTPS frontend origin is required");
const apiClientId = "9b7b160d-9bc7-4712-b748-17ff3e70b706";

function az(args, json = true) {
  const result = spawnSync(
    "az",
    [...args, "--subscription", config.subscriptionId, ...(json ? ["--output", "json"] : ["--output", "none"])],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Azure command failed (${args.slice(0, 3).join(" ")}). Use the selected Ward Flow identity and check Azure access. ${result.error?.code ?? ""}`,
    );
  return json ? JSON.parse(result.stdout) : null;
}
// Account/ad commands do not accept --subscription; retain the selected identity and verify its tenant.
function directory(args) {
  const result = spawnSync("az", [...args, "--output", "json"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Azure identity/directory access unavailable");
  return JSON.parse(result.stdout || "null");
}
const account = directory(["account", "show", "--subscription", config.subscriptionId]);
if (
  account.id.toLowerCase() !== config.subscriptionId.toLowerCase() ||
  account.tenantId.toLowerCase() !== config.tenantId.toLowerCase()
)
  throw new Error("Azure subscription/tenant mismatch");
if (directory(["account", "show"]).tenantId.toLowerCase() !== config.tenantId.toLowerCase())
  throw new Error("Select the Ward Flow tenant for directory commands before running setup");
const group = az(["group", "show", "--name", config.resourceGroup]);
const app = az(["functionapp", "show", "--resource-group", config.resourceGroup, "--name", config.functionName]);
if (
  !app.identity?.principalId ||
  app.identity.tenantId.toLowerCase() !== config.tenantId.toLowerCase() ||
  !["australiaeast", "australiasoutheast"].includes(app.location.toLowerCase().replaceAll(" ", ""))
)
  throw new Error("Verify the Ward Flow Function's Australian location and managed identity before continuing");
const candidates = az(["postgres", "flexible-server", "list", "--resource-group", config.resourceGroup]);
let server = config.serverName
  ? candidates.find((row) => row.name === config.serverName)
  : candidates.length === 1
    ? candidates[0]
    : null;
if (!config.serverName && candidates.length > 1)
  throw new Error(
    "Several PostgreSQL servers exist. Set serverName to the verified Ward Flow server; no resources were changed",
  );

if (mode === "provision" && !server) {
  if (app.virtualNetworkSubnetId)
    throw new Error(
      "The existing Function has network integration. Reuse its reviewed network or provide a reviewed peering design before adding a new database network",
    );
  const networks = az(["network", "vnet", "list", "--resource-group", config.resourceGroup]);
  if (networks.some((row) => row.name === "vnet-wardflow-dev-aue"))
    throw new Error("An existing Ward Flow network needs inspection before this template may manage it");
  const serverName = config.serverName || "wardflow-dev-pg-aue";
  const deployment = az([
    "deployment",
    "group",
    "create",
    "--resource-group",
    config.resourceGroup,
    "--name",
    "wardflow-shared-database",
    "--template-file",
    fileURLToPath(new URL("./infra/database.bicep", import.meta.url)),
    "--parameters",
    `serverName=${serverName}`,
    `tenantId=${config.tenantId}`,
    `administratorObjectId=${config.administratorObjectId}`,
    `administratorName=${config.administratorName}`,
    `administratorType=${config.administratorType || "User"}`,
    `location=${app.location.toLowerCase().replaceAll(" ", "")}`,
  ]);
  config.serverName = serverName;
  config.functionSubnetId = deployment.properties.outputs.functionSubnetId.value;
  server = az(["postgres", "flexible-server", "show", "--resource-group", config.resourceGroup, "--name", serverName]);
  await writeFile(settingsPath, `${JSON.stringify(config, null, 2)}\n`);
}
if (server) {
  const location = server.location.toLowerCase().replaceAll(" ", "");
  if (
    mode !== "inspect" &&
    (!["australiaeast", "australiasoutheast"].includes(location) ||
      server.network?.publicNetworkAccess !== "Disabled" ||
      server.authConfig?.activeDirectoryAuth !== "Enabled" ||
      server.authConfig?.passwordAuth !== "Disabled")
  )
    throw new Error(
      "Existing database requires review: Australian hosting, private networking and Entra-only authentication are required. Existing settings were preserved",
    );
  config.serverName = server.name;
}
console.log(
  JSON.stringify(
    {
      subscriptionId: account.id,
      tenantId: account.tenantId,
      resourceGroup: group.name,
      functionName: app.name,
      functionHost: app.defaultHostName,
      functionIdentity: app.identity.principalId,
      database: server
        ? {
            name: server.name,
            resourceId: server.id,
            host: server.fullyQualifiedDomainName,
            location: server.location,
            state: server.state,
            backup: server.backup,
            network: server.network,
          }
        : "No PostgreSQL server found in the verified Ward Flow resource group",
    },
    null,
    2,
  ),
);
if (mode === "inspect") process.exit(0);
if (!server) throw new Error("Provision a verified database first");
if (mode === "verify" && !UUID.test(config.workspaceId ?? ""))
  throw new Error("Verify requires the configured stable workspace ID");
if (!config.workspaceId || !UUID.test(config.workspaceId)) config.workspaceId = randomUUID();
await writeFile(settingsPath, `${JSON.stringify(config, null, 2)}\n`);
const output = new URL("./dist/setup/", import.meta.url);
await mkdir(output, { recursive: true });
const api = directory(["ad", "app", "show", "--id", apiClientId]);
const scope = api.api?.oauth2PermissionScopes?.find((row) => row.value === "WardFlow.Access" && row.isEnabled);
if (!scope || api.api.requestedAccessTokenVersion !== 2 || !api.identifierUris?.length)
  throw new Error(
    "Verify the existing Ward Flow v2 API registration and enabled WardFlow.Access scope; no identity policy was replaced",
  );
const frontend = directory(["ad", "app", "show", "--id", config.frontendClientId]);
const redirect = `${config.frontendOrigin}/mockups/ward-flow`;
const frontendValues = {
  NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
  NEXT_PUBLIC_WARD_TENANT_ID: config.tenantId,
  NEXT_PUBLIC_WARD_CLIENT_ID: config.frontendClientId,
  NEXT_PUBLIC_WARD_API_SCOPE: `${api.identifierUris[0]}/WardFlow.Access`,
  NEXT_PUBLIC_WARD_API_BASE_URL: `https://${app.defaultHostName}`,
};
if (mode === "verify") {
  const { AzureCliCredential } = await import("@azure/identity");
  const token = await new AzureCliCredential({
    tenantId: config.tenantId,
    subscription: config.subscriptionId,
  }).getToken(`${api.identifierUris[0]}/.default`);
  if (!token) throw new Error("Coordinator API token unavailable");
  for (const path of ["/readyz", "/v1/workspace", "/v1/workspace/audit"]) {
    const response = await fetch(`${frontendValues.NEXT_PUBLIC_WARD_API_BASE_URL}${path}`, {
      headers: { authorization: `Bearer ${token.token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Authenticated Azure verification failed at ${path}: HTTP ${response.status}`);
    const value = await response.json();
    if (path === "/v1/workspace" && (value.role !== "coordinator" || value.workspaceId !== config.workspaceId))
      throw new Error("Shared workspace or role mismatch");
    console.log(`${path}: HTTP 200${value.snapshot ? `, shared revision ${value.snapshot.revision}` : ""}`);
  }
  process.exit(0);
}
await writeFile(
  new URL("frontend.env", output),
  Object.entries(frontendValues)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
);
const settings = {
  WARD_SHARED_ENABLED: "true",
  WARD_COORDINATOR_OBJECT_IDS: config.coordinatorObjectIds.join(","),
  WARD_WORKSPACE_ID: config.workspaceId,
  WARD_PG_RESOURCE_ID: server.id,
  WARD_PG_HOST: server.fullyQualifiedDomainName,
  WARD_PG_DATABASE: "wardflow",
  WARD_PG_USER: "wardflow_backend",
  WARD_ALLOWED_ORIGIN: config.frontendOrigin,
};
await writeFile(
  new URL("backend.env", output),
  Object.entries({
    ...settings,
    AZURE_TENANT_ID: config.tenantId,
    WARD_ALLOWED_OBJECT_ID: config.coordinatorObjectIds[0],
    WARD_API_AUDIENCE: apiClientId,
    AzureWebJobsStorage__accountName: "wflowdev7273a083aue",
    WARD_MIGRATION_ADMIN_NAME: config.administratorName,
    WARD_BACKEND_OBJECT_ID: app.identity.principalId,
  })
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n",
);
console.log(
  "Non-secret frontend/backend settings prepared under backend/ward-flow/dist/setup. Apply the migration from an authorised host with private database reachability before enabling shared mode.",
);
if (mode !== "configure") process.exit(0);

const authUri = `https://management.azure.com${app.id}/config/authsettingsV2?api-version=2024-04-01`;
const hostAuth = az(["rest", "--method", "get", "--uri", authUri]);
const aad = hostAuth.properties?.identityProviders?.azureActiveDirectory;
if (
  !hostAuth.properties?.platform?.enabled ||
  !hostAuth.properties?.globalValidation?.requireAuthentication ||
  aad?.registration?.clientId !== apiClientId
)
  throw new Error(
    "Verify the existing Function host's enforced Ward Flow Entra authentication before enabling shared mode",
  );
const backendSettings = az([
  "functionapp",
  "config",
  "appsettings",
  "list",
  "--resource-group",
  config.resourceGroup,
  "--name",
  config.functionName,
  "--query",
  "[?name=='AZURE_TENANT_ID' || name=='WARD_API_AUDIENCE' || name=='AzureWebJobsStorage__accountName'].{name:name,value:value}",
]);
const currentSettings = Object.fromEntries(backendSettings.map((row) => [row.name, row.value]));
if (
  currentSettings.AZURE_TENANT_ID?.toLowerCase() !== config.tenantId.toLowerCase() ||
  currentSettings.WARD_API_AUDIENCE !== apiClientId ||
  currentSettings.AzureWebJobsStorage__accountName !== "wflowdev7273a083aue"
)
  throw new Error("Function application settings do not match the verified Ward Flow identity and storage account");

const targetSubnet = config.functionSubnetId || app.virtualNetworkSubnetId;
if (!targetSubnet)
  throw new Error("Set the verified Function subnet ID before configuring the private database connection");
const dbVnet = server.network.delegatedSubnetResourceId?.split("/subnets/")[0];
if (!dbVnet || targetSubnet.split("/subnets/")[0].toLowerCase() !== dbVnet.toLowerCase())
  throw new Error("Function and database networks differ; verify a reviewed private connection before configuration");
if (app.virtualNetworkSubnetId && app.virtualNetworkSubnetId.toLowerCase() !== targetSubnet.toLowerCase())
  throw new Error(
    "Existing Function network integration was preserved; a network change needs a separate reviewed plan",
  );
const databases = az([
  "postgres",
  "flexible-server",
  "db",
  "list",
  "--resource-group",
  config.resourceGroup,
  "--server-name",
  server.name,
]);
const wardflowDatabase = databases.find((row) => row.name === "wardflow");
if (!wardflowDatabase)
  az(
    [
      "postgres",
      "flexible-server",
      "db",
      "create",
      "--resource-group",
      config.resourceGroup,
      "--server-name",
      server.name,
      "--database-name",
      "wardflow",
      "--charset",
      "UTF8",
      "--collation",
      "en_US.utf8",
    ],
    false,
  );
else if (wardflowDatabase.charset !== "UTF8")
  throw new Error("Existing Ward Flow database encoding differs; no database was replaced");
const pg = await import("./postgres.mjs");
const { migrate, grantBackend } = await import("./migrate.mjs");
const pool = pg.createPostgresPool({
  host: server.fullyQualifiedDomainName,
  database: "wardflow",
  user: config.administratorName,
});
try {
  await migrate(pool);
  const connection = await pool.connect();
  try {
    await grantBackend(connection, app.identity.principalId);
  } finally {
    connection.release();
  }
} finally {
  await pool.end();
}
if (!app.virtualNetworkSubnetId)
  az(
    [
      "functionapp",
      "vnet-integration",
      "add",
      "--resource-group",
      config.resourceGroup,
      "--name",
      config.functionName,
      "--vnet",
      dbVnet,
      "--subnet",
      targetSubnet,
    ],
    false,
  );
const redirects = [...new Set([...(frontend.spa?.redirectUris ?? []), redirect])];
directory([
  "ad",
  "app",
  "update",
  "--id",
  config.frontendClientId,
  "--set",
  `spa.redirectUris=${JSON.stringify(redirects)}`,
]);
const policy = aad.validation?.defaultAuthorizationPolicy;
if (policy?.allowedPrincipals?.identities?.length) {
  policy.allowedPrincipals.identities = [
    ...new Set([...policy.allowedPrincipals.identities, ...config.coordinatorObjectIds]),
  ];
  const hostAuthPath = fileURLToPath(new URL("host-auth.json", output));
  await writeFile(hostAuthPath, JSON.stringify({ properties: hostAuth.properties }));
  az(["rest", "--method", "put", "--uri", authUri, "--body", `@${hostAuthPath}`], false);
}
az(
  [
    "functionapp",
    "cors",
    "add",
    "--resource-group",
    config.resourceGroup,
    "--name",
    config.functionName,
    "--allowed-origins",
    config.frontendOrigin,
  ],
  false,
);
az(
  [
    "functionapp",
    "config",
    "appsettings",
    "set",
    "--resource-group",
    config.resourceGroup,
    "--name",
    config.functionName,
    "--settings",
    ...Object.entries(settings).map(([key, value]) => `${key}=${value}`),
  ],
  false,
);
console.log(
  "Ward Flow database migration, managed-identity grants and shared backend settings applied. Deploy the backend package and rebuild the frontend with the prepared public settings, then run the authenticated smoke test.",
);
