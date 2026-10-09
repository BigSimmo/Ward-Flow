import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm, mkdir, copyFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const subscriptionId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const objectId = "33333333-3333-4333-8333-333333333333";
const settings = {
  dataMode: "prototype",
  subscriptionId,
  tenantId,
  coordinatorObjectIds: [objectId],
  resourceGroup: "rg-wardflow-dev-aue",
  functionName: "wardflow-dev-api-aue",
  frontendClientId: "9b7b160d-9bc7-4712-b748-17ff3e70b706",
  frontendOrigin: "https://ward.example.test",
  administratorObjectId: objectId,
  administratorName: "synthetic-admin",
  workspaceId: "44444444-4444-4444-8444-444444444444",
};
const server = {
  name: "already-existing-ward-db",
  fullyQualifiedDomainName: "already-existing-ward-db.postgres.database.azure.com",
  id: `/subscriptions/${subscriptionId}/resourceGroups/rg-wardflow-dev-aue/providers/Microsoft.DBforPostgreSQL/flexibleServers/already-existing-ward-db`,
  location: "Australia East",
  network: { publicNetworkAccess: "Disabled" },
  authConfig: { activeDirectoryAuth: "Enabled", passwordAuth: "Disabled" },
};

async function run(
  mode,
  {
    config = {},
    servers = [server],
    databases = [{ name: "wardflow" }],
    account = {},
    app = {},
    extraResponses = {},
  } = {},
) {
  const folder = await mkdtemp(join(tmpdir(), "ward-flow-azure-setup-test-"));
  try {
    const backendRoot = fileURLToPath(new URL("./", import.meta.url));
    const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: backendRoot, encoding: "utf8" });
    for (const path of trackedFiles.split("\0").filter(Boolean)) {
      const destination = join(folder, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(backendRoot, path), destination);
    }
    await symlink(join(backendRoot, "node_modules"), join(folder, "node_modules"), "junction");
    await writeFile(join(folder, "settings.json"), JSON.stringify({ ...settings, ...config }));
    const responses = {
      "account show": { id: subscriptionId, tenantId, ...account },
      "group show": { name: settings.resourceGroup },
      "functionapp show": {
        name: settings.functionName,
        location: "Australia East",
        defaultHostName: "wardflow-dev-api-aue.azurewebsites.net",
        identity: { principalId: objectId, tenantId },
        ...app,
      },
      "postgres flexible-server list": servers,
      "postgres flexible-server db list": databases,
      "network vnet list": [],
      "ad app show": {
        api: {
          requestedAccessTokenVersion: 2,
          oauth2PermissionScopes: [{ value: "WardFlow.Access", isEnabled: true }],
        },
        identifierUris: [`api://${settings.frontendClientId}`],
      },
      ...extraResponses,
    };
    await writeFile(join(folder, "responses.json"), JSON.stringify(responses));
    const executable = join(folder, "az");
    await writeFile(
      executable,
      `#!${process.execPath}\nimport fs from 'node:fs';\nconst args=process.argv.slice(2);\nfs.appendFileSync(${JSON.stringify(join(folder, "calls.jsonl"))},JSON.stringify(args)+'\\n');\nconst responses=JSON.parse(fs.readFileSync(${JSON.stringify(join(folder, "responses.json"))},'utf8'));\nconst key=Object.keys(responses).find(key=>args.slice(0,key.split(' ').length).join(' ')===key);\nif(!key) process.exit(2);\nif(key==='deployment group create'){\nconst index=args.indexOf('--template-file');\nif(index<0 || !args[index+1] || !fs.statSync(args[index+1]).isFile()) process.exit(2);\n}\nprocess.stdout.write(JSON.stringify(responses[key]));\n`,
    );
    await chmod(executable, 0o700);
    const result = spawnSync(process.execPath, [join(folder, "azure-setup.mjs"), mode, join(folder, "settings.json")], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${folder}:${process.env.PATH}` },
    });
    const log = await readFile(join(folder, "calls.jsonl"), "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const calls = log.trim() ? log.trim().split("\n").map(JSON.parse) : [];
    let frontend = "";
    let backend = "";
    try {
      frontend = await readFile(join(folder, "dist/setup/frontend.env"), "utf8");
      backend = await readFile(join(folder, "dist/setup/backend.env"), "utf8");
    } catch {}
    return { ...result, calls, frontend, backend };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

test("Azure inspection accepts unset role placeholders and makes only inventory reads", async () => {
  const result = await run("inspect", {
    config: { coordinatorObjectIds: ["REPLACE"], administratorObjectId: "REPLACE" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already-existing-ward-db/);
  assert.equal(result.calls.length, 5);
});
test("setup refuses live mode before contacting Azure", async () => {
  const result = await run("provision", { config: { dataMode: "live" } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Live data mode is not commissioned/);
  assert.equal(result.calls.length, 0);
});
test("Azure provisioning reuses an existing database server without creating resources", async () => {
  const result = await run("provision");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.frontend, /NEXT_PUBLIC_WARD_SHARED_ENABLED=true/);
  const host = JSON.parse(await readFile(new URL("./host.json", import.meta.url), "utf8"));
  const prefix = host.extensions.http.routePrefix;
  const expectedBase = `https://wardflow-dev-api-aue.azurewebsites.net${prefix ? `/${prefix}` : ""}`;
  assert.equal(
    result.frontend.split("\n").find((line) => line.startsWith("NEXT_PUBLIC_WARD_API_BASE_URL=")),
    `NEXT_PUBLIC_WARD_API_BASE_URL=${expectedBase}`,
  );
  assert.ok(result.calls.every((args) => args.includes("show") || args.includes("list")));
});
test("Azure provisioning deploys a new private Entra-only Australian database server", async () => {
  const serverName = "wardflow-dev-pg-aue";
  const provisioned = {
    ...server,
    name: serverName,
    fullyQualifiedDomainName: `${serverName}.postgres.database.azure.com`,
    id: server.id.replace(server.name, serverName),
  };
  const result = await run("provision", {
    config: { requireExistingDatabase: false, serverName, databaseName: "wardflow" },
    servers: [],
    extraResponses: {
      "deployment group create": {
        properties: { outputs: { functionSubnetId: { value: "/synthetic/network/subnets/functions" } } },
      },
      "postgres flexible-server show": provisioned,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const deployments = result.calls.filter((args) => args.slice(0, 3).join(" ") === "deployment group create");
  assert.equal(deployments.length, 1);
  const deployment = deployments[0];
  assert.equal(deployment[deployment.indexOf("--resource-group") + 1], settings.resourceGroup);
  assert.equal(deployment[deployment.indexOf("--name") + 1], "wardflow-shared-database");
  assert.deepEqual(deployment.slice(deployment.indexOf("--parameters") + 1, deployment.indexOf("--subscription")), [
    `serverName=${serverName}`,
    `tenantId=${tenantId}`,
    `administratorObjectId=${objectId}`,
    `administratorName=${settings.administratorName}`,
    "administratorType=User",
    "location=australiaeast",
  ]);
  const shows = result.calls.filter((args) => args.slice(0, 3).join(" ") === "postgres flexible-server show");
  assert.equal(shows.length, 1);
  assert.equal(shows[0][shows[0].indexOf("--name") + 1], serverName);
  assert.equal(shows[0][shows[0].indexOf("--resource-group") + 1], settings.resourceGroup);
  assert.ok(result.backend.includes(`WARD_PG_RESOURCE_ID=${provisioned.id}\n`));
  assert.ok(result.backend.includes(`WARD_PG_HOST=${provisioned.fullyQualifiedDomainName}\n`));
  assert.match(result.backend, /WARD_PG_DATABASE=wardflow\n/);
});
test("ambiguous Azure inventory requires an explicit existing server", async () => {
  const result = await run("provision", { servers: [server, { ...server, name: "another-db" }] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Several PostgreSQL servers exist/);
  assert.equal(result.calls.length, 5);
});
test("an unsuitable existing database is preserved instead of replaced", async () => {
  const result = await run("provision", { servers: [{ ...server, network: { publicNetworkAccess: "Enabled" } }] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Existing settings were preserved/);
  assert.equal(result.calls.length, 5);
});
test("Azure subscription mismatch fails before reading project resources", async () => {
  const result = await run("inspect", { account: { id: objectId } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /subscription\/tenant mismatch/);
  assert.equal(result.calls.length, 1);
});
test("an existing Function network is preserved before new provisioning", async () => {
  const result = await run("provision", {
    config: { requireExistingDatabase: false },
    servers: [],
    app: { virtualNetworkSubnetId: "/existing/network/subnets/functions" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /existing Function has network integration/);
  assert.equal(result.calls.length, 5);
});

test("setup targets the existing wardflow_dev database without creating a duplicate", async () => {
  const existing = {
    ...server,
    name: "wardflow-dev-aue",
    fullyQualifiedDomainName: "wardflow-dev-aue.postgres.database.azure.com",
    id: server.id.replace("already-existing-ward-db", "wardflow-dev-aue"),
  };
  const result = await run("provision", {
    config: { serverName: existing.name, databaseName: "wardflow_dev" },
    servers: [existing],
    databases: [{ name: "wardflow_dev" }],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.backend, /WARD_PG_DATABASE=wardflow_dev\n/);
  assert.ok(result.calls.every((args) => args.includes("show") || args.includes("list")));
  const wrong = await run("provision", {
    config: { serverName: existing.name, databaseName: "wardflow" },
    servers: [existing],
  });
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /Unapproved Ward Flow database target/);
  assert.ok(wrong.calls.every((args) => args.includes("show") || args.includes("list")));
});

test("missing server or database stops setup instead of creating resources", async () => {
  for (const inventory of [{ servers: [] }, { databases: [] }]) {
    const result = await run("provision", inventory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Existing database/);
    assert.equal(result.backend, "");
    assert.ok(result.calls.every((args) => args.includes("show") || args.includes("list")));
  }
});
