/**
 * Audit 7 (issue #1570): one role-by-action permission matrix across every layer.
 *
 *     node scripts/run-tsx.mjs scripts/ward-flow/permission-matrix.ts           # write the matrix
 *     node scripts/run-tsx.mjs scripts/ward-flow/permission-matrix.ts --check   # fail when stale
 *
 * For every action (`EVENT_ROLE` key) and every desk, each layer is ASKED, never restated:
 *
 * - screen: `dispatchPermission` for the role the shell gives the desk (`chromeRoleForAccess`, the
 *   coordinator's own desk route), which is what `useRoleGate` disables a button with. The demo
 *   controls are offered from the server's `demoControls` flag (whole-network desks only), and a
 *   desk with no role is shown the ask-for-access gate instead of the app.
 * - engine: `wardFlowReducer` run on the synthetic seed with the event and the desk's role. The
 *   reducer checks the role before the payload, so a bare event shows whether the role gate lets it
 *   through. Where the reducer throws on the bare event before its role gate, the cell falls back to
 *   `EVENT_ROLE` itself and is listed as such.
 * - backend: `deskCommand` then the explicit-role clause of `validSharedCommand`, then
 *   `commandRefusal` for the desk's membership. The role refusal counts here, and so does a place
 *   refusal that holds whatever record is named (`FIXED_PLACE_REFUSALS`, L11): a refusal that
 *   depends on a real record is the scope audit's business, not this one's.
 * - database: the SQL migrations and runtime role scripts, read as text. Every table is row level
 *   secured to the runtime role alone, so no app role reaches a row except through the backend; the
 *   database defers every cell to the backend and the test fails if that ever stops being true.
 *
 * Offline only: no database, no network, synthetic seed data.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

import "./stub-style-imports.mjs";
import "../../src/components/ward-management/ward-flow-reducer-slices";
import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "../../src/components/ward-management/ward-flow-roles";
import { seedWardFlowState, wardFlowReducer } from "../../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allEmergencyDepartments } from "../../src/components/ward-management/ward-sites";
import { dispatchPermission } from "../../src/components/ward-management/ward-role-permissions";
import {
  accessIsWholeNetwork,
  unitInScope,
  type WardAccess,
} from "../../src/components/ward-management/ward-role-access";
import { wardPlaceLookup } from "../../src/components/ward-management/ward-access-places";
import { mayRecordOutage } from "../../src/components/ward-management/ward-outage-catch-up";
import { chromeRoleForAccess } from "../../src/components/ward-management/shell/ward-access-store";
import { commandRefusal, deskCommand, demoOnlyCommand, seedWorld } from "../../backend/ward-flow/engine";
import {
  SITE_FEATURE_SWITCH_ROLE,
  mayChangeSiteFeatures,
} from "../../src/components/ward-management/ward-site-feature-switches";

type EventType = WardFlowEvent["type"];
export type Verdict = "allow" | "deny" | "defer";
export type LayerId = "screen" | "engine" | "backend" | "database";
export const LAYERS: readonly LayerId[] = ["screen", "engine", "backend", "database"];

export type Desk = { id: string; label: string; access: WardAccess | null };

const ROOT = process.cwd();
export const MATRIX_PATH = path.join(ROOT, "docs", "ward-flow", "permission-matrix.md");
const MIGRATIONS = path.join(ROOT, "backend", "ward-flow", "migrations");
const INFRA = path.join(ROOT, "backend", "ward-flow", "infra");
const RUNTIME_ROLE = "wardflow_backend";
/** Database roles a grant may name. Neither is a browser role; the pruner runs one function. */
const ALLOWED_GRANTEES = new Set([RUNTIME_ROLE, "wardflow_pruner"]);
const NOT_YOURS = "This change is not part of your role.";

/**
 * L11 (mechanics and clock audit, 14 Nov 2026): the backend's refusals that hold for a desk whatever
 * record it names, because the desk's place can never take the action (`commandRefusal` and
 * `commandScopeRefusal`). They count as "deny", like the role refusal above, so a service
 * coordinator's five fixed refusals are pinned and a new screen cannot offer one unnoticed. A
 * refusal only for the bare command (a site or ward sign-off that names no site or ward) is asked
 * again naming the desk's own place, and counts only if it still stands.
 */
