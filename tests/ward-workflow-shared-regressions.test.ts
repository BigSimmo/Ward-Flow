import { describe, expect, it } from "vitest";
import { applyCommand, seedWorld, scopeWorld } from "../backend/ward-flow/engine";
import { SharedWorkspaceClient, type SharedSnapshot } from "@/components/ward-management/ward-shared-client";
import { commandMetadata } from "@/components/ward-management/ward-command-metadata";
import { localCommandOutcome } from "@/components/ward-management/use-local-command-completion";
import { applyFirstAccepted, RECEIVE_REFERRAL_CANDIDATE } from "./helpers/ward-legal-figure-sweep";

const at = new Date("2026-10-19T10:00:00Z");

describe("command-owned opaque completion metadata", () => {
  it("returns no completion fields for a referral-creating command and no private dossier", () => {
    const world = seedWorld(at);
    const event = { ...RECEIVE_REFERRAL_CANDIDATE, type: "RECEIVE_REFERRAL", role: "community", now: 642 } as const;
    const result = applyCommand(world, event, at);
    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("fixture refused");
    expect(result.completion).toEqual({});
    const cloned = JSON.parse(JSON.stringify(result.world.state));
    expect(commandMetadata(world.state, cloned)).toEqual({});
    expect(localCommandOutcome(world.state, result.world.state)).not.toHaveProperty("createdReferralId");
    expect(commandMetadata(cloned, cloned)).toEqual({});
  });

  it("returns this ED step's sequence while scoped state still excludes private Undo snapshots", () => {
    const world = seedWorld(at);
    const candidate = applyFirstAccepted("RECORD_ARRIVED_IN_DEPARTMENT", world.state, 642);
    expect(candidate).toBeDefined();
    if (!candidate) throw new Error("fixture produced no accepted RECORD_ARRIVED_IN_DEPARTMENT candidate");
    const result = applyCommand(world, candidate.event, at);
    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("fixture refused");
    expect(result.completion.undoStep).toMatchObject({ undoType: "UNDO_ED_STEP", seq: expect.any(Number) });
    expect(Object.keys(result.completion.undoStep!)).toEqual(["undoType", "subjectId", "seq"]);
    const scoped = scopeWorld(result.world, { role: "ed", scope: { kind: "ed", edId: "rph-ed" } }, at);
    expect(scoped.state.undoRecords).toEqual([]);
    expect(commandMetadata(result.world.state, result.world.state)).toEqual({});
  });

  it("carries only explicit completion fields from an accepted scoped HTTP reply", async () => {
    const world = seedWorld(at);
    const snapshot = (revision: number): SharedSnapshot => ({
      dataMode: "prototype",
      revision,
      now: 642,
      payload: world,
    });
    const undoStep = { undoType: "UNDO_ED_STEP", subjectId: "WF-009", seq: 42 } as const;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "mock",
      changed: () => {},
      fetch: async (_url, options) =>
        Response.json(
          options?.body
            ? { snapshot: snapshot(2), createdReferralId: "RF-new", undoStep, privateServerField: "must not escape" }
            : { snapshot: snapshot(1) },
        ),
    });
    await client.refresh();
    const result = await client.dispatchConfirmed({
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: 642,
      unitId: "scgh-adult-open",
    });
    expect(result).toMatchObject({ status: "accepted", undoStep });
    expect(result).not.toHaveProperty("createdReferralId");
    expect(result).not.toHaveProperty("snapshot");
    expect(result).not.toHaveProperty("privateServerField");
    client.dispose();
  });
});
