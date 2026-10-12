import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { readPortablePostgresConfig, validatePostgresConnectionString } from "./postgres-config.mjs";
import {
  createPortablePostgresPool,
  createPortableMigrationPool,
  verifyPortableRuntimeRole,
} from "./portable-postgres.mjs";

const connectionString = "postgresql://ward_runtime:synthetic@db.example.test:6543/ward_synthetic"; // precommit-scan: allow -- deliberately synthetic fixture
const config = { connectionString };
const prepared = {
  role: "ward_runtime",
  safe_flags: true,
  no_memberships: true,
  no_ownership: true,
  schema_grants: true,
  required_grants: true,
  restricted_grants: true,
  push_grants: true,
  audit_append_only: true,
  browser_denied: true,
  guards_valid: true,
  versions: [1, 2, 3, 4],
};

test("portable configuration accepts provider-independent hosts, ports and explicit runtime roles", () => {
  for (const url of [
    connectionString,
    connectionString.replace("postgresql:", "postgres:"),
    connectionString.replace("db.example.test:6543", "127.0.0.1:5432"),
    connectionString.replace("db.example.test:6543", "[::1]:5432"),
    connectionString.replace("ward_runtime", "ward%5Fruntime"),
  ]) {
    assert.deepEqual(readPortablePostgresConfig({ WARD_POSTGRES_DATABASE_URL: url }), { connectionString: url });
  }
  assert.deepEqual(
    readPortablePostgresConfig({
      WARD_POSTGRES_DATABASE_URL: connectionString,
      WARD_POSTGRES_CA_CERT_FILE: " ca.pem ",
    }),
    { ...config, caCertificateFile: "ca.pem" },
  );
});

test("portable runtime URLs fail closed without leaking credentials or parser details", () => {
  for (const value of [
    undefined,
    "invalid synthetic secret",
    connectionString.replace("postgresql:", "https:"),
    connectionString.replace("ward_runtime", "postgres"),
    connectionString.replace("ward_runtime", "POSTGRES"),
    connectionString.replace("ward_runtime", "administra%74or"),
    connectionString.replace("ward_runtime:synthetic", ":synthetic"),
    connectionString.replace(":synthetic", ""),
    connectionString.replace("db.example.test:6543", ""),
    connectionString.replace("ward_synthetic", ""),
    connectionString.replace("ward_synthetic", "ward/other"),
    connectionString.replace("ward_synthetic", "ward%2Fother"),
    connectionString.replace("ward_runtime", "%broken"),
    connectionString.replace("synthetic", "%broken"),
    connectionString.replace("ward_runtime", "ward%00runtime"),
    connectionString + "?sslmode=disable",
    connectionString + "?sslrootcert=unsafe.pem",
    connectionString + "?application_name=anything",
    connectionString + "?",
    connectionString + "#secret",
    connectionString + "#",
    " " + connectionString,
    connectionString.replace("db.example.test", "db.\nexample.test"),
  ])
    assert.throws(() => readPortablePostgresConfig({ WARD_POSTGRES_DATABASE_URL: value }), {
      message: "Invalid portable PostgreSQL configuration",
    });
});

test("administrator URL acceptance is explicit and never changes runtime validation", () => {
  const admin = connectionString.replace("ward_runtime", "postgres");
  assert.equal(validatePostgresConnectionString(admin, { runtime: false }), admin);
  assert.throws(() => validatePostgresConnectionString(admin));
  assert.throws(() => createPortablePostgresPool({ connectionString: admin, runtime: false }, { Pool: class {} }));
  assert.throws(() => validatePostgresConnectionString(admin + "?sslmode=disable", { runtime: false }));
});

test("the explicit migration factory accepts administrator credentials with identical verified TLS and deadlines", () => {
  const options = [];
  class FakePool {
    constructor(value) {
      options.push(value);
    }
    on() {}
  }
  const admin = connectionString.replace("ward_runtime", "postgres");
  createPortablePostgresPool(config, { Pool: FakePool });
  createPortableMigrationPool({ connectionString: admin }, { Pool: FakePool });
  assert.deepEqual(options[1], { ...options[0], connectionString: admin });
  assert.equal(options[1].ssl.rejectUnauthorized, true);
  assert.throws(() =>
    createPortableMigrationPool({ connectionString: admin + "?sslmode=disable" }, { Pool: FakePool }),
  );
});

test("portable pool always verifies TLS and fixes connection and query deadlines", () => {
  let options;
  let errorCallback;
  class FakePool {
    constructor(value) {
      options = value;
    }
    on(event, listener) {
      assert.equal(event, "error");
      errorCallback = listener;
    }
  }
  createPortablePostgresPool({ ...config, ssl: false }, { Pool: FakePool, allowInsecureTls: true });
  assert.deepEqual(options, {
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
  });
  assert.equal(typeof errorCallback, "function");
});

