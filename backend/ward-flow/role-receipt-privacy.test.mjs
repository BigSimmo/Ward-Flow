// @ts-check
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { recordToken } from "./records.mjs";
import { createHandler, listen } from "./server.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const databaseUrl = process.env.WARD_TEST_DATABASE_URL;
const SAFE_PARTIAL_RECEIPT =
  "Part of this change was saved. The remaining details are unavailable in your current role.";
if (databaseUrl && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Receipt privacy tests require an isolated loopback PostgreSQL server");

test(
  "real PostgreSQL: replay drops a generated booking token after the booking leaves the same desk",
  {
    skip: !databaseUrl,
    timeout: 30_000,
  },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const workspaceId = randomUUID();
    const administrator = randomUUID();
    const actor = randomUUID();
    const at = new Date();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at), log: () => {} });
    try {
      await migrate(pool);
      const lead = await store.viewer(administrator, { bootstrap: true });
      const seed = await store.read(administrator, lead);
      const grant = await store.grantAccess(lead, {
        actorId: actor,
        role: "coordinator",
        scope: { kind: "service", service: "South Metro" },
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      assert.equal(grant.status, 200);
      const view = await store.viewer(actor, { workingAs: grant.body.membership.id });
      const event = {
        type: "BOOK_PLANNED_ADMISSION",
        role: "coordinator",
        initials: "AB",
        sex: "Female",
        gender: "Female",
        reason: "respite",
        unitId: "fre-adult-open",
        expectedArrivalAt: seed.now + 1440,
        expectedStayDays: 7,
        legalStatus: "Voluntary",
        ageBand: "Adult",
      };
      const commandId = randomUUID();
      const saved = await store.command(actor, commandId, seed.revision, event, { view });
      assert.equal(saved.status, 200);
      assert.equal(Object.hasOwn(saved.body, "undoStep"), false, "Booking creates no Undo step metadata");
      const booking = saved.body.snapshot.payload.state.plannedAdmissions.find(
        (row) => !seed.payload.state.plannedAdmissions.some((prior) => prior.id === row.id),
      );
      assert.equal(Boolean(booking), true, "The real command must create the generated booking");
      const bookingToken = recordToken(`plannedAdmissions/${booking.id}`);
      const ownWardToken = recordToken(`units/${event.unitId}`);
      assert.equal(saved.body.covered.includes(bookingToken), true);
      assert.equal(saved.body.covered.includes(ownWardToken), true);
      const unchanged = await store.command(actor, commandId, seed.revision, event, { view, revisionOnly: true });
      assert.deepEqual(unchanged.body.covered, saved.body.covered, "Unaffected same-desk tokens remain intact");
      assert.equal(Object.hasOwn(unchanged.body, "snapshot"), false, "An unchanged authorised retry stays lean");
      const moved = await store.command(
        administrator,
        randomUUID(),
        saved.body.commandRevision,
        {
          type: "CHANGE_PLANNED_ADMISSION",
          role: "coordinator",
          plannedAdmissionId: booking.id,
          reason: booking.reason,
          unitId: "scgh-adult-open",
          expectedArrivalAt: booking.expectedArrivalAt,
          expectedStayDays: booking.expectedStayDays,
          legalStatus: booking.legalStatus,
        },
        { view: lead },
      );
      assert.equal(moved.status, 200, "The statewide coordinator must genuinely move the booking");
      assert.equal(engine.validWorld(moved.body.snapshot.payload), true);
      const current = await store.read(actor, view);
      assert.equal(current.accessContext, saved.body.snapshot.accessContext, "Membership, scope and grants stay equal");
      assert.equal(
        current.payload.state.plannedAdmissions.some((row) => row.id === booking.id),
        false,
      );
      assert.equal(
        engine.commandRefusal(moved.body.snapshot.payload, view.access, event, at, view.grants),
        null,
        "The original creation request still names only the desk's own ward",
      );
      const replay = await store.command(actor, commandId, seed.revision, event, { view, revisionOnly: true });
      assert.equal(replay.status, 200);
      assert.equal(replay.body.outcome, saved.body.outcome);
      assert.equal(replay.body.commandRevision, saved.body.commandRevision);
      assert.equal(replay.body.replayed, true);
      assert.equal(
        Object.hasOwn(replay.body, "snapshot"),
        false,
        "Token projection preserves the existing lean response",
      );
      assert.equal(replay.body.covered.includes(ownWardToken), true, "The still-visible ward token is retained");
      assert.equal(
        replay.body.covered.includes(bookingToken),
        false,
        "The now-hidden generated booking token is withheld",
      );
      const counts = await pool.query(
        "SELECT (SELECT count(*)::int FROM ward_flow.commands WHERE workspace_id=$1 AND command_id=$2) AS receipts, (SELECT count(*)::int FROM ward_flow.audit WHERE workspace_id=$1 AND command_id=$2) AS audit",
        [workspaceId, commandId],
      );
      assert.deepEqual(counts.rows[0], { receipts: 1, audit: 1 }, "Both replays use the single original execution");
      assert.equal((await store.read(administrator, lead)).revision, moved.body.commandRevision);
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: receipt replay respects the current role",
  { skip: !databaseUrl, timeout: 30_000 },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const workspaceId = randomUUID();
    const administrator = randomUUID();
    const actor = randomUUID();
    const at = new Date();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at), log: () => {} });
    const config = {
      workspaceId,
      coordinatorIds: [administrator, actor],
      origin: null,
      host: "127.0.0.1",
      port: 0,
      dataMode: "prototype",
      supabase: {
        projectRef: APPROVED_SUPABASE_PROJECT,
        url: APPROVED_SUPABASE_URL,
        publishableKey: "synthetic-offline-only",
      },
    };
    const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const signedParts = `${part({ alg: "ES256", kid: "receipt-privacy-local", typ: "JWT" })}.${part({
      sub: actor,
      iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
      aud: "authenticated",
      role: "authenticated",
      iat: Math.floor(at.getTime() / 1000),
      exp: Math.floor(at.getTime() / 1000) + 3600,
      amr: [{ method: "password", timestamp: Math.floor(at.getTime() / 1000) }],
      session_id: randomUUID(),
    })}`;
    const token = `Bearer ${signedParts}.${sign("sha256", Buffer.from(signedParts), {
      key: key.privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url")}`;
    let publicKeyReads = 0;
    const authenticate = createSupabaseAuthenticator(config, {
      now: () => at.getTime(),
      fetch: async (endpoint) => {
        assert.equal(
          endpoint === `${APPROVED_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
          true,
          "Only the supplied public-key fixture may be requested",
        );
        publicKeyReads++;
        return Response.json({
          keys: [
            { ...key.publicKey.export({ format: "jwk" }), kid: "receipt-privacy-local", alg: "ES256", use: "sig" },
          ],
        });
      },
    });
    /** @type {ReturnType<typeof listen> | undefined} */
    let server;
    try {
      await migrate(pool);
      const administratorView = await store.viewer(administrator, { bootstrap: true });
      const seed = await store.read(administrator, administratorView);
      assert.equal(engine.validWorld(seed.payload), true, "The unmodified seed must be valid");
      const stay = seed.payload.state.admissions.find((row) => row.patientId !== null && row.leftAt === null);
      assert.equal(Boolean(stay), true, "An occupied ward is required for the narrow role");
      const grant = await store.grantAccess(administratorView, {
        actorId: actor,
        role: "ward",
        scope: { kind: "ward", unitIds: [stay.unitId] },
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      assert.equal(grant.status, 200, "A separate administrator must grant the narrow role");
      const membershipId = grant.body.membership.id;
      server = listen(createHandler({ config, sharedStore: store, authenticate, log: () => {} }), config);
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Owned HTTP listener has no TCP address");
      const base = `http://127.0.0.1:${address.port}/v1/workspace`;
      const request = (workingAs, /** @type {unknown} */ body = undefined) =>
        fetch(body ? `${base}/commands` : base, {
          method: body ? "POST" : "GET",
          headers: {
            authorization: token,
            "x-ward-working-as": workingAs,
            ...(body ? { "content-type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      const narrowRead = await request(membershipId);
      assert.equal(narrowRead.status, 200, "The signed account must be able to work as its ward role");
      const narrow = await narrowRead.json();
      const target = seed.payload.state.movements.find(
        (movement) =>
          movement.closure && !narrow.snapshot.payload.state.movements.some((shown) => shown.id === movement.id),
      );
      assert.equal(Boolean(target?.closure), true, "A closed movement outside the narrow role is required");
      const commandId = randomUUID();
      const body = {
        classification: "synthetic",
        commandId,
        expectedRevision: seed.revision,
        event: {
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now: seed.now,
          movementId: target.id,
          urgency: 2,
          reason: "reassessed",
        },
      };
      const broadResponse = await request("bootstrap", body);
      assert.equal(broadResponse.status, 422, "The broad role must receive the real domain refusal");
      const broad = await broadResponse.json();
      assert.equal(Object.hasOwn(broad, "receiptAccessContext"), false, "Receipt provenance stays server-side");
      const reachedPrivateRefusal =
        typeof broad.error === "string" &&
        broad.error.includes("closed movement") &&
        broad.error.includes(target.closure.reason);
      assert.equal(reachedPrivateRefusal, true, "The broad refusal must describe the real closed record");
      const stored = await pool.query(
        "SELECT result, status FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
        [workspaceId, actor, commandId],
      );
      assert.equal(stored.rowCount, 1, "The public command path must create exactly one real receipt");
      assert.equal(
        stored.rows[0].result.error === broad.error,
        true,
        "The real receipt must hold the original refusal",
      );
      const stillBroadResponse = await request("bootstrap", body);
      assert.equal(stillBroadResponse.status, broadResponse.status);
      const stillBroad = await stillBroadResponse.json();
      assert.deepEqual(
        { ...stillBroad, replayed: undefined },
        { ...broad, replayed: undefined },
        "The unchanged authorised desk retains its original refusal details",
      );

      const freshResponse = await request(membershipId, { ...body, commandId: randomUUID() });
      assert.equal(freshResponse.status, 422);
      const fresh = await freshResponse.json();
      assert.equal(
        fresh.code === "scope" && fresh.error !== broad.error,
        true,
        "A new command must apply the narrow role",
      );
      const replayResponse = await request(membershipId, body);
      assert.equal(replayResponse.status, 422);
      const replay = await replayResponse.json();
      assert.equal(replay.replayed, true, "The original command must be recognised without reapplying it");
      assert.equal(replay.outcome, broad.outcome, "Access narrowing must not rewrite the original outcome");
      assert.equal(replay.commandRevision, broad.commandRevision);
      assert.equal(Object.hasOwn(replay, "receiptAccessContext"), false);
      for (const reply of [fresh, replay]) {
        assert.equal(
          reply.snapshot.payload.state.movements.some((shown) => shown.id === target.id),
          false,
          "The current narrow snapshot must omit the protected movement",
        );
        assert.equal(reply.snapshot.revision, seed.revision, "Neither the refusal nor replay may alter clinical state");
      }
      const counts = await pool.query(
        "SELECT (SELECT count(*)::int FROM ward_flow.commands WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3) AS receipts, (SELECT count(*)::int FROM ward_flow.audit WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3) AS audit",
        [workspaceId, actor, commandId],
      );
      assert.deepEqual(
        counts.rows[0],
        { receipts: 1, audit: 1 },
        "Replay must neither reapply nor create another receipt",
      );
      assert.equal(publicKeyReads, 1, "Authentication uses only the supplied local public key");
      const disclosedPriorRefusal = replay.error === broad.error;
      t.diagnostic(
        JSON.stringify({
          realDatabaseAndHttp: true,
          genuineStoredReceipt: true,
          freshCommandNarrowlyRefused: true,
          narrowSnapshotsProtected: true,
          replayDidNotReapply: true,
          disclosedPriorBroaderRefusal: disclosedPriorRefusal,
          publicKeyFixtureReads: publicKeyReads,
          providerRequests: 0,
        }),
      );
      assert.equal(disclosedPriorRefusal, false, "A replay must not disclose a prior broader-role record refusal");
    } finally {
      if (server) {
        server.closeAllConnections();
        const owned = server;
        await /** @type {Promise<void>} */ (
          new Promise((resolve, reject) => owned.close((error) => (error ? reject(error) : resolve())))
        );
      }
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: accepted partial receipt preserves the saved outcome without wider metadata",
  {
    skip: !databaseUrl,
    timeout: 30_000,
  },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const workspaceId = randomUUID();
    const administrator = randomUUID();
    const actor = randomUUID();
    let at = new Date();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at), log: () => {} });
    try {
      await migrate(pool);
      const lead = await store.viewer(administrator, { bootstrap: true });
      const broad = await store.viewer(actor, { bootstrap: true });
      const seed = await store.read(actor, broad);
      // Reuse the real domain's established partial-referral fixture: one suitable ward and one
      // incompatible cohort. Only these existing synthetic records change before the command.
      const incompatible = seed.payload.state.units.find((unit) => unit.cohort !== "Adult").cohort;
      assert.equal(
        (
          await pool.query(
            "UPDATE ward_flow.workspace_records SET body=jsonb_set(body,'{gender}','\"Male\"') WHERE workspace_id=$1 AND collection='movements' AND record_id='WF-009'",
            [workspaceId],
          )
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "UPDATE ward_flow.workspace_records SET body=jsonb_set(body,'{cohort}',$2::jsonb) WHERE workspace_id=$1 AND collection='units' AND record_id='fsh-adult-secure'",
            [workspaceId, JSON.stringify(incompatible)],
          )
        ).rowCount,
        1,
      );
      const prepared = await store.read(actor, broad);
      assert.equal(engine.validWorld(prepared.payload), true);
      const granted = await store.grantAccess(lead, {
        actorId: actor,
        role: "coordinator",
        scope: { kind: "service", service: "East Metro" },
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      assert.equal(granted.status, 200);
      const commandId = randomUUID();
      const event = {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        movementId: "WF-009",
        unitIds: ["rph-adult-secure", "fsh-adult-secure"],
      };
      const saved = await store.command(actor, commandId, prepared.revision, event, { view: broad });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.outcome, "partly");
      const refusedWard = prepared.payload.state.units.find((unit) => unit.id === "fsh-adult-secure");
      assert.equal(saved.body.error.includes(refusedWard.name), true, "The genuine partial reason names the held ward");
      assert.equal(Boolean(saved.body.undoStep), true, "The genuine command produces Undo completion metadata");
      assert.equal(saved.body.covered.length > 0, true, "The real record store produces checked record tokens");
      assert.equal(Object.hasOwn(saved.body, "receiptAccessContext"), false);
      at = new Date(at.getTime() + 60_000);
      const same = await store.command(actor, commandId, prepared.revision, event, { view: broad, revisionOnly: true });
      const { snapshot: savedSnapshot, ...savedResult } = saved.body;
      assert.equal(savedSnapshot.revision, saved.body.commandRevision);
      assert.deepEqual(
        same,
        { status: 200, body: { ...savedResult, replayed: true } },
        "Clock and revision retain the authorised metadata and existing lean retry contract",
      );
      assert.equal(Object.hasOwn(same.body, "snapshot"), false);
      const narrow = await store.viewer(actor, { workingAs: granted.body.membership.id });
      const replay = await store.command(actor, commandId, prepared.revision, event, {
        view: narrow,
        revisionOnly: true,
      });
      assert.equal(replay.status, 200, "An earlier applied command remains applied after access narrows");
      assert.equal(replay.body.outcome, "partly");
      assert.equal(replay.body.error, SAFE_PARTIAL_RECEIPT, "The partial save stays explicit without its wider reason");
      assert.deepEqual(Object.keys(replay.body).sort(), [
        "commandRevision",
        "error",
        "outcome",
        "replayed",
        "snapshot",
      ]);
      assert.equal(replay.body.commandRevision, saved.body.commandRevision);
      assert.equal(
        replay.body.snapshot.payload.state.movements.some((row) => row.id === event.movementId),
        true,
        "The command target remains visible even though its prior related metadata is withheld",
      );
      assert.equal(replay.body.snapshot.revision, saved.body.commandRevision);
      // A genuine pre-upgrade receipt has the same domain result, without the new provenance.
      await pool.query(
        "UPDATE ward_flow.commands SET result=result - 'receiptAccessContext' WHERE workspace_id=$1 AND actor_id=$2 AND command_id=$3",
        [workspaceId, actor, commandId],
      );
      const legacy = await store.command(actor, commandId, prepared.revision, event, { view: broad });
      assert.equal(legacy.status, 200);
      assert.equal(legacy.body.outcome, saved.body.outcome);
      assert.equal(legacy.body.commandRevision, saved.body.commandRevision);
      assert.equal(legacy.body.error, SAFE_PARTIAL_RECEIPT, "A same-role legacy retry retains a safe partial warning");
      assert.deepEqual(
        Object.keys(legacy.body).sort(),
        ["commandRevision", "error", "outcome", "replayed", "snapshot"],
        "Unknown legacy provenance cannot release any old reason, completion or record tokens",
      );
      const counts = await pool.query(
        "SELECT (SELECT count(*)::int FROM ward_flow.commands WHERE workspace_id=$1 AND command_id=$2) AS receipts, (SELECT count(*)::int FROM ward_flow.audit WHERE workspace_id=$1 AND command_id=$2) AS audit",
        [workspaceId, commandId],
      );
      assert.deepEqual(counts.rows[0], { receipts: 1, audit: 1 });
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: cover revocation and record-opening expiry withhold old metadata for an allowed target",
  {
    skip: !databaseUrl,
    timeout: 30_000,
  },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const workspaceId = randomUUID();
    const administrator = randomUUID();
    const actor = randomUUID();
    let at = new Date();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at), log: () => {} });
    try {
      await migrate(pool);
      const lead = await store.viewer(administrator, { bootstrap: true });
      const seed = await store.read(administrator, lead);
      const [unitA, unitB] = seed.payload.state.units.map((unit) => unit.id);
      const grant = await store.grantAccess(lead, {
        actorId: actor,
        role: "ward",
        scope: { kind: "ward", unitIds: [unitA] },
        expiresAt: new Date(at.getTime() + 86_400_000),
      });
      assert.equal(grant.status, 200);
      const cover = await store.giveCover(lead, {
        actorId: actor,
        scope: { kind: "ward", unitIds: [unitB] },
        minutes: 60,
      });
      assert.equal(cover.status, 200);
      const view = await store.viewer(actor, { workingAs: grant.body.membership.id });
      const confirm = (snapshot) => {
        const unit = snapshot.payload.state.units.find((row) => row.id === unitA);
        return {
          type: "CONFIRM_CAPACITY",
          role: "ward",
          actingUnitId: unitA,
          unitId: unitA,
          expectedRevision: unit.allocatable.revision ?? 0,
          value: unit.allocatable.value,
        };
      };
      const before = await store.read(actor, view);
      const commandId = randomUUID();
      const event = confirm(before);
      const saved = await store.command(actor, commandId, before.revision, event, { view });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.covered.length > 0, true);
      assert.equal((await store.revokeAccess(lead, cover.body.membership.id)).status, 200);
      // Deliberately reuse the already-resolved view: the transaction must refresh revoked cover.
      const replay = await store.command(actor, commandId, before.revision, event, { view });
      assert.equal(
        engine.commandRefusal((await store.read(administrator, lead)).payload, view.access, event, at, view.grants),
        null,
        "The own-ward command remains permitted after unrelated cover ends",
      );
      assert.equal(view.access.scope.unitIds.includes(unitB), false);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.outcome, saved.body.outcome);
      assert.equal(replay.body.commandRevision, saved.body.commandRevision);
      assert.deepEqual(Object.keys(replay.body).sort(), ["commandRevision", "outcome", "replayed", "snapshot"]);
      const outsider = seed.payload.state.patients.find(
        (patient) => !replay.body.snapshot.payload.state.patients.some((shown) => shown.id === patient.id),
      );
      assert.equal(Boolean(outsider), true);
      assert.equal((await store.breakGlass(view, outsider.id, "handover")).status, 200);
      const opened = await store.read(actor, view);
      const nextId = randomUUID();
      const nextEvent = confirm(opened);
      const nextSaved = await store.command(actor, nextId, opened.revision, nextEvent, { view });
      assert.equal(nextSaved.status, 200);
      assert.equal(nextSaved.body.covered.length > 0, true);
      at = new Date(at.getTime() + (engine.BREAK_GLASS_MINUTES + 1) * 60_000);
      const expired = await store.command(actor, nextId, opened.revision, nextEvent, { view, revisionOnly: true });
      assert.equal(
        engine.commandRefusal((await store.read(administrator, lead)).payload, view.access, nextEvent, at, view.grants),
        null,
      );
      assert.equal(expired.status, 200);
      assert.equal(expired.body.commandRevision, nextSaved.body.commandRevision);
      assert.equal(
        expired.body.snapshot.payload.state.patients.some((patient) => patient.id === outsider.id),
        false,
      );
      assert.deepEqual(Object.keys(expired.body).sort(), ["commandRevision", "outcome", "replayed", "snapshot"]);
      assert.equal(
        expired.body.snapshot.revision,
        nextSaved.body.commandRevision,
        "Replay never reapplies the saved action",
      );
    } finally {
      await pool.end();
    }
  },
);