const FIXED_PLACE_REFUSALS: ReadonlySet<string> = new Set([
  "Only the statewide coordinator may change global settings.",
  "Only the statewide coordinator records an outage.",
  "Only an admin switches a feature off at a site.",
  "Only the site bed manager signs off its own site's handover.",
  "Only the statewide coordinator signs off the whole network.",
]);

/**
 * The screen's own place gates for those actions, beside the role gate `dispatchPermission` answers.
 * Each is the pure check the screen calls, or the condition it renders on, so the screen and backend
 * columns are both asked rather than one restating the other.
 */
const SCREEN_PLACE_GATES: Partial<Record<EventType, (access: WardAccess) => boolean>> = {
  // Settings' rule editor is read-only below the whole network (`useConfigurationGate`).
  SET_CONFIGURATION: (access) => accessIsWholeNetwork(access),
  // Record an outage (`downtime-pack-screen.tsx`) needs `mayRecordOutage`.
  RECORD_OUTAGE_WINDOW: mayRecordOutage,
  // Settings' Features at this site card needs `mayChangeSiteFeatures` (D-142).
  SET_SITE_FEATURE_SWITCH: mayChangeSiteFeatures,
  // The site sign-off card renders for a site bed manager at its own site (`HandoverSiteSignOffSlot`);
  // a whole-network desk is not limited by place.
  RECORD_SITE_HANDOVER_SIGN_OFF: (access) =>
    accessIsWholeNetwork(access) || (access.role === "bed_manager" && access.scope.kind === "site"),
};

/**
 * Known disagreements between layers. Each is a security finding to fix in its own change, never
 * here; listing one keeps the test honest and green on known items only. The test fails when a
 * listed item stops disagreeing (take it off) or a new one appears (report it, then list it).
 */
export const EXPECTED_DISAGREEMENTS: readonly { action: EventType; desk: string; todo: string }[] = [];

const AT = new Date("2026-11-04T12:00:00Z");

function desks(): Desk[] {
  const state = seedWardFlowState();
  const unit = state.units[0];
  const ed = allEmergencyDepartments()[0];
  return [
    {
      id: "coordinator",
      label: "Coordinator (statewide)",
      access: { role: "coordinator", scope: { kind: "statewide" } },
    },
    {
      id: "coordinator_service",
      label: "Coordinator (one service)",
      access: { role: "coordinator", scope: { kind: "service", service: "North Metro" } },
    },
    {
      id: "officer",
      label: "Transport officer",
      access: { role: "officer", scope: { kind: "jobs", service: "North Metro" } },
    },
    { id: "ward", label: "Ward user", access: { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } } },
    {
      id: "bed_manager",
      label: "Site bed manager",
      access: { role: "bed_manager", scope: { kind: "site", siteCode: unit.siteCode } },
    },
    { id: "ed", label: "ED clinician", access: { role: "ed", scope: { kind: "ed", edId: ed.id } } },
    {
      id: "community",
      label: "Community team",
      access: { role: "community", scope: { kind: "team", teamName: "Synthetic community team" } },
    },
    { id: "executive", label: "Executive", access: { role: "executive", scope: { kind: "statewide" } } },
    { id: "admin", label: "Access admin", access: { role: "admin", scope: { kind: "statewide" } } },
    { id: "none", label: "No role", access: null },
  ];
}

/** The role a desk's screen acts as: its own desk for a coordinator, `useAccessShellRole` for the rest. */
function shellRole(access: WardAccess): WardFlowRole {
  return access.role === "coordinator" ? "coordinator" : chromeRoleForAccess(access);
}

/** The role a desk's command carries: `demo` for the demonstration controls, else its shell role. */
function sentRole(access: WardAccess, type: EventType): WardFlowRole {
  return demoOnlyCommand({ type }) ? "demo" : shellRole(access);
}

