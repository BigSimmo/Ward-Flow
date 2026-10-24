// @ts-check
import { LATEST_MIGRATION } from "./migrations.mjs";

// This module only reads catalogues and the bounded migration-version ledger.
// A reserved but empty namespace is deliberately not treated as a fresh database.
// The catalogue read is bounded so a crowded namespace cannot make it unbounded; every object must
// still match the expected set exactly. The bound leaves room for schema growth (55 objects at 13).
export const NAMESPACE_OBJECT_LIMIT = 128;
const CATALOG = `WITH namespace AS (
  SELECT oid, pg_catalog.pg_get_userbyid(nspowner) AS owner FROM pg_catalog.pg_namespace WHERE nspname = 'ward_flow'
), objects AS (
  SELECT c.oid, c.relname AS name, c.relkind AS kind, pg_catalog.pg_get_userbyid(c.relowner) AS owner,
    c.relpersistence AS persistence, c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
    EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid) AS inherited,
    CASE WHEN c.relkind = 'i' THEN pg_catalog.pg_get_indexdef(c.oid) END AS definition,
    CASE WHEN c.relkind = 'i' THEN (SELECT indisvalid AND indisready FROM pg_catalog.pg_index WHERE indexrelid=c.oid) END AS valid,
    (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM (
      SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        a.attnotnull AS required, a.attidentity AS identity, a.attgenerated AS generated,
        pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value
      FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=c.oid AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum LIMIT 129
    ) a) AS columns
  FROM pg_catalog.pg_class c JOIN namespace n ON n.oid=c.relnamespace ORDER BY c.relname LIMIT ${NAMESPACE_OBJECT_LIMIT + 1}
) SELECT (SELECT owner FROM namespace) AS owner,
  coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM objects o), '[]'::jsonb) AS objects,
  coalesce((SELECT jsonb_agg(to_jsonb(k)) FROM (
    SELECT c.relname AS table_name, k.contype AS type,
      ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY x(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num ORDER BY x.ord) AS keys,
      rn.nspname AS foreign_schema, rc.relname AS foreign_table,
      ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY x(num, ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num ORDER BY x.ord) AS foreign_keys,
      k.confdeltype AS delete_action, k.confupdtype AS update_action, k.confmatchtype AS match_type,
      k.convalidated AS validated, k.condeferrable AS deferrable, k.condeferred AS deferred,
      pg_catalog.pg_get_constraintdef(k.oid) AS definition
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
    JOIN namespace n ON n.oid=c.relnamespace AND k.contype <> 'n' LEFT JOIN pg_catalog.pg_class rc ON rc.oid=k.confrelid
    LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rc.relnamespace ORDER BY c.relname, k.conname LIMIT 129
  ) k), '[]'::jsonb) AS constraints,
  coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM (
    SELECT p.proname AS name, pg_catalog.pg_get_userbyid(p.proowner) AS owner, p.pronargs AS arguments,
      pg_catalog.format_type(p.prorettype, NULL) AS return_type, l.lanname AS language,
      p.prosecdef AS security_definer, p.prosrc AS body, p.proconfig AS settings, p.prokind AS kind
    FROM pg_catalog.pg_proc p JOIN namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang ORDER BY p.proname LIMIT 65
  ) f), '[]'::jsonb) AS functions,
  coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
    SELECT c.relname AS table_name, t.tgname AS name, p.proname AS function_name,
      pn.nspname AS function_schema, t.tgtype AS type, t.tgenabled AS enabled,
      t.tgnargs AS arguments, t.tgattr::text AS columns, t.tgqual IS NOT NULL AS conditional
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace WHERE NOT t.tgisinternal ORDER BY t.tgname LIMIT 65
  ) t), '[]'::jsonb) AS triggers,
  coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (
    SELECT c.relname AS name, pg_catalog.format_type(s.seqtypid, NULL) AS type,
      s.seqstart::text AS start, s.seqincrement::text AS increment, s.seqmin::text AS minimum,
      s.seqmax::text AS maximum, s.seqcache::text AS cache, s.seqcycle AS cycle,
      d.deptype AS dependency, rc.relname AS table_name, a.attname AS column_name
    FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid
    JOIN namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_depend d
      ON d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid AND d.refobjsubid > 0
    LEFT JOIN pg_catalog.pg_class rc ON rc.oid=d.refobjid
    LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=rc.oid AND a.attnum=d.refobjsubid ORDER BY c.relname LIMIT 65
  ) s), '[]'::jsonb) AS sequences,
  (SELECT count(*)::integer FROM pg_catalog.pg_type t JOIN namespace n ON n.oid=t.typnamespace
    WHERE NOT ((t.typtype='c' AND t.typrelid IN (SELECT oid FROM objects WHERE kind='r'))
      OR (t.typtype='b' AND t.typelem IN (SELECT oid FROM pg_catalog.pg_type
        WHERE typtype='c' AND typrelid IN (SELECT oid FROM objects WHERE kind='r'))))) AS unknown_types,
  (SELECT count(*)::integer FROM pg_catalog.pg_rewrite r JOIN objects o ON o.oid=r.ev_class) AS rules,
  coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT o.name AS table_name, p.polname AS name, p.polpermissive AS permissive, p.polcmd AS command,
      p.polroles::text AS roles, pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_catalog.pg_policy p JOIN objects o ON o.oid=p.polrelid ORDER BY o.name, p.polname LIMIT 65
  ) p), '[]'::jsonb) AS policies,
  (SELECT count(*)::integer FROM pg_catalog.pg_extension e JOIN namespace n ON n.oid=e.extnamespace) AS extensions`;

