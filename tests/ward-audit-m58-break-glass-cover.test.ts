import { describe, expect, it } from "vitest";

import {
  BREAK_GLASS_MINUTES,
  BREAK_GLASS_REASON_IDS,
  COVER_REASON_IDS,
  breakGlassRefusal,
  coverAccess,
  coverRefusal,
  scopeWorld,
  seedWorld,
  withCover,
  worldNow,
} from "../backend/ward-flow/engine";
import {
  coverEvents,
  localCovers,
  serverCovers,
  serverOpenings,
} from "../src/components/ward-management/governance-access-review";
import {
  endDueCovers,
  giveCover,
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
} from "../src/components/ward-management/shell/ward-access-store";
import { isBreakGlassReviewId } from "../src/components/ward-management/ward-break-glass-review-id";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { WARD_ACCESS_ROLES } from "../src/components/ward-management/ward-role-access";

/**
 * Master audit M58 (10 Nov 2026): break glass and cover, checked against D-66 and D-80. One block per
 * access type: scoped, has a reason, expires (also mid-session) and lands on the review list.
 * Offline and synthetic. The same rules against a real PostgreSQL run in
 * `backend/ward-flow/postgres.test.mjs` ("roles come from memberships", "cover, requests for access",
 * "shared views follow cover changes"). Idempotency is owned by another thread and not tested here.
 */
const at = new Date("2026-10-20T10:00:00Z");
const world = seedWorld(at);
const unitA = world.state.units[0]!;
const unitB =
  world.state.units.find((u) => u.siteCode === unitA.siteCode && u.id !== unitA.id) ?? world.state.units[1]!;
const nurseA: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitA.id] } };
const nurseB: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitB.id] } };
const seenBy = (access: WardAccess, grants = [] as { patientId: string; until: Date }[], when = at) =>
  new Set(scopeWorld(world, access, when, grants).state.patients.map((p) => p.id));
const outsider = world.state.patients.find((p) => !seenBy(nurseA).has(p.id))!;

describe("M58 break glass", () => {
  it("is scoped: clinical desks only, one existing patient outside its care, never one already in it", () => {
    for (const role of WARD_ACCESS_ROLES) {
      const refused = breakGlassRefusal(world, { ...nurseA, role } as WardAccess, outsider.id, at);
      if (["officer", "executive", "admin", "coordinator"].includes(role)) expect(refused, role).not.toBeNull();
    }
    expect(breakGlassRefusal(world, nurseA, outsider.id, at)).toBeNull();
    const inCare = [...seenBy(nurseA)][0]!;
    expect(breakGlassRefusal(world, nurseA, inCare, at)).not.toBeNull();
    // An unknown id gets the same reply as one in care, so the form names nobody (D-80).
    expect(breakGlassRefusal(world, nurseA, "PT-SYN-NOBODY", at)).toBe(breakGlassRefusal(world, nurseA, inCare, at));
    // The grant opens that one person and no other.
    const opened = seenBy(nurseA, [{ patientId: outsider.id, until: new Date(at.getTime() + 60_000) }]);
    const added = [...opened].filter((id) => !seenBy(nurseA).has(id));
    expect(added).toEqual([outsider.id]);
  });

  it("needs a reason from the list", () => {
    // The server refuses any other reason before it opens a transaction:
    // backend/ward-flow/ward-audit-m58-break-glass-reason.test.mjs.
    expect(BREAK_GLASS_REASON_IDS.length).toBeGreaterThan(1);
    expect(BREAK_GLASS_REASON_IDS).not.toContain("");
  });

  it("expires mid-session: the same desk loses the record on the first read after the window ends", () => {
    const until = new Date(at.getTime() + BREAK_GLASS_MINUTES * 60_000);
    const grant = [{ patientId: outsider.id, until }];
    expect(seenBy(nurseA, grant, new Date(until.getTime() - 60_000)).has(outsider.id)).toBe(true);
    // The server drops the row from the desk's grants once `until` passes (`until > $4`), so the
    // next read carries none; a grant read with a passed end gives no time either.
    expect(seenBy(nurseA, [], until).has(outsider.id)).toBe(false);
    expect(seenBy(nurseA, [{ patientId: outsider.id, until: at }], at).has(outsider.id)).toBe(false);
  });

  it("lands on the coordinator's review list with the desk, the record and the reason", () => {
    const rows = serverOpenings(
      [
        {
          id: "58",
          actor_role: "ward",
          actor_scope: nurseA.scope,
          patient_id: outsider.id,
          reason: "bed-search",
          minutes: { opened: 0, until: BREAK_GLASS_MINUTES },
        },
      ] as never,
      worldNow(world, at),
      world.state.units,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ record: outsider.id, reason: "bed-search", desk: "ward" });
  });
});

