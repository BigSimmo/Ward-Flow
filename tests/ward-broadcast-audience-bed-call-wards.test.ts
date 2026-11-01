import { describe, expect, it } from "vitest";

import { audienceRecipients, type AudienceGroup } from "@/components/ward-management/alerts/broadcast-audience";

const groups: AudienceGroup[] = [
  { id: "metro", label: "Metro adult wards", desks: [{ id: "W1", name: "Ward One", kind: "ward" }] },
  { id: "ed", label: "ED desks", desks: [{ id: "ED1", name: "Sample ED", kind: "ed" }] },
];

describe("bed-call audience", () => {
  it("counts and sends to wards only, as the reducer does", () => {
    const everyone = { mode: "all" as const, groups: [], picked: [], bedNow: false };
    expect(audienceRecipients(everyone, groups, [], true).map((d) => d.id)).toEqual(["W1"]);
    expect(audienceRecipients(everyone, groups, []).map((d) => d.id)).toEqual(["W1", "ED1"]);
  });

  it("leaves no recipients when only ED desks are chosen, so Send stays blocked", () => {
    const edOnly = { mode: "groups" as const, groups: ["ed" as const], picked: [], bedNow: false };
    expect(audienceRecipients(edOnly, groups, [], true)).toEqual([]);
    const picked = { mode: "pick" as const, groups: [], picked: ["ED1"], bedNow: false };
    expect(audienceRecipients(picked, groups, [], true)).toEqual([]);
  });
});