function normalise(value) {
  if (typeof value !== "string") return "";
  return value.replace(/'(?:''|[^'])*'|\s+/g, (token) => (token.startsWith("'") ? token : ""));
}

function expression(value) {
  // pg_get_expr/pg_get_constraintdef add explicit text casts to string literals.
  // Only erase that known no-op cast; casts on columns or to other types still matter.
  const deparsed = typeof value === "string" ? value.replace(/('(?:''|[^'])*')\s*::\s*text\b/g, "$1") : value;
  return normalise(deparsed).replace(/'(?:''|[^'])*'|[()]/g, (token) => (token.startsWith("'") ? token : ""));
}

const tableColumns = {
  migrations: "version:integer!,applied_at:timestamp with time zone!=now()",
  workspaces: "id:uuid!,revision:bigint!,payload:jsonb!,updated_at:timestamp with time zone!=now()",
  commands:
    "workspace_id:uuid!,actor_id:uuid!,command_id:uuid!,fingerprint:text!,status:integer!,result:jsonb!,committed_at:timestamp with time zone!=now()",
  audit:
    "sequence:bigint!@,workspace_id:uuid!,actor_id:uuid!,actor_role:text!='coordinator',command_id:uuid,action:text!,outcome:text!,prior_revision:bigint!,revision:bigint!,changes:jsonb!,committed_at:timestamp with time zone!=now()",
  push_subscriptions:
    "id:bigint!@,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,endpoint:text!,p256dh:text!,auth:text!,created_at:timestamp with time zone!=now(),last_success_at:timestamp with time zone,revoked_at:timestamp with time zone",
  push_baselines:
    "workspace_id:uuid!,data_mode:text!='prototype',item_ids:jsonb!,evaluated_at:timestamp with time zone!=now()",
  push_deliveries:
    "subscription_id:bigint!,item_id:text!,status:text!='pending',attempts:integer!=0,last_attempt_at:timestamp with time zone",
  memberships:
    "id:uuid!,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,role:text!,scope:jsonb!,granted_by:uuid!,granted_at:timestamp with time zone!=now(),expires_at:timestamp with time zone!,approved_by:uuid,approved_at:timestamp with time zone,revoked_by:uuid,revoked_at:timestamp with time zone",
  break_glass:
    "id:bigint!@,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,membership_id:uuid!,patient_id:text!,reason:text!,opened_at:timestamp with time zone!=now(),until:timestamp with time zone!",
  access_requests:
    "id:uuid!,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,role:text!,scope:jsonb!,requested_at:timestamp with time zone!=now(),decision:text,decided_by:uuid,decided_at:timestamp with time zone",
  workspace_records:
    "workspace_id:uuid!,data_mode:text!='prototype',collection:text!,record_id:text!,kind:text!,ordinal:integer!,revision:bigint!,body:jsonb!,updated_at:timestamp with time zone!=now()",
  record_access:
    "id:bigint!@,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,membership_id:uuid,actor_role:text!,actor_scope:jsonb!,patient_id:text!,surface:text!,viewed_at:timestamp with time zone!=now()",
  session_sign_outs:
    "session_id:uuid!,workspace_id:uuid!,data_mode:text!='prototype',actor_id:uuid!,signed_out_at:timestamp with time zone!=now(),until:timestamp with time zone!",
};

