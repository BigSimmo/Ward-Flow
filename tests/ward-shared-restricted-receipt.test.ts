import { expect, it } from "vitest";
import { SharedWorkspaceClient, type SharedView } from "@/components/ward-management/ward-shared-client";
import { applyCommand, commandRefusal, scopeWorld, seedWorld } from "../backend/ward-flow/engine";

it("uses real ward scope for delayed receipt, refusal, uncertain retry and scope retirement", async () => {
  const at = new Date("2026-11-04T10:00:00Z");
  let world = seedWorld(at),
    revision = 1,
    serial = 0;
  const unitId = world.state.units[0].id;
  const access = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } } as const;
  let view!: SharedView;
  let drop = false,
    release: (() => void) | undefined;
  let hold: Promise<void> | undefined;
  const sent: string[] = [];
  const snapshot = () => ({ dataMode: "prototype", revision, now: 642, payload: scopeWorld(world, access, at) });
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
    commandId: () => `synthetic-${++serial}`,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, init) => {
      if (!init?.body) return Response.json({ snapshot: snapshot(), access });
      const body = JSON.parse(String(init.body));
      sent.push(body.commandId);
      if (drop) throw new TypeError("Synthetic lost response");
      await hold;
      const event = body.event ?? body.command;
      const refused = commandRefusal(world, access, event, at);
      if (refused) return Response.json({ snapshot: snapshot(), error: refused }, { status: 422 });
      const result = applyCommand(world, event, at);
      if (result.outcome === "denied")
        return Response.json({ snapshot: snapshot(), error: result.reason }, { status: 422 });
      world = result.world;
      revision++;
      return Response.json({ snapshot: snapshot(), outcome: "accepted" });
    },
  });
  const command = () =>
    ({
      type: "CONFIRM_CAPACITY",
      now: 642,
      role: "ward",
      unitId,
      actingUnitId: unitId,
      value: world.state.units[0].allocatable.value,
      expectedRevision: world.state.units[0].allocatable.revision ?? 0,
    }) as const;
  try {
    await client.refresh();
    expect(view.eventLog ?? []).toEqual([]);
    expect(view.snapshot!.payload.state).not.toEqual(world.state);
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    const pending = client.dispatchConfirmed(command()).then((answer) => {
      finished = true;
      return answer;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    release!();
    hold = undefined;
    const accepted = await pending;
    expect(accepted.status).toBe("accepted");
    const outside = world.state.units.find((unit) => unit.id !== unitId)!;
    expect(
      (await client.dispatchConfirmed({ ...command(), unitId: outside.id, actingUnitId: outside.id })).status,
    ).toBe("refused");
    drop = true;
    const uncertain = await client.dispatchConfirmed(command());
    expect(uncertain.status).toBe("failed");
    drop = false;
    await client.retry();
    await expect(uncertain.confirmation).resolves.toMatchObject({ commandId: uncertain.commandId, status: "accepted" });
    expect(sent.at(-1)).toBe(uncertain.commandId);
    drop = true;
    const retiring = await client.dispatchConfirmed(command());
    client.switchRole();
    await expect(retiring.confirmation).resolves.toMatchObject({ status: "cancelled" });
    expect(accepted.isCurrent?.()).toBe(false);
  } finally {
    client.dispose();
  }
});
