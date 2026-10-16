import { beforeEach, describe, expect, it } from "vitest";

import {
  ACCESS_ENDING_SOON_MINUTES,
  ACCESS_UNUSED_MINUTES,
  COVER_MAX_MINUTES,
  approveRefusal,
  coverRefusal,
  grantRefusal,
  membershipStatus,
  requestRefusal,
  reviewNotes,
  revokeRefusal,
  scopeWithinScope,
  withCover,
  type AccessMembership,
} from "../src/components/ward-management/ward-access-admin";
import { wardAccessPlaces } from "../src/components/ward-management/ward-access-places";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import {
  endCover,
  endDueCovers,
  giveCover,
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
  startAccessPreview,
} from "../src/components/ward-management/shell/ward-access-store";
import {
  DEMO_ADMIN_ID,
  localApprove,
  localDecide,
  localGrant,
  localRequest,
  localRevoke,
  readLocalAccessAdmin,
  resetLocalAccessAdminForTests,
} from "../src/components/ward-management/shell/ward-access-admin-store";

/**
 * The access admin's rules (role access plan, later pass): no self grants, never wider than your
 * own place, a second approver for coordinator and admin roles, cover for one shift, and roles
 * that switch off when unused. Seed wards only, synthetic.
 */
const places = wardAccessPlaces(seedWardFlowState().units);
const now = NOW_ANCHOR;
const statewideAdmin: WardAccess = { role: "admin", scope: { kind: "statewide" } };
const southAdmin: WardAccess = { role: "admin", scope: { kind: "service", service: "South Metro" } };
const fshWard: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } };

function membership(over: Partial<AccessMembership> = {}): AccessMembership {
  return {
    id: "m1",
    actorId: "person",
    access: fshWard,
    kind: "role",
    grantedBy: "admin-1",
    grantedAt: now - 60,
    expiresAt: now + 30 * 1440,
    approvedBy: null,
    lastUsedAt: now - 60,
    revokedAt: null,
    ...over,
  };
}

describe("granting a role", () => {
  const grant = (over: Partial<Parameters<typeof grantRefusal>[0]>) =>
    grantRefusal({
      granter: southAdmin,
      granterId: "admin-1",
      actorId: "person",
      access: fshWard,
      expiresAt: now + 1440,
      now,
      places,
      ...over,
    });

  it("lets an admin grant a role inside their own service", () => {
    expect(grant({})).toBeNull();
  });

  it("refuses a self grant, a wider role, a past end date and a non admin", () => {
    expect(grant({ actorId: "admin-1" })).toBe("Nobody grants themselves a role.");
    expect(grant({ access: { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } } })).toBe(
      "That role is wider than your own.",
    );
    expect(grant({ access: { role: "coordinator", scope: { kind: "statewide" } } })).toBe(
      "That role is wider than your own.",
    );
    expect(grant({ expiresAt: now })).toBe("A role needs an end date in the future.");
    expect(grant({ granter: fshWard })).toBe("Granting and removing roles is not part of your role.");
    expect(grant({ access: { role: "ward", scope: { kind: "ed", edId: "fsh-ed" } } })).toBe(
      "A role and a place that go together are required.",
    );
    expect(grant({ access: { role: "ward", scope: { kind: "ward", unitIds: ["no-such-ward"] } } })).toBe(
      "That place is not in the workspace.",
    );
  });

  it("keeps a service admin to that service's sites, wards and EDs", () => {
    const south = { kind: "service", service: "South Metro" } as const;
    expect(scopeWithinScope({ kind: "site", siteCode: "FSH" }, south, places)).toBe(true);
    expect(scopeWithinScope({ kind: "site", siteCode: "RPH" }, south, places)).toBe(false);
    expect(scopeWithinScope({ kind: "ed", edId: "fsh-ed" }, south, places)).toBe(true);
    expect(scopeWithinScope({ kind: "team", teamName: "Any team" }, south, places)).toBe(false);
  });
});