/** Columns later migrations added to an existing table, in the order they were added. */
const addedColumns = [
  [2, "workspaces", "data_mode:text!='prototype'"],
  [2, "commands", "data_mode:text!='prototype'"],
  [2, "audit", "data_mode:text!='prototype'"],
  [8, "audit", "actor_scope:jsonb"],
  [9, "memberships", "kind:text!='role',last_used_at:timestamp with time zone"],
  [9, "push_subscriptions", "membership_id:uuid"],
];

/** The migration that created each table; a table missing from here has been there since 1. */
const tableSince = {
  push_subscriptions: 3,
  push_baselines: 3,
  push_deliveries: 3,
  memberships: 8,
  break_glass: 8,
  access_requests: 9,
  workspace_records: 10,
  record_access: 11,
  session_sign_outs: 11,
};

const ACCESS_ROLES = "ARRAY['coordinator','bed_manager','ward','ed','community','officer','executive','admin']";

function columns(spec) {
  return spec.split(",").map((value) => {
    const [name, definition] = value.split(":");
    const [type, defaultValue] = definition.split("=");
    return {
      name,
      type: type.replace(/[!@]/g, ""),
      required: type.includes("!"),
      identity: type.includes("@") ? "a" : "",
      generated: "",
      default_value: defaultValue ?? null,
    };
  });
}

const checks = {
  workspaces: ["revision > 0", "jsonb_typeof(payload) = 'object'", "octet_length(payload::text) <= 8388608"],
  audit: ["actor_role = 'coordinator'", "outcome = ANY (ARRAY['accepted','denied','stale'])"],
  push_subscriptions: [
    "data_mode = 'prototype'",
    "endpoint ~~ 'https://%' AND length(endpoint) <= 2048",
    "length(p256dh) <= 128",
    "length(auth) <= 64",
  ],
  push_baselines: ["data_mode = 'prototype'", "jsonb_typeof(item_ids) = 'array'"],
  push_deliveries: ["length(item_id) <= 200", "status = ANY (ARRAY['pending','sent','failed'])", "attempts >= 0"],
  memberships: [
    "data_mode = 'prototype'",
    `role = ANY (${ACCESS_ROLES})`,
    "jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 4096",
    "granted_by <> actor_id",
    "expires_at > granted_at",
    "approved_by <> granted_by AND approved_by <> actor_id",
    "(approved_by IS NULL) = (approved_at IS NULL)",
    "(revoked_by IS NULL) = (revoked_at IS NULL)",
  ],
  break_glass: [
    "data_mode = 'prototype'",
    "length(patient_id) <= 100",
    "reason = ANY (ARRAY['handover','bed-search','transport-safety','other'])",
    "until > opened_at",
  ],
  access_requests: [
    "data_mode = 'prototype'",
    `role = ANY (${ACCESS_ROLES})`,
    "jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 4096",
    "decision = ANY (ARRAY['approved','declined'])",
    "decided_by <> actor_id",
    "(decision IS NULL) = (decided_by IS NULL) AND (decision IS NULL) = (decided_at IS NULL)",
  ],
  workspace_records: [
    "data_mode = 'prototype'",
    "collection ~ '^[A-Za-z][A-Za-z0-9]{0,63}$'",
    "length(record_id) >= 1 AND length(record_id) <= 200",
    "kind = ANY (ARRAY['item','index','entry'])",
    "ordinal >= 0",
    "revision > 0",
    "octet_length(body::text) <= 1048576",
    "kind <> 'item' OR (jsonb_typeof(body) = 'object' AND body ->> 'id' = record_id)",
  ],
  record_access: [
    "data_mode = 'prototype'",
    `actor_role = ANY (${ACCESS_ROLES})`,
    "jsonb_typeof(actor_scope) = 'object' AND octet_length(actor_scope::text) <= 4096",
    "length(patient_id) >= 1 AND length(patient_id) <= 100",
  ],
  session_sign_outs: ["data_mode = 'prototype'", "until > signed_out_at"],
};

