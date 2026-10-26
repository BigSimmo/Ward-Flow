import { describe, expect, it } from "vitest";

import { generateMetadata as boardMetadata } from "@/app/ward-flow/board/[unitId]/page";
import { generateMetadata as communityMetadata } from "@/app/ward-flow/community/[teamId]/page";
import { generateMetadata as edMetadata } from "@/app/ward-flow/ed/[edId]/page";
import { metadata as movementMetadata } from "@/app/ward-flow/movements/[movementId]/page";
import { metadata as personMetadata } from "@/app/ward-flow/people/[patientId]/page";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { knownWardUnit } from "@/components/ward-management/ward-known-places";

/**
 * Design re-score DR-11 and DR-20 (24 Oct 2026): browser tab titles.
 *   - DR-11: every board tab read "Ward board", and a movement record read "Patient" like a person's page.
 *   - DR-20: an unknown community or emergency department address put the typed text in the title.
 */

const TYPED = "Typed%20text%20<b>";
const params = <K extends string>(key: K, value: string) => ({
  params: Promise.resolve({ [key]: value } as Record<K, string>),
});

describe("browser tab titles", () => {
  it("names the ward on its board", async () => {
    const unit = knownWardUnit("dn-rph-acute")!;
    const { title } = await boardMetadata(params("unitId", unit.id));
    expect(title).toBe(`${unit.name} board — Ward Flow`);
  });

  it.each([
    ["board", () => boardMetadata(params("unitId", TYPED))],
    ["community team", () => communityMetadata(params("teamId", TYPED))],
    ["emergency department", () => edMetadata(params("edId", TYPED))],
  ])("never echoes an unknown %s address into the title", async (_label, read) => {
    const { title, description } = await read();
    expect(String(title)).toMatch(/not found — Ward Flow$/);
    expect(`${String(title)} ${description ?? ""}`).not.toMatch(/Typed/);
  });

  it("still names a known community team", async () => {
    const team = communityTeamById("midland")!;
    const { title } = await communityMetadata(params("teamId", team.id));
    expect(title).toBe(`${team.name} — Ward Flow`);
  });

  it("tells a movement record apart from a person's page, with no name in either", () => {
    expect(movementMetadata.title).toBe("Movement record — Ward Flow");
    expect(personMetadata.title).toBe("Patient — Ward Flow");
  });
});