describe("approving and removing", () => {
  const coordinatorGrant = membership({
    access: { role: "coordinator", scope: { kind: "service", service: "South Metro" } },
  });

  it("needs a second person for a coordinator or admin role", () => {
    expect(membershipStatus(coordinatorGrant, now)).toBe("waiting");
    expect(approveRefusal({ approver: southAdmin, approverId: "admin-1", membership: coordinatorGrant, places })).toBe(
      "A second person approves this role.",
    );
    expect(
      approveRefusal({ approver: southAdmin, approverId: "admin-2", membership: coordinatorGrant, places }),
    ).toBeNull();
    expect(approveRefusal({ approver: southAdmin, approverId: "admin-2", membership: membership(), places })).toBe(
      "That role is not waiting for approval.",
    );
  });

  it("lets the giver end their own cover, and only an admin end a role", () => {
    const cover = membership({ kind: "cover", grantedBy: "nic-1" });
    expect(revokeRefusal({ remover: fshWard, removerId: "nic-1", membership: cover, places })).toBeNull();
    expect(revokeRefusal({ remover: fshWard, removerId: "nic-2", membership: cover, places })).toBe(
      "Granting and removing roles is not part of your role.",
    );
    expect(
      revokeRefusal({ remover: statewideAdmin, removerId: "admin-9", membership: membership(), places }),
    ).toBeNull();
  });
});

describe("the access review", () => {
  it("lists a role ending soon and switches off one not used", () => {
    const ending = membership({ expiresAt: now + ACCESS_ENDING_SOON_MINUTES - 1 });
    expect(reviewNotes(ending, now)).toEqual({ endingSoon: true, unused: false });
    const idle = membership({ lastUsedAt: now - ACCESS_UNUSED_MINUTES });
    expect(membershipStatus(idle, now)).toBe("unused");
    expect(reviewNotes(idle, now).unused).toBe(true);
    const never = membership({ lastUsedAt: null, grantedAt: now - ACCESS_UNUSED_MINUTES - 1 });
    expect(membershipStatus(never, now)).toBe("unused");
    expect(membershipStatus(membership({ revokedAt: now - 1 }), now)).toBe("ended");
  });

  it("reads its windows from the clinical values module", () => {
    expect(ACCESS_ENDING_SOON_MINUTES).toBe(CLINICAL_VALUES.accessExpiringSoon.value * 1440);
    expect(ACCESS_UNUSED_MINUTES).toBe(CLINICAL_VALUES.accessUnused.value * 1440);
    expect(COVER_MAX_MINUTES).toBe(CLINICAL_VALUES.coverLength.value * 60);
  });
});

describe("cover for a second ward or ED", () => {
  const cover = (over: Partial<Parameters<typeof coverRefusal>[0]>) =>
    coverRefusal({
      giver: fshWard,
      giverId: "nic-1",
      recipientId: "nic-2",
      scope: { kind: "ward", unitIds: ["fsh-adult-secure"] },
      minutes: 8 * 60,
      places,
      ...over,
    });

  it("lets a nurse in charge give cover of their own ward, for one shift at most", () => {
    expect(cover({})).toBeNull();
    expect(cover({ minutes: COVER_MAX_MINUTES + 1 })).toBe(
      `Cover lasts up to ${CLINICAL_VALUES.coverLength.value} hours.`,
    );
    expect(cover({ recipientId: "nic-1" })).toBe("Nobody gives themselves cover.");
    expect(cover({ scope: { kind: "ward", unitIds: ["fsh-older-adult"] } })).toBe(
      "That ward or ED is not in your own place.",
    );
  });

  it("lets a service coordinator give cover inside its service only, and nobody else", () => {
    const south: WardAccess = { role: "coordinator", scope: { kind: "service", service: "South Metro" } };
    expect(cover({ giver: south, scope: { kind: "ward", unitIds: ["fsh-older-adult"] } })).toBeNull();
    expect(cover({ giver: south, scope: { kind: "ed", edId: "fsh-ed" } })).toBeNull();
    expect(cover({ giver: south, scope: { kind: "ward", unitIds: ["rph-adult-secure"] } })).toBe(
      "That ward or ED is not in your own place.",
    );
    expect(cover({ giver: { role: "executive", scope: { kind: "statewide" } } })).toBe(
      "Giving cover is not part of your role.",
    );
    expect(cover({ giver: south, scope: { kind: "site", siteCode: "FSH" } })).toBe("Cover is for one ward or one ED.");
  });

  it("joins a covered ward to the nurse in charge's own, and never merges ED cover", () => {
    expect(withCover(fshWard, [{ kind: "ward", unitIds: ["fsh-older-adult"] }])).toEqual({
      role: "ward",
      scope: { kind: "ward", unitIds: ["fsh-adult-secure", "fsh-older-adult"] },
    });
    const ed: WardAccess = { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } };
    expect(withCover(ed, [{ kind: "ed", edId: "rph-ed" }])).toBe(ed);
    expect(withCover(fshWard, [])).toBe(fshWard);
  });
});