/** Migration 9 added cover to memberships: a kind, and cover only of a ward or an ED. */
const membershipChecksFrom9 = [
  "kind = ANY (ARRAY['role','cover'])",
  "kind = 'role' OR role = ANY (ARRAY['ward','ed'])",
];

/** Migration 8 widened the audit role check and added the sender's place. */
const auditChecksFrom8 = [
  `actor_role = ANY (${ACCESS_ROLES})`,
  "outcome = ANY (ARRAY['accepted','denied','stale'])",
  "actor_scope IS NULL OR jsonb_typeof(actor_scope) = 'object'",
];

const primaryKeys = {
  migrations: ["version"],
  workspaces: ["id"],
  commands: ["workspace_id", "actor_id", "command_id"],
  audit: ["sequence"],
  push_subscriptions: ["id"],
  push_baselines: ["workspace_id"],
  push_deliveries: ["subscription_id", "item_id"],
  memberships: ["id"],
  break_glass: ["id"],
  access_requests: ["id"],
  workspace_records: ["workspace_id", "collection", "record_id"],
  record_access: ["id"],
  session_sign_outs: ["session_id"],
};

const indexes = [
  [1, "migrations_pkey", "migrations", "version", true],
  [1, "workspaces_pkey", "workspaces", "id", true],
  [1, "commands_pkey", "commands", "workspace_id, actor_id, command_id", true],
  [1, "audit_pkey", "audit", "sequence", true],
  [1, "audit_workspace_sequence", "audit", "workspace_id, sequence DESC", false],
  [2, "workspace_mode_unique", "workspaces", "id, data_mode", true],
  [3, "push_subscriptions_pkey", "push_subscriptions", "id", true],
  [3, "push_subscriptions_endpoint_key", "push_subscriptions", "endpoint", true],
  [3, "push_subscriptions_active", "push_subscriptions", "workspace_id", false, "revoked_at IS NULL"],
  [3, "push_baselines_pkey", "push_baselines", "workspace_id", true],
  [3, "push_deliveries_pkey", "push_deliveries", "subscription_id, item_id", true],
  [3, "push_deliveries_pending", "push_deliveries", "subscription_id", false, "status = 'pending'"],
  [5, "commands_workspace_committed", "commands", "workspace_id, committed_at DESC", false],
  [5, "push_subscriptions_actor_active", "push_subscriptions", "workspace_id, actor_id", false, "revoked_at IS NULL"],
  [8, "memberships_pkey", "memberships", "id", true],
  [8, "memberships_actor_active", "memberships", "workspace_id, actor_id", false, "revoked_at IS NULL"],
  [8, "break_glass_pkey", "break_glass", "id", true],
  [8, "break_glass_actor", "break_glass", "workspace_id, actor_id, until DESC", false],
  [9, "access_requests_pkey", "access_requests", "id", true],
  [9, "access_requests_one_open", "access_requests", "workspace_id, actor_id", true, "decision IS NULL"],
  [10, "workspace_records_pkey", "workspace_records", "workspace_id, collection, record_id", true],
  [11, "record_access_pkey", "record_access", "id", true],
  [11, "record_access_patient", "record_access", "workspace_id, patient_id, viewed_at DESC", false],
  [11, "record_access_actor", "record_access", "workspace_id, actor_id, viewed_at DESC", false],
  [11, "session_sign_outs_pkey", "session_sign_outs", "session_id", true],
  [12, "access_requests_workspace_mode", "access_requests", "workspace_id, data_mode", false],
  [12, "audit_workspace_mode", "audit", "workspace_id, data_mode", false],
  [12, "break_glass_membership", "break_glass", "membership_id", false],
  [12, "break_glass_workspace_mode", "break_glass", "workspace_id, data_mode", false],
  [12, "commands_workspace_mode", "commands", "workspace_id, data_mode", false],
  [12, "memberships_workspace_mode", "memberships", "workspace_id, data_mode", false],
  [12, "push_baselines_workspace_mode", "push_baselines", "workspace_id, data_mode", false],
  [12, "push_subscriptions_membership", "push_subscriptions", "membership_id", false],
  [12, "push_subscriptions_workspace_mode", "push_subscriptions", "workspace_id, data_mode", false],
  [12, "record_access_membership", "record_access", "membership_id", false],
  [12, "record_access_workspace_mode", "record_access", "workspace_id, data_mode", false],
  [12, "session_sign_outs_workspace_mode", "session_sign_outs", "workspace_id, data_mode", false],
  [12, "workspace_records_workspace_mode", "workspace_records", "workspace_id, data_mode", false],
];

