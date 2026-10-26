// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSharedHandler } from "./shared-http.mjs";

// Part B item 49 (26 October 2026): groundwork for signing in with a second step. The check is off
// by default and changes nothing until the health service's sign-in or Supabase factors exist.
const actor = "11111111-1111-4111-8111-111111111111";
const request = (path, method = "GET") =>
  new Request(`https://example.test/v1/workspace${path}`, { method, headers: { authorization: "Bearer synthetic" } });
function handler({ requireSecondStep, secondStep }) {
  return createSharedHandler({
    config: { coordinatorIds: [actor], workspaceId: "synthetic-workspace" },
    store: {
      sessionLimitMinutes: 720,
      viewer: async () => ({
        status: "ok",
        actorId: actor,
        membershipId: null,
        access: { role: "coordinator", scope: { kind: "statewide" } },
        grants: [],
      }),
    },
    authenticate: async (_token, context) => {
      context.session.startedAt = Date.now() - 60_000;
      if (secondStep !== undefined) context.session.secondStep = secondStep;
      return actor;
    },
    readBody: async (incoming) => incoming.json(),
    verifierUnavailable: Error,
    requireSecondStep,
    log: () => {},
  });
}
const refusedForSecondStep = async (response) =>
  response.status === 401 && (await response.clone().json()).code === "second-step-required";

test("off by default: a sign-in without a second step is served as before", async () => {
  const serve = handler({ requireSecondStep: undefined, secondStep: false });
  assert.equal(await refusedForSecondStep(await serve(request(""))), false);
});

test("when switched on, a sign-in without a second step is asked to finish signing in", async () => {
  const serve = handler({ requireSecondStep: true, secondStep: false });
  const response = await serve(request(""));
  assert.equal(await refusedForSecondStep(response), true);
  assert.equal((await response.json()).error, "Finish signing in with your second step, then carry on.");
  // A token that says nothing about a second step fails closed too.
  assert.equal(
    await refusedForSecondStep(await handler({ requireSecondStep: true, secondStep: undefined })(request(""))),
    true,
  );
});

test("when switched on, a sign-in that finished its second step is served", async () => {
  const serve = handler({ requireSecondStep: true, secondStep: true });
  assert.equal(await refusedForSecondStep(await serve(request(""))), false);
});

test("signing out and turning phone alerts off still work without a second step", async () => {
  const serve = handler({ requireSecondStep: true, secondStep: false });
  const signOut = await serve(request("/sign-out", "POST"));
  assert.equal(signOut.status, 200);
  assert.equal(await refusedForSecondStep(await serve(request("/push-unsubscribe", "POST"))), false);
});
