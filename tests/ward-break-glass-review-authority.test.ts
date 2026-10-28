import { describe, expect, it } from "vitest";
import { applyCommand, commandRefusal, scopeWorld, seedWorld, validWorld } from "../backend/ward-flow/engine";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { unitHealthService } from "../src/components/ward-management/ward-service-scope";
import { UNDO_WINDOW_MINUTES } from "../src/components/ward-management/ward-undo";

const at = new Date("2026-10-27T04:00:00Z");
const ownOpening = "audit-break-glass-21";
const foreignOpening = "audit-break-glass-22";

function reviewedWorld() {
  let world = seedWorld(at);
  for (const eventId of [ownOpening, foreignOpening]) {
    const reviewed = applyCommand(
      world,
      {
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        eventId,
        expectedGeneration: world.state.worldGeneration,
        expectedReviewCount: 0,
        decision: "reviewed",
      },
      at,
    );
    expect(reviewed.outcome).toBe("accepted");
    world = reviewed.world;
  }
  expect(validWorld(world)).toBe(true);
  const access: WardAccess = {
    role: "coordinator",
    scope: { kind: "service", service: unitHealthService(world.state.units[0])! },
  };
  const undo = (reviewId: string) => ({
    type: "UNDO_AUDIT_REVIEW",
    role: "coordinator",
    reviewId,
    expectedGeneration: world.state.worldGeneration,
  });
  return { world, access, undo };
}

describe("server-resolved break glass review authority", () => {
  it("threads the opening allowlist through the final shared-world projection", () => {
    const { world, access } = reviewedWorld();
    expect(scopeWorld(world, access, at).state.auditReviews).toEqual([]);
    expect(scopeWorld(world, access, at, [], [ownOpening]).state.auditReviews).toEqual([world.state.auditReviews[0]]);
    expect(scopeWorld(world, access, at, [], [foreignOpening]).state.auditReviews).toEqual([
      world.state.auditReviews[1],
    ]);
    expect(scopeWorld(world, STATEWIDE_COORDINATOR, at)).toBe(world);
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [world.state.units[0].id] } };
    expect(scopeWorld(world, ward, at, [], [ownOpening]).state.auditReviews).toEqual([]);
  });

  it("authorises only a held review in the supplied server scope and ignores command-supplied authority", () => {
    const { world, access, undo } = reviewedWorld();
    const own = undo(world.state.auditReviews[0].id);
    const foreign = undo(world.state.auditReviews[1].id);
    expect(commandRefusal(world, access, own, at, [], [ownOpening])).toBeNull();
    const refusal = commandRefusal(world, access, foreign, at, [], [ownOpening]);
    expect(refusal).toMatch(/outside/);
    expect(commandRefusal(world, access, undo("audit-review-absent"), at, [], [ownOpening])).toBe(refusal);
    expect(commandRefusal(world, access, own, at)).toBe(refusal);
    expect(commandRefusal(world, access, { ...foreign, reviewableBreakGlassEventIds: [foreignOpening] }, at)).toBe(
      refusal,
    );
  });

  it("preserves recent own-service undo while refusing a review after its scope is lost", () => {
    const { world, access, undo } = reviewedWorld();
    const command = undo(world.state.auditReviews[0].id);
    expect(commandRefusal(world, access, command, at, [], [ownOpening])).toBeNull();
    const undone = applyCommand(world, command, at);
    expect(undone.outcome).toBe("accepted");
    expect(undone.world.state.auditReviews).toEqual([world.state.auditReviews[1]]);
    expect(commandRefusal(world, access, command, at, [], [])).toMatch(/outside/);
  });

  it("retains the real undo clock, generation and latest-review protections", () => {
    const { world, access, undo } = reviewedWorld();
    const command = undo(world.state.auditReviews[0].id);
    const expired = new Date(at.getTime() + (UNDO_WINDOW_MINUTES + 1) * 60_000);
    expect(commandRefusal(world, access, command, expired, [], [ownOpening])).toBeNull();
    expect(applyCommand(world, command, expired).outcome).toBe("denied");
    expect(applyCommand(world, { ...command, expectedGeneration: world.state.worldGeneration + 1 }, at).outcome).toBe(
      "denied",
    );
    const later = applyCommand(
      world,
      {
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        eventId: ownOpening,
        expectedGeneration: world.state.worldGeneration,
        expectedReviewCount: 1,
        decision: "follow-up-required",
      },
      at,
    );
    expect(later.outcome).toBe("accepted");
    expect(applyCommand(later.world, command, at).outcome).toBe("denied");
  });
});
