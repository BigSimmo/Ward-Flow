import { createHash } from "node:crypto";
import { Pool } from "pg";
import { DefaultAzureCredential } from "@azure/identity";

export function createPostgresPool(config, credential = new DefaultAzureCredential()) {
  const pool = new Pool({
    host: config.host,
    database: config.database,
    user: config.user,
    port: 5432,
    password: async () => {
      const token = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default");
      if (!token) throw new Error("Database identity unavailable");
      return token.token;
    },
    ssl: { rejectUnauthorized: true },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
  });
  pool.on("error", () => {
    console.error("Ward Flow database connection unavailable");
  });
  return pool;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

export function createWorkspaceStore(pool, { workspaceId, engine, clock = () => new Date() }) {
  const snapshot = (row, at) => ({
    dataMode: row.data_mode,
    revision: Number(row.revision),
    payload: row.payload,
    now: engine.worldNow(row.payload, at),
  });
  async function transaction(run) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client, clock());
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async function lock(client, actorId, at) {
    const created = await client.query(
      "INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, $2) ON CONFLICT DO NOTHING RETURNING id",
      [workspaceId, engine.seedWorld(at)],
    );
    if (created.rowCount)
      await client.query(
        "INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ($1, $2, 'INITIALISE_WORKSPACE', 'accepted', 0, 1, '{}')",
        [workspaceId, actorId],
      );
    const { rows } = await client.query(
      "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
      [workspaceId],
    );
    if (rows[0]?.data_mode !== "prototype") throw new Error("Workspace data mode mismatch");
    if (!engine.validWorld(rows[0]?.payload)) throw new Error("Stored workspace is incompatible");
    return rows[0];
  }
  return {
    async ready() {
      const { rows } = await pool.query("SELECT version FROM ward_flow.migrations WHERE version=2");
      if (!rows.length) throw new Error("Shared schema unavailable");
    },
    async read(actorId) {
      const at = clock();
      const { rows } = await pool.query(
        "SELECT data_mode, revision, payload FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype'",
        [workspaceId],
      );
      if (rows[0] && engine.validWorld(rows[0].payload)) return snapshot(rows[0], at);
      return transaction(async (client, now) => snapshot(await lock(client, actorId, now), now));
    },
    async audit() {
      const { rows } = await pool.query(
        "SELECT sequence, actor_id, actor_role, data_mode, action, outcome, prior_revision, revision, changes, committed_at FROM ward_flow.audit WHERE workspace_id=$1 AND data_mode='prototype' ORDER BY sequence DESC LIMIT 200",
        [workspaceId],
      );
      return rows;
    },
    async command(actorId, commandId, expectedRevision, event) {
      if (!engine.validCommand(event)) throw new Error("invalid-command");
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(canonical({ expectedRevision, event })))
        .digest("hex");
      return transaction(async (client, at) => {
        const row = await lock(client, actorId, at);
        const previous = await client.query(
          "SELECT fingerprint, status, result FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
          [workspaceId, actorId, commandId],
        );
        if (previous.rowCount) {
          const receipt = previous.rows[0];
          if (receipt.fingerprint !== fingerprint)
            return {
              status: 422,
              body: { error: "Command ID was already used for a different request", snapshot: snapshot(row, at) },
            };
          return { status: receipt.status, body: { ...receipt.result, replayed: true, snapshot: snapshot(row, at) } };
        }
        let outcome = "stale";
        let status = 409;
        let changes = {};
        let reason = "The workspace changed. Review the latest board before trying again.";
        const priorRevision = Number(row.revision);
        if (priorRevision === expectedRevision) {
          const applied = engine.applyCommand(row.payload, event, at);
          ({ outcome, changes, reason } = applied);
          status = outcome === "accepted" ? 200 : 422;
          if (outcome === "accepted") {
            row.revision = priorRevision + 1;
            row.payload = applied.world;
            await client.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3, updated_at=$4 WHERE id=$1", [
              workspaceId,
              row.revision,
              row.payload,
              at,
            ]);
          }
        }
        const result = { outcome, commandRevision: Number(row.revision), ...(reason ? { error: reason } : {}) };
        await client.query(
          "INSERT INTO ward_flow.audit(workspace_id, actor_id, command_id, action, outcome, prior_revision, revision, changes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [workspaceId, actorId, commandId, event.type, outcome, priorRevision, row.revision, changes],
        );
        await client.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result) VALUES ($1,$2,$3,$4,$5,$6)",
          [workspaceId, actorId, commandId, fingerprint, status, result],
        );
        return { status, body: { ...result, snapshot: snapshot(row, at) } };
      });
    },
  };
}