function screenVerdict(desk: Desk, type: EventType): Verdict {
  if (!desk.access) return "deny";
  if (demoOnlyCommand({ type })) return accessIsWholeNetwork(desk.access) ? "allow" : "deny";
  // D-142: the access admin's one action, offered by Settings' Features at this site card, which
  // `mayChangeSiteFeatures` gates and which sends the engine's coordinator role.
  if (type === "SET_SITE_FEATURE_SWITCH" && desk.access.role === "admin")
    return mayChangeSiteFeatures(desk.access) && dispatchPermission(SITE_FEATURE_SWITCH_ROLE, type).allowed
      ? "allow"
      : "deny";
  const placeGate = SCREEN_PLACE_GATES[type];
  if (placeGate && !placeGate(desk.access)) return "deny";
  return dispatchPermission(shellRole(desk.access), type).allowed ? "allow" : "deny";
}

const engineState = seedWardFlowState();
const roleRejection = /requires role .* but was raised by role|^Your role cannot make this change|^Coordinator only$/;

/** The reducer's own answer for a bare event, or `undefined` when it throws before its role gate. */
function reducerAnswer(type: EventType, role: WardFlowRole): Verdict | undefined {
  try {
    const next = wardFlowReducer(engineState, { type, role, now: NOW_ANCHOR } as unknown as WardFlowEvent);
    const audits = next.auditEvents.slice(engineState.auditEvents.length);
    const rejections = next.rejections.slice(engineState.rejections.length);
    const refused =
      audits.some((entry) => entry.reasonCode === "role") ||
      rejections.some((rejection) => roleRejection.test(rejection.reason));
    return refused ? "deny" : "allow";
  } catch {
    return undefined;
  }
}

function engineVerdict(desk: Desk, type: EventType): { verdict: Verdict; probed: boolean } {
  // No role never reaches the engine, and `demo` names no desk: both are decided before it.
  if (!desk.access || demoOnlyCommand({ type })) return { verdict: "defer", probed: true };
  const role = deskCommandRole(desk.access, type);
  const answer = reducerAnswer(type, role);
  if (answer) return { verdict: answer, probed: true };
  return { verdict: (EVENT_ROLE[type] as readonly string[]).includes(role) ? "allow" : "deny", probed: false };
}

function deskCommandRole(access: WardAccess, type: EventType): WardFlowRole {
  const command = deskCommand(access, { type, role: sentRole(access, type), now: NOW_ANCHOR }) as {
    role: WardFlowRole;
  };
  return command.role;
}

const backendWorld = seedWorld(AT);
const backendPlaces = wardPlaceLookup(backendWorld.state.units);

/** The desk's own place, as a command naming it would: its site, and one ward inside its scope. */
function ownPlace(access: WardAccess): Record<string, unknown> {
  const unit = backendWorld.state.units.find((candidate) => unitInScope(access.scope, candidate.id, backendPlaces));
  return {
    ...(unit ? { unitId: unit.id } : {}),
    ...(access.scope.kind === "site" ? { siteCode: access.scope.siteCode } : {}),
  };
}

/** The backend's refusal, or `null`. A throw comes from the place check reading a record the bare
 *  command does not name, after the role check, so it is no refusal of the role or the place. */
function backendRefusal(access: WardAccess, command: Record<string, unknown>): string | null {
  try {
    return commandRefusal(backendWorld, access, command, AT);
  } catch {
    return null;
  }
}

const fixedRefusal = (refusal: string | null) =>
  refusal !== null && (refusal === NOT_YOURS || FIXED_PLACE_REFUSALS.has(refusal));

/** The backend's answer, and whether a refusal was for the desk's place alone (its role is allowed). */
function backendAnswer(desk: Desk, type: EventType): { verdict: Verdict; placeOnly: boolean } {
  const verdict = backendRoleOrPlaceVerdict(desk, type);
  return { verdict, placeOnly: verdict === "deny" && placeRefused(desk, type) };
}

function placeRefused(desk: Desk, type: EventType): boolean {
  if (!desk.access) return false;
  const command = deskCommand(desk.access, { type, role: sentRole(desk.access, type), now: NOW_ANCHOR }) as Record<
    string,
    unknown
  >;
  if (!(EVENT_ROLE[type] as readonly unknown[]).includes(command.role)) return false;
  const refusal = backendRefusal(desk.access, command);
  return refusal !== null && FIXED_PLACE_REFUSALS.has(refusal);
}

