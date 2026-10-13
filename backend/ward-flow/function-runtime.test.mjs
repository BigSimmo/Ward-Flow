import assert from "node:assert/strict";
import { test } from "node:test";
import { createFunctionRuntime } from "./function-runtime.mjs";

for (const databaseProvider of ["azure", "supabase", "postgres"]) {
  test(`Function host delegates ${databaseProvider} configuration without choosing an identity`, async () => {
    const config = { databaseProvider, authProvider: "supabase" };
    let starts = 0;
    const sharedStore = {};
    const handler = async () => new Response("synthetic");
    const runtime = createFunctionRuntime({
      readConfig: () => config,
      createBackend: async (received) => {
        assert.equal(received, config);
        starts++;
        return { sharedStore };
      },
      createHandler: (backend) => {
        assert.equal(backend.sharedStore, sharedStore);
        return handler;
      },
    });
    const handlers = await Promise.all([runtime.getHandler(), runtime.getHandler()]);
    assert.deepEqual(handlers, [handler, handler]);
    assert.equal(starts, 1);
    assert.equal(runtime.getSharedStore(), sharedStore);
  });
}

test("Function startup failures clear the pending attempt and permit a later retry", async () => {
  let starts = 0;
  const handler = () => {};
  const runtime = createFunctionRuntime({
    readConfig: () => ({}),
    createBackend: async () => {
      if (++starts === 1) throw new Error("synthetic startup fault");
      return {};
    },
    createHandler: () => handler,
  });
  await assert.rejects(runtime.getHandler(), /startup fault/);
  assert.equal(await runtime.getHandler(), handler);
  assert.equal(starts, 2);
});

test("Function handler construction failure closes its created pool before retry", async () => {
  let closed = 0;
  const runtime = createFunctionRuntime({
    readConfig: () => ({}),
    createBackend: async () => ({
      pool: {
        end: async () => {
          closed++;
        },
      },
    }),
    createHandler: () => {
      throw new Error("synthetic handler fault");
    },
  });
  await assert.rejects(runtime.getHandler(), /handler fault/);
  assert.equal(closed, 1);
  assert.equal(runtime.getSharedStore(), undefined);
});