describe("M58 cover", () => {
  const coordinator = { role: "coordinator", scope: { kind: "statewide" } } as WardAccess;
  const cover = (giver: WardAccess, scope: WardAccess["scope"], minutes = 60, roles = ["ward"]) =>
    coverRefusal(world, giver, "giver", "recipient", scope, minutes, roles);

  it("is scoped: one ward or one ED, inside the giver's place, only to a colleague who holds a ward or ED role", () => {
    expect(coverAccess({ kind: "ward", unitIds: [unitA.id, unitB.id] })).toBeNull();
    expect(coverAccess({ kind: "site", siteCode: unitA.siteCode } as WardAccess["scope"])).toBeNull();
    expect(cover(nurseA, nurseA.scope)).toBeNull();
    expect(cover(nurseA, nurseB.scope)).not.toBeNull();
    expect(cover(coordinator, nurseB.scope)).toBeNull();
    expect(cover(nurseA, nurseA.scope, 60, [])).not.toBeNull();
    expect(coverRefusal(world, nurseA, "same", "same", nurseA.scope, 60, ["ward"])).not.toBeNull();
    // A ward desk with cover of ward B sees B's patients as well as its own, and nothing else.
    const joined = withCover(nurseB, [nurseA.scope]);
    expect(joined.scope).toEqual({ kind: "ward", unitIds: [unitB.id, unitA.id] });
  });

  it("expires: it lasts one shift at most, and ends by itself at its time", () => {
    expect(cover(nurseA, nurseA.scope, 0)).not.toBeNull();
    expect(cover(nurseA, nurseA.scope, 12 * 60 + 1)).not.toBeNull();
    // Mid-session: the scope a read gets is built from the cover rows still running at that read
    // (`expires_at > now`), so once a cover ends the next read is the desk's own scope again.
    const during = seenBy(withCover(nurseB, [nurseA.scope]));
    const after = seenBy(withCover(nurseB, []));
    const onlyCovered = [...seenBy(nurseA)].filter((id) => !seenBy(nurseB).has(id));
    expect(onlyCovered.length).toBeGreaterThan(0);
    for (const id of onlyCovered) {
      expect(during.has(id)).toBe(true);
      expect(after.has(id)).toBe(false);
    }
  });

  // M58 fixed (D-129, 10 Nov 2026): cover asks why from a short list, and each cover given lands on
  // the coordinator's Governance review list beside the break glass openings. The server refuses
  // an unlisted reason before the database and keeps the reason in its ACCESS_COVER audit row:
  // backend/ward-flow/ward-audit-m58-break-glass-reason.test.mjs and postgres.test.mjs.
  it("asks why when cover is given, and keeps the reason with the cover", () => {
    expect(COVER_REASON_IDS.length).toBeGreaterThan(1);
    expect(COVER_REASON_IDS).not.toContain("");
    resetWardAccessStoreForTests();
    const record = giveCover({ recipient: nurseB, scope: nurseA.scope, now: 0, until: 60, reason: "staff-away" });
    expect(record?.reason).toBe("staff-away");
    expect(readWardAccessSnapshot().coversGiven.map((cover) => cover.reason)).toEqual(["staff-away"]);
    resetWardAccessStoreForTests();
  });

  it("lists each cover given on the coordinator's review list, as break glass openings are", () => {
    const now = worldNow(world, at);
    const covers = serverCovers(
      [
        {
          id: "59",
          actor_role: "ward",
          actor_scope: nurseA.scope,
          role: "ward",
          scope: nurseA.scope,
          reason: "night-weekend",
          minutes: { given: -30, until: 450 },
        },
        // A row the screens cannot read is left out, not guessed.
        { id: "x", actor_role: "ward", actor_scope: nurseA.scope, role: "ward", scope: nurseA.scope } as never,
      ],
      now,
      world.state.units,
    );
    expect(covers).toHaveLength(1);
    expect(covers[0]).toMatchObject({ reason: "night-weekend", desk: "ward", at: now - 30, until: now + 450 });
    const rows = coverEvents(covers, 0);
    expect(rows[0]).toMatchObject({ id: "audit-cover-59", category: "record-access", action: "ACCESS_COVER" });
    // Its review mark is named like an opening's, so the reducer and access rules accept it.
    expect(isBreakGlassReviewId(rows[0]!.id)).toBe(true);
    // The local demo lists the covers given in this tab the same way, even after they end.
    resetWardAccessStoreForTests();
    giveCover({ recipient: nurseB, scope: nurseA.scope, now: 0, until: 60, reason: "busy" });
    endDueCovers(61);
    const local = localCovers(readWardAccessSnapshot().coversGiven, world.state.units);
    expect(local).toHaveLength(1);
    expect(local[0]).toMatchObject({ reason: "busy", desk: "coordinator", at: 0, until: 60 });
    resetWardAccessStoreForTests();
  });
});