describe("asking for access", () => {
  it("takes one open request per person, for a real place", () => {
    expect(requestRefusal({ access: fshWard, openRequests: 0, places })).toBeNull();
    expect(requestRefusal({ access: fshWard, openRequests: 1, places })).toBe(
      "You have already asked. An access admin will answer it.",
    );
    expect(
      requestRefusal({ access: { role: "ed", scope: { kind: "ed", edId: "nowhere" } }, openRequests: 0, places }),
    ).toBe("That place is not in the workspace.");
  });
});

describe("the desk store's cover", () => {
  beforeEach(() => resetWardAccessStoreForTests());
  const olderAdult: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["fsh-older-adult"] } };

  it("joins cover to the receiving desk only while it runs, and ends it at its time", () => {
    setWardAccess(fshWard);
    const record = giveCover({ recipient: olderAdult, scope: fshWard.scope, now, until: now + 60 });
    expect(record).not.toBeNull();
    expect(readWardAccessSnapshot().access).toEqual(fshWard);
    setWardAccess(olderAdult);
    expect(readWardAccessSnapshot().access.scope).toEqual({
      kind: "ward",
      unitIds: ["fsh-older-adult", "fsh-adult-secure"],
    });
    expect(readWardAccessSnapshot().desk).toEqual(olderAdult);
    endDueCovers(now + 59);
    expect(readWardAccessSnapshot().covers).toHaveLength(1);
    endDueCovers(now + 60);
    expect(readWardAccessSnapshot().access).toEqual(olderAdult);
  });

  it("ends cover on request, and gives none during a preview", () => {
    const record = giveCover({ recipient: olderAdult, scope: fshWard.scope, now, until: now + 60 });
    endCover(record!.id);
    expect(readWardAccessSnapshot().covers).toHaveLength(0);
    startAccessPreview(fshWard);
    expect(giveCover({ recipient: olderAdult, scope: fshWard.scope, now, until: now + 60 })).toBeNull();
  });
});

describe("the local demo access admin", () => {
  beforeEach(() => resetLocalAccessAdminForTests());
  const desk = { access: statewideAdmin, actorId: DEMO_ADMIN_ID };
  const find = (actorId: string) => readLocalAccessAdmin(now).memberships.find((m) => m.actorId === actorId)!;

  it("seeds a role waiting for approval, one ending soon and one unused", () => {
    const { memberships, requests } = readLocalAccessAdmin(now);
    expect(memberships.map((m) => membershipStatus(m, now))).toContain("waiting");
    expect(memberships.some((m) => reviewNotes(m, now).endingSoon)).toBe(true);
    expect(memberships.some((m) => reviewNotes(m, now).unused)).toBe(true);
    expect(requests.filter((r) => r.decision === null)).toHaveLength(2);
  });

  it("grants, approves and removes through the shared rules", () => {
    expect(localGrant(desk, { actorId: DEMO_ADMIN_ID, access: fshWard, expiresAt: now + 1440, now, places })).toBe(
      "Nobody grants themselves a role.",
    );
    expect(
      localGrant(desk, { actorId: "demo-staff-h", access: fshWard, expiresAt: now + 1440, now, places }),
    ).toBeNull();
    expect(find("demo-staff-h").grantedBy).toBe(DEMO_ADMIN_ID);
    const waiting = find("demo-staff-d");
    expect(localApprove(desk, waiting.id, now, places)).toBeNull();
    expect(membershipStatus(find("demo-staff-d"), now)).toBe("active");
    expect(localRevoke(desk, find("demo-staff-a").id, now, places)).toBeNull();
    expect(membershipStatus(find("demo-staff-a"), now)).toBe("ended");
    expect(localRevoke(desk, find("demo-staff-a").id, now, places)).toBe("That role is not active.");
  });

  it("answers a request once, and takes one open request per person", () => {
    const [first, second] = readLocalAccessAdmin(now).requests;
    expect(localDecide(desk, first.id, "approved", { expiresAt: now + 1440, now, places })).toBeNull();
    expect(find(first.actorId).access).toEqual(first.access);
    expect(localDecide(desk, first.id, "declined", { expiresAt: now + 1440, now, places })).toBe(
      "That request has already been answered.",
    );
    expect(localDecide(desk, second.id, "declined", { expiresAt: now + 1440, now, places })).toBeNull();
    expect(localRequest({ actorId: "demo-staff-h", access: fshWard, now, places })).toBeNull();
    expect(localRequest({ actorId: "demo-staff-h", access: fshWard, now, places })).toBe(
      "You have already asked. An access admin will answer it.",
    );
  });
});
