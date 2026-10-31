import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { EARLIER_ROLE_LABELS, WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { withCurrentRoleWords } from "@/components/ward-management/ward-role-words-display";

/**
 * Q77 (Josh, 31 Oct 2026): screens show records saved before the role names changed under the new
 * names, display only. Synthetic seed records only.
 */
const seed = seedWardFlowState();

describe("Q77: old role words read in the new names, display only", () => {
  it("returns the same workspace when nothing holds an earlier word", () => {
    const saved = { bedReleases: [{ confirmedBy: "Site bed manager", blockedBy: null, expectedAt: Number.NaN }] };
    expect(withCurrentRoleWords(saved)).toBe(saved);
  });

  it("shows the seed's own earlier words under the new names", () => {
    const shown = withCurrentRoleWords(seed);
    const agreed = (state: typeof seed) =>
      state.movements.flatMap((movement) => movement.acceptanceConditions ?? []).map((condition) => condition.agreedBy);
    expect(agreed(seed)).toContain("Ward manager");
    expect(agreed(shown)).not.toContain("Ward manager");
    expect(agreed(shown)).toContain("Nurse in charge");
  });

  it("shows each earlier word under its new name, wherever a record says who recorded it", () => {
    const release = seed.bedReleases[0]!;
    const admission = seed.admissions[0]!;
    const saved = {
      ...seed,
      bedReleases: [
        { ...release, confirmedBy: "Bed manager", blockedBy: "Community service" },
        ...seed.bedReleases.slice(1),
      ],
      admissions: [{ ...admission, dischargeDateSetBy: "Ward manager" }, ...seed.admissions.slice(1)],
      notes: [
        {
          by: "Community clinician",
          recordedRole: "Bed manager",
          targetScopeLabel: "Bed manager",
          nested: [{ decidedBy: "Bed manager" }],
        },
      ],
    };
    const before = JSON.stringify(saved);
    const shown = withCurrentRoleWords(saved);
    expect(shown.bedReleases[0]).toMatchObject({ confirmedBy: "Site bed manager", blockedBy: "Community team" });
    expect(shown.admissions[0]?.dischargeDateSetBy).toBe("Nurse in charge");
    expect(shown.notes[0]).toEqual({
      by: "Community team",
      recordedRole: "Site bed manager",
      targetScopeLabel: "Site bed manager",
      nested: [{ decidedBy: "Site bed manager" }],
    });
    // The saved records keep their words, and untouched records keep their identity.
    expect(JSON.stringify(saved)).toBe(before);
    const untouched = { confirmedBy: "Site bed manager" };
    expect(withCurrentRoleWords({ rows: [untouched, { by: "Bed manager" }] }).rows[0]).toBe(untouched);
  });

  it("keeps an untouched record's display copy when another part of the workspace changes", () => {
    const first = withCurrentRoleWords(seed);
    const changed = { ...seed, referrals: [...seed.referrals] };
    const second = withCurrentRoleWords(changed);
    expect(second).not.toBe(first);
    expect(second.movements).toBe(first.movements);
    expect(second.units).toBe(first.units);
  });

  it("leaves text that only contains an earlier word, or sits under any other key, as saved", () => {
    const saved = { rows: [{ title: "Bed manager", note: "Bed manager review", confirmedBy: "NUM Ward A" }] };
    expect(withCurrentRoleWords(saved)).toBe(saved);
  });

  it("covers every earlier word Q66 lists", () => {
    for (const [word, role] of Object.entries(EARLIER_ROLE_LABELS)) {
      expect(withCurrentRoleWords({ by: word }).by).toBe(WARD_FLOW_ROLE_LABELS[role]);
    }
  });
});