/** Each guard trigger function, the table it guards and the migration that added it. */
const protectors = {
  protect_audit: {
    since: 1,
    table: "audit",
    type: 58,
    body: "BEGIN RAISE EXCEPTION 'Ward Flow audit records are append-only'; END",
  },
  protect_workspace_mode: {
    since: 2,
    table: "workspaces",
    type: 19,
    body: "BEGIN IF NEW.data_mode IS DISTINCT FROM OLD.data_mode THEN RAISE EXCEPTION 'Ward Flow workspace data mode cannot be changed'; END IF; RETURN NEW; END",
  },
  protect_record_access: {
    since: 11,
    table: "record_access",
    type: 58,
    body: "BEGIN RAISE EXCEPTION 'Ward Flow record access entries are append-only'; END",
  },
  protect_break_glass: {
    since: 11,
    table: "break_glass",
    type: 58,
    body: "BEGIN RAISE EXCEPTION 'Ward Flow break glass records are append-only'; END",
  },
};

function sameKeys(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function refuse() {
  throw new Error("Unrecognised or unsafe Ward Flow database namespace");
}

function verifyColumns(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) refuse();
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (
      !a ||
      a.name !== e.name ||
      a.type !== e.type ||
      a.required !== e.required ||
      a.identity !== e.identity ||
      a.generated !== e.generated ||
      expression(a.default_value) !== expression(e.default_value)
    )
      refuse();
  }
}

function expectedConstraints(version, tables) {
  const result = [];
  for (const table of tables) {
    result.push({ table, type: "p", keys: primaryKeys[table] });
    for (const check of [
      ...((version >= 8 && table === "audit" ? auditChecksFrom8 : checks[table]) ?? []),
      ...(version >= 9 && table === "memberships" ? membershipChecksFrom9 : []),
      // Migration 13 added the referral detail to the screens a record view names.
      ...(table === "record_access"
        ? [
            version >= 13
              ? "surface = ANY (ARRAY['patient','movement','referral'])"
              : "surface = ANY (ARRAY['patient','movement'])",
          ]
        : []),
    ])
      result.push({ table, type: "c", check: expression("CHECK (" + check + ")") });
  }
  for (const table of ["commands", "audit"])
    result.push({ table, type: "f", keys: ["workspace_id"], target: "workspaces", foreign: ["id"], deletion: "a" });
  if (version >= 2) {
    result.push({ table: "workspaces", type: "u", keys: ["id", "data_mode"] });
    result.push({
      table: "workspaces",
      type: "c",
      // Migration 7 removed the never-used live label (D-55: synthetic data only).
      check: expression(
        version >= 7 ? "CHECK (data_mode = 'prototype')" : "CHECK (data_mode = ANY (ARRAY['prototype','live']))",
      ),
    });
    for (const table of ["commands", "audit"])
      result.push({
        table,
        type: "f",
        keys: ["workspace_id", "data_mode"],
        target: "workspaces",
        foreign: ["id", "data_mode"],
        deletion: "a",
      });
  }
  if (version >= 3) {
    result.push({ table: "push_subscriptions", type: "u", keys: ["endpoint"] });
    for (const table of ["push_subscriptions", "push_baselines"])
      result.push({
        table,
        type: "f",
        keys: ["workspace_id", "data_mode"],
        target: "workspaces",
        foreign: ["id", "data_mode"],
        deletion: "a",
      });
    result.push({
      table: "push_deliveries",
      type: "f",
      keys: ["subscription_id"],
      target: "push_subscriptions",
      foreign: ["id"],
      deletion: "c",
    });
  }
  if (version >= 8) {
    for (const table of ["memberships", "break_glass"])
      result.push({
        table,
        type: "f",
        keys: ["workspace_id", "data_mode"],
        target: "workspaces",
        foreign: ["id", "data_mode"],
        deletion: "a",
      });
    result.push({
      table: "break_glass",
      type: "f",
      keys: ["membership_id"],
      target: "memberships",
      foreign: ["id"],
      deletion: "a",
    });
  }
  if (version >= 11) {
    for (const table of ["record_access", "session_sign_outs"])
      result.push({
        table,
        type: "f",
        keys: ["workspace_id", "data_mode"],
        target: "workspaces",
        foreign: ["id", "data_mode"],
        deletion: "a",
      });
    result.push({
      table: "record_access",
      type: "f",
      keys: ["membership_id"],
      target: "memberships",
      foreign: ["id"],
      deletion: "a",
    });
  }
  if (version >= 9) {
    result.push({
      table: "access_requests",
      type: "f",
      keys: ["workspace_id", "data_mode"],
      target: "workspaces",
      foreign: ["id", "data_mode"],
      deletion: "a",
    });
    result.push({
      table: "push_subscriptions",
      type: "f",
      keys: ["membership_id"],
      target: "memberships",
      foreign: ["id"],
      deletion: "a",
    });
  }
  if (version >= 10)
    result.push({
      table: "workspace_records",
      type: "f",
      keys: ["workspace_id", "data_mode"],
      target: "workspaces",
      foreign: ["id", "data_mode"],
      deletion: "a",
    });
  return result;
}

