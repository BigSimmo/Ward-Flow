import { describe, expect, it } from "vitest";

import WardPersonPage from "@/app/ward-flow/people/[patientId]/page";

// A1K-05 (Josh, 27 Oct 2026): a malformed patient address is a real 404. A well-formed id stays
// with the patient screen's soft not-found, as people added at runtime are held on the client.
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/u;
const open = (patientId: string) => WardPersonPage({ params: Promise.resolve({ patientId }) });

describe("patient route decoding", () => {
  it("returns a real not-found for malformed percent encoding, selecting no patient", async () => {
    await expect(open("PT-%E0%A4%A")).rejects.toThrow(NOT_FOUND);
  });
});

describe("a UMRN in the patient address (D-39)", () => {
  it("does not resolve a UMRN-shaped id, and quotes nothing back", async () => {
    const error = await open("UM100023").catch((caught: unknown) => caught);
    expect(String(error)).toMatch(NOT_FOUND);
    expect(String(error)).not.toContain("UM100023");
  });

  it("also refuses the real WA UMRN shape, one letter then seven digits", async () => {
    await expect(open("A1234567")).rejects.toThrow(NOT_FOUND);
  });

  it("still refuses an id that is neither a UMRN nor an internal id", async () => {
    await expect(open("nobody")).rejects.toThrow(NOT_FOUND);
  });

  it("sends a well-formed id on to its coded address, never a 404", async () => {
    await expect(open("PT-9999")).rejects.toThrow(/NEXT_REDIRECT/u);
  });
});