function backendRoleOrPlaceVerdict(desk: Desk, type: EventType): Verdict {
  // shared-http.mjs answers 403 "No Ward Flow role" before the command route (pinned by the test).
  if (!desk.access) return "deny";
  const command = deskCommand(desk.access, { type, role: sentRole(desk.access, type), now: NOW_ANCHOR }) as Record<
    string,
    unknown
  >;
  // validSharedCommand: "an explicit role allowed for it (never a default)".
  if (!(EVENT_ROLE[type] as readonly unknown[]).includes(command.role)) return "deny";
  const refusal = backendRefusal(desk.access, command);
  if (refusal === NOT_YOURS) return "deny";
  if (!fixedRefusal(refusal)) return "allow";
  // L11: a fixed place refusal counts only if it still stands with the desk's own place named.
  return fixedRefusal(backendRefusal(desk.access, { ...command, ...ownPlace(desk.access) })) ? "deny" : "allow";
}

export type DatabaseFacts = {
  tables: string[];
  withoutRls: string[];
  nonRuntimePolicies: string[];
  tablesWithoutPolicy: string[];
  browserGrants: string[];
  membershipRoles: string[];
};

function sqlFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql") && !name.startsWith("rollback-"))
    .sort()
    .map((name) => path.join(directory, name));
}

/** What the SQL in the repository says about who may reach a row. Text only; nothing is run. */
export function readDatabaseFacts(): DatabaseFacts {
  const migrations = sqlFiles(MIGRATIONS).map((file) => readFileSync(file, "utf8"));
  const infra = sqlFiles(INFRA).map((file) => readFileSync(file, "utf8"));
  const all = [...migrations, ...infra].join("\n").replace(/--[^\n]*/g, "");
  const created = new Set<string>();
  for (const match of all.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?ward_flow\.(\w+)/gi)) created.add(match[1]);
  for (const match of all.matchAll(/DROP TABLE (?:IF EXISTS )?ward_flow\.(\w+)/gi)) created.delete(match[1]);
  const rls = new Set([...all.matchAll(/ALTER TABLE ward_flow\.(\w+) ENABLE ROW LEVEL SECURITY/gi)].map((m) => m[1]));
  const disabled = new Set(
    [...all.matchAll(/ALTER TABLE ward_flow\.(\w+) DISABLE ROW LEVEL SECURITY/gi)].map((m) => m[1]),
  );
  const runtimeOnly = new RegExp(
    `^USING \\(current_user = '${RUNTIME_ROLE}'\\) WITH CHECK \\(current_user = '${RUNTIME_ROLE}'\\)$`,
  );
  const policed = new Set<string>();
  const nonRuntimePolicies: string[] = [];
  for (const match of all.matchAll(/CREATE POLICY (\w+) ON ward_flow\.(\w+)\s+([^;]*);/gi)) {
    const body = match[3].replace(/\s+/g, " ").trim();
    if (runtimeOnly.test(body)) policed.add(match[2]);
    else nonRuntimePolicies.push(`${match[2]}.${match[1]}: ${body}`);
  }
  const browserGrants: string[] = [];
  for (const match of all.matchAll(/\bGRANT\s+[^;]*?\bTO\s+([^;]+);/gi)) {
    for (const grantee of match[1].split(",").map((name) => name.trim().replace(/^"|"$/g, ""))) {
      if (!ALLOWED_GRANTEES.has(grantee)) browserGrants.push(`${grantee}: ${match[0].replace(/\s+/g, " ")}`);
    }
  }
  const membership = /CREATE TABLE ward_flow\.memberships[\s\S]*?role text NOT NULL CHECK \(role IN \(([^)]*)\)\)/.exec(
    migrations.join("\n"),
  );
  const tables = [...created].sort();
  return {
    tables,
    withoutRls: tables.filter((table) => !rls.has(table) || disabled.has(table)),
    nonRuntimePolicies,
    tablesWithoutPolicy: tables.filter((table) => !policed.has(table)),
    browserGrants,
    membershipRoles: membership ? [...membership[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).sort() : [],
  };
}

/** True when no app role can reach any row except through the backend's runtime role. */
export function databaseDefersToBackend(facts: DatabaseFacts): boolean {
  return (
    facts.tables.length > 0 &&
    facts.withoutRls.length === 0 &&
    facts.nonRuntimePolicies.length === 0 &&
    facts.tablesWithoutPolicy.length === 0 &&
    facts.browserGrants.length === 0
  );
}