function verifyCatalog(catalog, version, runtimeRole) {
  if (!catalog.owner || [runtimeRole, "wardflow_backend", "anon", "authenticated"].includes(catalog.owner)) refuse();
  const tables = Object.keys(tableColumns).filter((name) => version >= (tableSince[name] ?? 1));
  const sequences = [
    "audit_sequence_seq",
    ...(version >= 3 ? ["push_subscriptions_id_seq"] : []),
    ...(version >= 8 ? ["break_glass_id_seq"] : []),
    ...(version >= 11 ? ["record_access_id_seq"] : []),
  ];
  const expectedObjects = [
    ...tables,
    ...indexes.filter(([minimum]) => version >= minimum).map(([, name]) => name),
    ...sequences,
  ].sort();
  if (!sameKeys(catalog.objects.map((object) => object.name).sort(), expectedObjects)) refuse();
  for (const object of catalog.objects) {
    if (
      object.owner !== catalog.owner ||
      ["anon", "authenticated"].includes(object.owner) ||
      object.persistence !== "p" ||
      object.rls !== (version >= 6 && tables.includes(object.name)) ||
      object.force_rls ||
      object.inherited !== false
    )
      refuse();
    if (tables.includes(object.name)) {
      if (object.kind !== "r") refuse();
      const expected = columns(tableColumns[object.name]);
      for (const [minimum, table, spec] of addedColumns)
        if (version >= minimum && table === object.name) expected.push(...columns(spec));
      verifyColumns(object.columns, expected);
    } else if (object.name.endsWith("_seq")) {
      if (object.kind !== "S") refuse();
    } else {
      const [, name, table, keys, unique, predicate] = indexes.find(([, name]) => name === object.name) ?? [];
      const expected = `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ward_flow.${table} USING btree (${keys})${predicate ? " WHERE " + predicate : ""}`;
      if (object.kind !== "i" || object.valid !== true || expression(object.definition) !== expression(expected))
        refuse();
    }
  }
  // Migration 6: one runtime-only policy per table, nothing else; before it, no policy at all.
  const policies = version >= 6 ? tables : [];
  if (catalog.policies.length !== policies.length) refuse();
  const runtimeOnly = expression("(CURRENT_USER = 'wardflow_backend'::name)");
  for (const table of policies) {
    const policy = catalog.policies.find((p) => p.table_name === table);
    if (
      !policy ||
      policy.name !== "runtime_only" ||
      policy.permissive !== true ||
      policy.command !== "*" ||
      policy.roles !== "{0}" ||
      expression(policy.qual) !== runtimeOnly ||
      expression(policy.with_check) !== runtimeOnly
    )
      refuse();
  }
  const expected = expectedConstraints(version, tables);
  if (catalog.constraints.length !== expected.length) refuse();
  for (const actual of catalog.constraints) {
    if (actual.validated !== true || actual.deferrable !== false || actual.deferred !== false) refuse();
    const index = expected.findIndex(
      (e) =>
        e.table === actual.table_name &&
        e.type === actual.type &&
        (e.type === "c" ? e.check === expression(actual.definition) : sameKeys(e.keys, actual.keys)) &&
        (e.type !== "f" ||
          (actual.foreign_schema === "ward_flow" &&
            actual.foreign_table === e.target &&
            sameKeys(e.foreign, actual.foreign_keys) &&
            actual.delete_action === e.deletion &&
            actual.update_action === "a" &&
            actual.match_type === "s")),
    );
    if (index < 0) refuse();
    expected.splice(index, 1);
  }
  const names = Object.keys(protectors).filter((name) => version >= protectors[name].since);
  if (catalog.functions.length !== names.length || catalog.triggers.length !== names.length) refuse();
  for (const name of names) {
    const fn = catalog.functions.find((f) => f.name === name);
    const guard = protectors[name];
    if (
      !fn ||
      fn.owner !== catalog.owner ||
      fn.arguments !== 0 ||
      fn.return_type !== "trigger" ||
      fn.language !== "plpgsql" ||
      fn.security_definer !== false ||
      fn.kind !== "f" ||
      normalise(fn.body) !== normalise(guard.body)
    )
      refuse();
    const settings = fn.settings ?? [];
    if (
      !Array.isArray(settings) ||
      settings.some((setting) => setting !== "search_path=pg_catalog, ward_flow") ||
      (version >= 4 && !settings.includes("search_path=pg_catalog, ward_flow"))
    )
      refuse();
    const trigger = catalog.triggers.find((t) => t.name === name);
    if (
      !trigger ||
      trigger.table_name !== guard.table ||
      trigger.function_name !== name ||
      trigger.function_schema !== "ward_flow" ||
      trigger.type !== guard.type ||
      !["O", "A"].includes(trigger.enabled) ||
      trigger.arguments !== 0 ||
      trigger.columns !== "" ||
      trigger.conditional !== false
    )
      refuse();
  }
  if (catalog.sequences.length !== sequences.length) refuse();
  for (const name of sequences) {
    const sequence = catalog.sequences.find((s) => s.name === name);
    const table = name.replace(/_(?:sequence|id)_seq$/, "");
    const column = table === "audit" ? "sequence" : "id";
    if (
      !sequence ||
      sequence.type !== "bigint" ||
      sequence.start !== "1" ||
      sequence.increment !== "1" ||
      sequence.minimum !== "1" ||
      sequence.maximum !== "9223372036854775807" ||
      sequence.cache !== "1" ||
      sequence.cycle !== false ||
      sequence.dependency !== "i" ||
      sequence.table_name !== table ||
      sequence.column_name !== column
    )
      refuse();
  }
}

