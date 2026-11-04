import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const seed = seedWardFlowStateAt(0);
const patientId = seed.patients[0].id;
function payload(generation: number): SharedSnapshot["payload"] {
  const state = structuredClone(seed);
  state.worldGeneration = generation;
  for (const patient of state.patients) {
    delete patient.address;
    delete patient.interpreterLanguage;
  }
  return { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" };
}

describe("record detail belongs to a workspace generation", () => {
  it.each([false, true])("rejects old details after reset, late reply=%s", async (late) => {
    let generation = 0;
    let view: SharedView | undefined;
    let complete: ((response: Response) => void) | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-test",
      changed: (next) => {
        view = next;
      },
      fetch: async (input) => {
        if (new URL(String(input)).pathname === "/v1/workspace/record-access") {
          if (late)
            return new Promise<Response>((resolve) => {
              complete = resolve;
            });
          return Response.json({
            opened: patientId,
            detail: { address: "Synthetic address", interpreterLanguage: "Synthetic language" },
          });
        }
        return Response.json({
          snapshot: {
            dataMode: "prototype",
            revision: generation + 1,
            now: 642,
            accessContext: "a".repeat(64),
            payload: payload(generation),
          },
        });
      },
    });
    const shown = () => view?.snapshot?.payload.state.patients.find((patient) => patient.id === patientId);
    try {
      await client.refresh();
      const opening = client.logRecordView(patientId, "patient");
      if (!late) {
        expect(await opening).toBe(true);
        await client.refresh();
        expect(shown()?.address).toBe("Synthetic address");
      } else {
        while (!complete) await Promise.resolve();
      }
      generation = 1;
      await client.refresh();
      if (late) {
        complete!(Response.json({ opened: patientId, detail: { address: "Synthetic address" } }));
        expect(await opening).toBe(false);
      }
      expect(shown()?.address).toBeUndefined();
      expect(shown()?.interpreterLanguage).toBeUndefined();
    } finally {
      client.dispose();
    }
  });
});