export type Cell = Record<LayerId, Verdict> & { engineProbed: boolean };
export type Matrix = {
  desks: Desk[];
  actions: EventType[];
  cells: Record<string, Record<string, Cell>>;
  database: DatabaseFacts;
};

export function collectPermissionMatrix(): Matrix {
  const deskList = desks();
  const actions = (Object.keys(EVENT_ROLE) as EventType[]).sort();
  const database = readDatabaseFacts();
  const databaseVerdict: Verdict = databaseDefersToBackend(database) ? "defer" : "allow";
  const cells: Matrix["cells"] = {};
  for (const action of actions) {
    cells[action] = {};
    for (const desk of deskList) {
      const engine = engineVerdict(desk, action);
      const backend = backendAnswer(desk, action);
      cells[action][desk.id] = {
        screen: screenVerdict(desk, action),
        // L11: the reducer holds no desk or place, so it answers the role alone. Where the backend
        // refuses only the desk's place, the engine decides nothing for that cell.
        engine: backend.placeOnly && engine.verdict === "allow" ? "defer" : engine.verdict,
        backend: backend.verdict,
        database: databaseVerdict,
        engineProbed: engine.probed,
      };
    }
  }
  return { desks: deskList, actions, cells, database };
}

/** Each cell whose deciding layers do not all give the same answer. `defer` decides nothing. */
export function disagreements(matrix: Matrix): { action: EventType; desk: string; answers: string }[] {
  const found: { action: EventType; desk: string; answers: string }[] = [];
  for (const action of matrix.actions) {
    for (const desk of matrix.desks) {
      const cell = matrix.cells[action][desk.id];
      const decided = new Set(LAYERS.map((layer) => cell[layer]).filter((verdict) => verdict !== "defer"));
      if (decided.size > 1)
        found.push({ action, desk: desk.id, answers: LAYERS.map((layer) => `${layer} ${cell[layer]}`).join(", ") });
    }
  }
  return found;
}

function expectedFor(action: string, desk: string) {
  return EXPECTED_DISAGREEMENTS.find((entry) => entry.action === action && entry.desk === desk);
}

