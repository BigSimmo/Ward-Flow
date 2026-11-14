// H1 (mechanics and clock audit, 14 Nov 2026; D-210 (Josh, 14 Nov 2026), ruling 1): a save that
// waited is recorded at the board minute the person acted, within bounds, or refused; a save that
// arrives at once, or from an older app with no acted time, is stamped by the server as before.
import { describe, expect, it } from "vitest";
import { applyCommand, seedWorld, worldNow } from "../backend/ward-flow/engine";
import { buildHistoryEntry } from "@/components/ward-management/ward-history";
import { enteredOfflineLog, eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

const made = new Date("2026-11-14T02:00:00Z"); // 10:00 Perth
const minutes = (count: number) => new Date(made.getTime() + count * 60_000);

function confirmCount() {
  const world = seedWorld(made);
  const unit = world.state.units.find((candidate) => candidate.empty.value < candidate.beds)!;
  const event = (now: number, value = unit.empty.value + 1) => ({
    type: "CONFIRM_CAPACITY",
    role: "ward",
    now,
    unitId: unit.id,
    actingUnitId: unit.id,
    expectedRevision: unit.allocatable.revision ?? 0,
    value,
  });
  return { world, unit, event, actedAt: worldNow(world, made) };
}

describe("offline entry time (H1)", () => {
  it("keeps the minute the person acted for a save sent 40 minutes later, and says when it was sent", () => {
    const { world, unit, event, actedAt } = confirmCount();
    const result = applyCommand(world, event(actedAt), minutes(40), { actedAt });
    expect(result.outcome).toBe("accepted");
    const confirmed = result.world.state.units.find((candidate) => candidate.id === unit.id)!.allocatable;
    expect(confirmed.confirmedAt).toBe(actedAt);
    expect(result.completion).toMatchObject({ enteredOffline: { actedAt, sentAt: actedAt + 40 } });
    expect(result.changes).toMatchObject({ enteredOffline: { actedAt, sentAt: actedAt + 40 } });
  });

  it("stamps an older app's save (no acted time) with the server's time, as before", () => {
    const { world, unit, event, actedAt } = confirmCount();
    const result = applyCommand(world, event(actedAt), minutes(40));
    expect(result.outcome).toBe("accepted");
    expect(result.world.state.units.find((candidate) => candidate.id === unit.id)!.allocatable.confirmedAt).toBe(
      actedAt + 40,
    );
    expect(result.completion).not.toHaveProperty("enteredOffline");
  });

  it("stamps an ordinary save (sent within a minute) with the server's time", () => {
    const { world, unit, event, actedAt } = confirmCount();
    const result = applyCommand(world, event(actedAt), minutes(1), { actedAt });
    expect(result.world.state.units.find((candidate) => candidate.id === unit.id)!.allocatable.confirmedAt).toBe(
      actedAt + 1,
    );
    expect(result.completion).not.toHaveProperty("enteredOffline");
    // A board ahead of the server is not a waiting save either: the server's own time.
    const ahead = applyCommand(world, event(actedAt), made, { actedAt: actedAt + 5 });
    expect(ahead.world.state.units.find((candidate) => candidate.id === unit.id)!.allocatable.confirmedAt).toBe(
      actedAt,
    );
  });

  it("refuses a waiting save made before the record last changed, and asks for it again", () => {
    const { world, unit, event, actedAt } = confirmCount();
    // Another desk confirmed this ward's count at 10:20.
    const other = applyCommand(world, event(actedAt + 20, unit.empty.value), minutes(20));
    expect(other.outcome).toBe("accepted");
    // Even with the count's latest revision, a step entered before that change is refused.
    const revision = other.world.state.units.find((candidate) => candidate.id === unit.id)!.allocatable.revision ?? 0;
    const late = applyCommand(other.world, { ...event(actedAt), expectedRevision: revision }, minutes(45), {
      actedAt,
    });
    expect(late.outcome).toBe("denied");
    expect(late.reason).toBe(
      "This change was entered offline at 10:00, before the record last changed at 10:20. Review the record and enter it again",
    );
    expect(late.world).toBe(other.world);
  });

  it("records a handover sign-off made offline at 10:00 and sent at 10:45 at 10:00", () => {
    const created = new Date("2026-11-13T00:30:00Z");
    const world = seedWorld(created);
    const actedAt = worldNow(world, new Date("2026-11-13T02:00:00Z"));
    const result = applyCommand(
      world,
      { type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: actedAt },
      new Date("2026-11-13T02:45:00Z"),
      { actedAt },
    );
    expect(result.outcome).toBe("accepted");
    expect(result.world.state.handoverSignOffs.at(-1)!.at).toBe(actedAt);
  });

  it("refuses a waiting save entered more than 12 hours ago, or at an impossible minute", () => {
    const created = new Date("2026-11-13T00:30:00Z");
    const world = seedWorld(created);
    const sentAt = worldNow(world, new Date("2026-11-13T23:00:00Z"));
    for (const actedAt of [sentAt - 12 * 60 - 1, 0, -5]) {
      const result = applyCommand(
        world,
        { type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: actedAt },
        new Date("2026-11-13T23:00:00Z"),
        { actedAt },
      );
      expect(result.outcome).toBe("denied");
      expect(result.reason).toMatch(
        /^This change was entered offline more than 12 hours ago, at .+\. Review the record and enter it again$/,
      );
      expect(result.world).toBe(world);
    }
    const edge = applyCommand(
      world,
      { type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: sentAt - 12 * 60 },
      new Date("2026-11-13T23:00:00Z"),
      { actedAt: sentAt - 12 * 60 },
    );
    expect(edge.outcome).toBe("accepted");
  });

  it("never applies an acted time to the demo controls", () => {
    const world = seedWorld(made);
    const actedAt = worldNow(world, made);
    const result = applyCommand(
      world,
      { type: "ADVANCE_CLOCK", role: "demo", now: actedAt, minutes: 15 },
      minutes(30),
      {
        actedAt,
      },
    );
    expect(result.outcome).toBe("accepted");
    expect(result.completion).not.toHaveProperty("enteredOffline");
  });

  it("History says the step was entered offline and when it was sent", () => {
    const event = {
      type: "RECORD_LEAVING",
      role: "ward",
      now: 600,
      admissionId: "adm-synthetic-1",
    } as unknown as WardFlowEvent;
    const entry = { ...eventLogEntryFor(event, true), ...enteredOfflineLog({ actedAt: 600, sentAt: 645 }) };
    expect(entry).toMatchObject({ now: 600, sentAt: 645 });
    const row = buildHistoryEntry(entry as unknown as WardFlowEvent, 700);
    expect(row.time).toBe("10:00");
    expect(row.summary).toBe("Patient departed ward (entered offline, sent 10:45)");
    // A note that does not make sense is not shown.
    expect(enteredOfflineLog({ actedAt: 645, sentAt: 600 })).toEqual({});
    expect(enteredOfflineLog(undefined)).toEqual({});
  });
});