test("CA input accepts complete CA bundles and rejects missing, malformed or trailing certificate material", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wardflow-portable-ca-"));
  const caFile = join(directory, "ca.pem");
  let options;
  class FakePool {
    constructor(value) {
      options = value;
    }
    on() {}
  }
  const withCa = { ...config, caCertificateFile: caFile };
  try {
    const bundle = rootCertificates.slice(0, 2).join("\n");
    await writeFile(caFile, bundle);
    createPortablePostgresPool(withCa, { Pool: FakePool });
    assert.deepEqual(options.ssl, { rejectUnauthorized: true, ca: bundle });
    for (const invalid of [
      "invalid",
      rootCertificates[0] + "\ninvalid",
      rootCertificates[0] + "\n-----BEGIN CERTIFICATE-----bad-----END CERTIFICATE-----",
    ]) {
      await writeFile(caFile, invalid);
      assert.throws(() => createPortablePostgresPool(withCa, { Pool: FakePool }), {
        message: "Invalid database CA certificate configuration",
      });
    }
    await unlink(caFile);
    assert.throws(() => createPortablePostgresPool(withCa, { Pool: FakePool }), {
      message: "Invalid database CA certificate configuration",
    });
  } finally {
    try {
      await unlink(caFile);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rmdir(directory);
  }
});

test("runtime verification is a single payload-free catalog summary with exact role and migration identity", async () => {
  let calls = 0;
  const pool = {
    query: async (sql, parameters) => {
      calls++;
      assert.deepEqual(parameters, [false]);
      assert.match(sql, /pg_catalog\.pg_roles/);
      assert.match(
        sql,
        /rolsuper OR r\.rolcreatedb OR r\.rolcreaterole OR r\.rolreplication OR r\.rolbypassrls OR r\.rolinherit/,
      );
      assert.match(sql, /r\.rolcanlogin/);
      assert.match(sql, /pg_catalog\.pg_auth_members/);
      assert.match(sql, /nspowner = r\.oid/);
      assert.match(sql, /relowner = r\.oid/);
      assert.match(sql, /has_any_column_privilege/);
      assert.match(sql, /search_path=pg_catalog, ward_flow/);
      assert.match(sql, /t\.tgtype = 58/);
      assert.match(sql, /t\.tgtype = 19/);
      assert.match(sql, /t\.tgqual IS NULL/);
      assert.match(sql, /t\.tgattr = ''::pg_catalog\.int2vector/);
      assert.match(sql, /lanname = 'plpgsql'/);
      assert.doesNotMatch(sql, /payload|synthetic|password|connectionString/);
      return { rows: [prepared] };
    },
  };
  await verifyPortableRuntimeRole(pool, config);
  assert.equal(calls, 1);
  await verifyPortableRuntimeRole(
    { query: async () => ({ rows: [prepared] }) },
    {
      connectionString: connectionString.replace("ward_runtime", "ward%5Fruntime"),
    },
  );
});

test("unsafe flags, membership, ownership, broad/missing grants and altered guards each refuse startup", async () => {
  for (const field of [
    "safe_flags",
    "no_memberships",
    "no_ownership",
    "schema_grants",
    "required_grants",
    "restricted_grants",
    "push_grants",
    "audit_append_only",
    "browser_denied",
    "guards_valid",
  ]) {
    for (const value of [false, undefined, "true"])
      await assert.rejects(
        verifyPortableRuntimeRole({ query: async () => ({ rows: [{ ...prepared, [field]: value }] }) }, config),
        { message: "Unsafe or unprepared portable database runtime" },
      );
  }
  await assert.rejects(
    verifyPortableRuntimeRole({ query: async () => ({ rows: [{ ...prepared, role: "postgres" }] }) }, config),
  );
});

test("runtime requires exactly migrations 1-4 and refuses missing, future or malformed version state", async () => {
  for (const versions of [undefined, [], [1, 2, 3], [1, 2, 3, 4, 5], [1, 2, 4], [1, 2, 3, "4"], [4, 3, 2, 1]])
    await assert.rejects(
      verifyPortableRuntimeRole({ query: async () => ({ rows: [{ ...prepared, versions }] }) }, config),
    );
});

test("push privilege checks are conditional on the explicit enabled configuration", async () => {
  await verifyPortableRuntimeRole(
    {
      query: async (_sql, parameters) => {
        assert.deepEqual(parameters, [true]);
        return { rows: [prepared] };
      },
    },
    { ...config, pushEnabled: true },
  );
});

test("missing schema, denied catalog queries and database failures expose no upstream detail", async () => {
  for (const query of [
    async () => {
      throw new Error("synthetic credential in upstream error");
    },
    async () => ({ rows: [] }),
    async () => ({ rows: [prepared, prepared] }),
    async () => ({}),
  ])
    await assert.rejects(verifyPortableRuntimeRole({ query }, config), {
      message: "Portable database runtime verification unavailable",
    });
});