export async function verifyPostgresNamespace(pool, { runtimeRole = "wardflow_backend" } = {}) {
  let catalog;
  try {
    const result = await pool.query(CATALOG);
    if (result.rows?.length !== 1) refuse();
    catalog = result.rows[0];
  } catch {
    throw new Error("Ward Flow database namespace verification unavailable");
  }
  if (catalog.owner === null) return;
  for (const [key, maximum] of /** @type {[string, number][]} */ ([
    ["objects", NAMESPACE_OBJECT_LIMIT],
    ["constraints", 128],
    ["functions", 64],
    ["triggers", 64],
    ["sequences", 64],
  ]))
    if (!Array.isArray(catalog[key]) || catalog[key].length > maximum) refuse();
  if (!Array.isArray(catalog.policies) || catalog.policies.length > 64) refuse();
  for (const key of ["unknown_types", "rules", "extensions"]) if (catalog[key] !== 0) refuse();
  // Row-level security is checked against the version below; the owner reads the ledger either way.
  const migrations = catalog.objects.find((object) => object.name === "migrations");
  if (!migrations || migrations.kind !== "r" || migrations.force_rls) refuse();
  verifyColumns(migrations.columns, columns(tableColumns.migrations));
  let versions;
  try {
    const result = await pool.query(
      `SELECT version FROM ward_flow.migrations ORDER BY version LIMIT ${LATEST_MIGRATION + 1}`,
    );
    versions = result.rows.map((row) => row.version);
  } catch {
    throw new Error("Ward Flow database migration identity verification unavailable");
  }
  if (
    !versions.length ||
    versions.length > LATEST_MIGRATION ||
    !versions.every((version, index) => version === index + 1)
  )
    refuse();
  verifyCatalog(catalog, versions.length, runtimeRole);
}