function renderRaw(matrix: Matrix): string {
  const symbol = (cell: Cell, action: string, desk: string) => {
    const mark = cell.backend === "allow" ? "Y" : "-";
    return expectedFor(action, desk) ? `${mark} !` : mark;
  };
  const unprobed = matrix.actions.flatMap((action) => {
    const desks = matrix.desks.filter((desk) => !matrix.cells[action][desk.id].engineProbed).map((desk) => desk.id);
    return desks.length === 0 ? [] : [`\`${action}\` (${desks.join(", ")})`];
  });
  const unprobedCells = matrix.actions.reduce(
    (count, action) => count + matrix.desks.filter((desk) => !matrix.cells[action][desk.id].engineProbed).length,
    0,
  );
  const found = disagreements(matrix);
  const db = matrix.database;
  const lines = [
    "# Ward Flow permission matrix",
    "",
    "> **Generated. Do not edit by hand.** `node scripts/run-tsx.mjs scripts/ward-flow/permission-matrix.ts`;",
    "> `--check` fails when this file is stale. `tests/ward-permission-matrix.test.ts` fails on a stale file or on",
    "> any layer disagreement not listed below. Audit 7, issue #1570.",
    "",
    "Who may take each action, by desk, in the shared (signed-in) workspace with synthetic data. `Y` means every",
    "layer that decides lets the desk take the action; `-` means every such layer refuses it; `!` marks a known",
    "disagreement listed under [Known disagreements](#known-disagreements). A `Y` is about the role only: the backend",
    "and the reducer still limit each desk to records in its own place.",
    "",
    "## Layers",
    "",
    "| Layer | Source of truth | How it is asked |",
    "| --- | --- | --- |",
    "| Screen | `dispatchPermission` (`ward-role-permissions.ts`) for the shell role (`chromeRoleForAccess`); demo controls from the server's `demoControls` flag; the access admin's site switch from `mayChangeSiteFeatures` (D-142); the place gates on settings, outages, site switches and the site sign-off (`SCREEN_PLACE_GATES`, L11); no role shows the ask-for-access gate | Called per cell |",
    "| Engine | `EVENT_ROLE` (`ward-flow-event-roles.ts`) as enforced by `wardFlowReducer` | Reducer run on the synthetic seed with a bare event |",
    "| Backend | `deskCommand`, the role clause of `validSharedCommand` and `commandRefusal` (`backend/ward-flow/engine.ts`): the role refusal, and a place refusal that holds whatever record is named (`FIXED_PLACE_REFUSALS`, L11); no role is refused 403 in `shared-http.mjs` | Called per cell |",
    "| Database | Row level security policies and grants in `backend/ward-flow/migrations/` and `infra/` | SQL read as text |",
    "",
    `**${matrix.actions.length} actions x ${matrix.desks.length} desks = ${matrix.actions.length * matrix.desks.length} cells.**`,
    "",
    "## Matrix",
    "",
    `| Action | ${matrix.desks.map((desk) => desk.label).join(" | ")} |`,
    `| --- | ${matrix.desks.map(() => ":-:").join(" | ")} |`,
    ...matrix.actions.map(
      (action) =>
        `| \`${action}\` | ${matrix.desks.map((desk) => symbol(matrix.cells[action][desk.id], action, desk.id)).join(" | ")} |`,
    ),
    "",
    "## Database",
    "",
    databaseDefersToBackend(db)
      ? `Every one of the ${db.tables.length} \`ward_flow\` tables has row level security with the \`runtime_only\` policy (the \`${RUNTIME_ROLE}\` role alone), and no grant names a browser role. No app role reaches a row except through the backend, so the database defers every cell to the backend column.`
      : "**The database does not defer every row to the backend.** See the test output for the table, policy or grant.",
    "",
    `Membership roles the database accepts: ${db.membershipRoles.map((role) => `\`${role}\``).join(", ")}.`,
    "",
    "## Known disagreements",
    "",
    ...(found.length === 0
      ? ["None. Every deciding layer gives the same answer for every action and desk."]
      : found.map((entry) => {
          const known = expectedFor(entry.action, entry.desk);
          return `- \`${entry.action}\`, ${entry.desk}: ${entry.answers}.${known ? ` To do: ${known.todo}` : " Not yet listed."}`;
        })),
    "",
    "## Not covered",
    "",
    `- **Engine, ${unprobedCells} cells read statically.** For these actions and desks the reducer throws on a bare event (it reads the payload before it answers), so the engine cell falls back to \`EVENT_ROLE\`, the table the reducer's role gate reads: ${unprobed.join(", ")}.`,
    "- **Screen gates written by hand.** Controls that check a role directly rather than through `useRoleGate` (for example `wardTasksAreActionableForRole`, `noticeIsMarkableByChrome`, `canBreakGlass` and screens rendered only on their own route) are not read here. `tests/ward-role-permissions.test.ts` pins the route-only screens to `EVENT_ROLE`.",
    "- **A coordinator on another desk's route.** On a ward, ED, community or officer route a coordinator's screen acts as that route's role; the backend records the change as the coordinator's (`deskCommand`). The matrix asks the coordinator's own desk.",
    "- **Place and record checks.** `commandScopeRefusal` and the reducer's own-unit narrowing need real records; the consolidated authority tests cover them.",
    "- **Local demo without sign-in.** With no shared workspace every desk is a preview and the demo controls are on for all; this matrix is the signed-in workspace.",
    "- **Demo controls** assume the server's `sharedDemoEvents` setting is on; with it off every desk is refused them.",
    "",
  ];
  return lines.join("\n");
}

export async function renderPermissionMatrix(matrix = collectPermissionMatrix()): Promise<string> {
  return format(renderRaw(matrix), { parser: "markdown", printWidth: 120 });
}

async function main() {
  const expected = await renderPermissionMatrix();
  if (process.argv.includes("--check")) {
    const current = existsSync(MATRIX_PATH) ? readFileSync(MATRIX_PATH, "utf8") : "";
    if (current !== expected) {
      console.error(
        "docs/ward-flow/permission-matrix.md is stale. Run `node scripts/run-tsx.mjs scripts/ward-flow/permission-matrix.ts`.",
      );
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(MATRIX_PATH, expected, "utf8");
  console.log("Updated docs/ward-flow/permission-matrix.md");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
