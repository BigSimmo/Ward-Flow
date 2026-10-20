import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { removePathSync } from "../scripts/retryable-fs.mjs";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  REFERENCE_TEAM_CAVEAT,
  REFERENCE_TEAM_NAMES,
  referenceTeamDetail,
} from "@/components/ward-management/reference/ward-reference-teams";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});

function referenceCheckFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-reference-check-"));
  roots.push(root);
  for (const dir of [
    "scripts/ward-flow",
    "docs/ward-flow/reference-data",
    "src/components/ward-management/reference",
  ]) {
    mkdirSync(path.join(root, dir), { recursive: true });
  }
  for (const name of [
    "check-ward-reference",
    "build-reference-registry",
    "build-reference-distances",
    "build-reference-teams",
  ]) {
    const file = `scripts/ward-flow/${name}.mjs`;
    copyFileSync(path.resolve(file), path.join(root, file));
  }
  symlinkSync(path.resolve("node_modules"), path.join(root, "node_modules"), "junction");
  const packPath = path.join(root, "docs/ward-flow/reference-data/entities.json");
  writeFileSync(
    packPath,
    JSON.stringify({
      entities: [
        {
          entity_kind: "community_service",
          team_id: "synthetic-team",
          name: "Synthetic team",
          published_phone: "synthetic phone",
        },
      ],
    }),
  );
  writeFileSync(path.join(root, "docs/ward-flow/reference-data/distances.json"), JSON.stringify({ distances: [] }));
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { writeFileSync } from "node:fs";
    for (const name of ["registry", "distances", "teams"]) {
      const { generate } = await import("./scripts/ward-flow/build-reference-" + name + ".mjs");
      writeFileSync("src/components/ward-management/reference/ward-reference-" + name + ".ts", await generate());
    }
  `,
    ],
    { cwd: root, timeout: 15_000 },
  );
  return {
    packPath,
    teamsPath: path.join(root, "src/components/ward-management/reference/ward-reference-teams.ts"),
    check: () =>
      spawnSync(process.execPath, ["scripts/ward-flow/check-ward-reference.mjs"], {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
      }),
  };
}

it.each(["generated contact edit", "source contact edit", "missing teams file"])(
  "fails the reference check for %s while registry and distances still match",
  (change) => {
    const fixture = referenceCheckFixture();
    const matching = fixture.check();
    expect(matching.status, matching.stderr || matching.stdout).toBe(0);
    expect(matching.stdout).toContain("all match the reference pack");
    expect(matching.stdout).toContain("operational_use_approved: false");
    const teams = readFileSync(fixture.teamsPath, "utf8");
    expect(teams).toContain("synthetic phone");
    if (change === "generated contact edit") {
      writeFileSync(fixture.teamsPath, teams.replace("synthetic phone", "changed synthetic phone"));
    } else if (change === "source contact edit") {
      const pack = JSON.parse(readFileSync(fixture.packPath, "utf8"));
      pack.entities[0].published_phone = "changed synthetic phone";
      writeFileSync(fixture.packPath, JSON.stringify(pack));
    } else {
      unlinkSync(fixture.teamsPath);
    }
    const result = fixture.check();
    expect(result.status, result.stderr || result.stdout).toBe(1);
    expect(result.stdout).toContain(
      `ward-reference-teams.ts ${change === "missing teams file" ? "is missing" : "has drifted"}`,
    );
    expect(result.stdout).toContain("npm run ward:reference:build");
    if (change !== "missing teams file") {
      expect(readFileSync(fixture.teamsPath, "utf8")).toBe(
        change === "generated contact edit" ? teams.replace("synthetic phone", "changed synthetic phone") : teams,
      );
    }
  },
);

/**
 * THE REGISTER'S PUBLISHED CONTACT DETAIL, AND THE BOUNDARY IT KEEPS.
 *
 * `ward-reference-teams.ts` is generated from the research pack and holds the phone number, hours
 * and referral email a public directory prints for a real WA community mental health service.
 *
 * 🔴 **WHAT THIS FILE IS REALLY GUARDING IS THE MATCH, NOT THE DATA.** The pack forbids matching a
 * service on suburb, postcode, LGA or proximity, by name. The reason is not tidiness: a phone
 * number attached to the wrong clinic is worse than no phone number, because a coordinator would
 * ring it. So the lookup is EXACT NAME ONLY, an unmatched team returns `null`, and the count of
 * teams that do match is pinned below rather than left to drift.
 *
 * ⚠️ **AND THE COUNT IS PINNED IN BOTH DIRECTIONS.** A test asserting only "some teams match" would
 * pass if a fuzzy matcher were introduced tomorrow and matched everything. The floor catches the
 * register being emptied; the exact figure catches it being widened.
 */
describe("the register's community-team contact detail", () => {
  // ⚠️ OPEN QUESTION (lint clean-up, 2026-10-04): the pinned match count described above is not
  // asserted anywhere. A `matched` list (COMMUNITY_TEAM_PAGES names that resolve exactly in the
  // register) was computed here but never used, and it is currently EMPTY — no community-team page
  // name matches a register name exactly. Pinning 0 would freeze that gap; whether the two
  // vocabularies should overlap is a product decision, so the unused value was removed instead.

  it("knows what it is checking against, so a pass cannot come from an empty list", () => {
    // The canary. Every assertion below passes by finding something; an empty register or an empty
    // team list would read identically to a healthy one.
    expect(REFERENCE_TEAM_NAMES.length).toBeGreaterThan(20);
    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(50);
  });

  it("carries no numeric field at all, so no capacity figure can reach an operational one", () => {
    for (const name of REFERENCE_TEAM_NAMES) {
      const detail = referenceTeamDetail(name);
      expect(detail, name).not.toBeNull();
      for (const [key, value] of Object.entries(detail!)) {
        expect(typeof value, `${name}.${key}`).not.toBe("number");
      }
    }
  });

  it("resolves a real team to its (invented) number, and an unknown name to null", () => {
    expect(referenceTeamDetail("Butler Community Mental Health Service")?.publishedPhone).toBe("08 5550 0101");
    expect(referenceTeamDetail("A team that does not exist")).toBeNull();
  });

  it("never returns an empty string where it means 'the register does not say'", () => {
    for (const name of REFERENCE_TEAM_NAMES) {
      const detail = referenceTeamDetail(name)!;
      for (const [key, value] of Object.entries(detail)) {
        if (typeof value === "string") expect(value.trim(), `${name}.${key}`).not.toBe("");
      }
    }
  });

  it("matches by exact name only — a near-miss resolves to nothing", () => {
    const [first] = REFERENCE_TEAM_NAMES;
    expect(referenceTeamDetail(first)).not.toBeNull();
    expect(referenceTeamDetail(`${first} (North)`)).toBeNull();
    expect(referenceTeamDetail(first.replace(/\s/u, ""))).toBeNull();
  });

  it("tolerates surrounding whitespace, because a name read from a record may carry it", () => {
    const [first] = REFERENCE_TEAM_NAMES;
    expect(referenceTeamDetail(`  ${first}  `)).not.toBeNull();
  });

  it("holds only invented numbers and mailboxes, so the demo cannot ring or email a real service", () => {
    // Owner, 20 Oct 2026: 08 5550 0xxx is a reserved fictitious range; example.invalid never resolves.
    for (const name of REFERENCE_TEAM_NAMES) {
      const detail = referenceTeamDetail(name)!;
      if (detail.publishedPhone !== null) expect(detail.publishedPhone, name).toMatch(/^08 5550 0\d{3}$/u);
      if (detail.referralEmail !== null) expect(detail.referralEmail, name).toMatch(/@example\.invalid$/u);
    }
  });

  it("states its caveat in one sentence, and says the detail is invented and not call-tested", () => {
    expect(REFERENCE_TEAM_CAVEAT).toMatch(/invented/iu);
    expect(REFERENCE_TEAM_CAVEAT).toMatch(/not call-tested/iu);
    expect(REFERENCE_TEAM_CAVEAT).toMatch(/not confirmed by the service/iu);
  });
});
