// @ts-check
// H-0057: bootstrap coordinators (WARD_COORDINATOR_USER_IDS) can be given an end date.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "./config.mjs";
import { bootstrapCoordinators } from "./auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const environment = {
  WARD_COORDINATOR_USER_IDS: coordinator,
  WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
  WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
  WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
};
const now = () => Date.UTC(2026, 9, 26, 8);

test("the end date runs to the end of that Perth day", () => {
  const config = readConfig({ ...environment, WARD_COORDINATOR_UNTIL: "2026-12-31" }, { now });
  // Midnight starting 1 January 2027 in Perth is 16:00 UTC on 31 December.
  assert.equal(config.coordinatorUntil, Date.UTC(2026, 11, 31, 16));
  assert.deepEqual(bootstrapCoordinators(config, Date.UTC(2026, 11, 31, 15, 59)), [coordinator]);
  assert.deepEqual(bootstrapCoordinators(config, Date.UTC(2026, 11, 31, 16)), []);
});

test("no end date keeps the bootstrap list and warns in shared mode only", () => {
  const events = [];
  const local = readConfig(environment, { log: (event) => events.push(event) });
  assert.equal(local.coordinatorUntil, null);
  assert.deepEqual(bootstrapCoordinators(local, Date.UTC(2099, 0, 1)), [coordinator]);
  assert.equal(events.length, 0);
});

test("a malformed date or one more than a year ahead fails closed", () => {
  for (const value of ["31/12/2026", "2026-02-30", "2026-13-01", "2028-01-01", "soon"])
    assert.throws(
      () => readConfig({ ...environment, WARD_COORDINATOR_UNTIL: value }, { now }),
      /Invalid coordinator end date configuration/,
      value,
    );
  // A date already past is allowed, so a restart after the end does not stop the server.
  assert.deepEqual(
    bootstrapCoordinators(readConfig({ ...environment, WARD_COORDINATOR_UNTIL: "2026-01-01" }, { now }), now()),
    [],
  );
});
