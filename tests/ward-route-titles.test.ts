import { describe, expect, it } from "vitest";

import { generateMetadata as communityMetadata } from "@/app/bedchart/community/[teamId]/page";
import { generateMetadata as edMetadata } from "@/app/bedchart/ed/[edId]/page";
import { metadata as movementMetadata } from "@/app/bedchart/movements/[movementId]/page";
import { metadata as personMetadata } from "@/app/bedchart/people/[patientId]/page";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";

/**
 * Design re-score DR-11 and DR-20 (24 Oct 2026): browser tab titles.
 *   - DR-11: a movement record read "Patient" like a person's page. (The Bed board route is a redirect to
 *     the Ward page since item 13 of the 26 Nov 2026 simplification, so it has no title of its own.)
 *   - DR-20: an unknown community or emergency department address put the typed text in the title.
 */

const TYPED = "Typed%20text%20<b>";
const params = <K extends string>(key: K, value: string) => ({
  params: Promise.resolve({ [key]: value } as Record<K, string>),
});

describe("browser tab titles", () => {
  it.each([
    ["community team", () => communityMetadata(params("teamId", TYPED))],
    ["emergency department", () => edMetadata(params("edId", TYPED))],
  ])("never echoes an unknown %s address into the title", async (_label, read) => {
    const { title, description } = await read();
    expect(String(title)).toMatch(/not found — BedChart$/);
    expect(`${String(title)} ${description ?? ""}`).not.toMatch(/Typed/);
  });

  it("still names a known community team", async () => {
    const team = communityTeamById("midland")!;
    const { title } = await communityMetadata(params("teamId", team.id));
    expect(title).toBe(`${team.name} — BedChart`);
  });

  it("tells a movement record apart from a person's page, with no name in either", () => {
    expect(movementMetadata.title).toBe("Movement record — BedChart");
    expect(personMetadata.title).toBe("Patient — BedChart");
  });
});
