import { describe, expect, it, vi } from "vitest";

/**
 * Time audit T8 (13 Nov 2026): the Delays "Past 24 hours" band reads the long-wait value
 * (`LONG_WAIT_MINUTES`, `LONG_WAIT_TEXT`) rather than a typed 24 * 60, so the band, its heading and
 * the middle band's upper edge can never disagree. Proved by moving the value: a typed number would
 * keep the old edge and heading.
 */
vi.mock("@/components/ward-management/ward-operational-defaults", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ward-management/ward-operational-defaults")>();
  return { ...original, LONG_WAIT_MINUTES: 30 * 60, LONG_WAIT_TEXT: "past 30 hours" };
});

const { WAIT_BANDS } = await import("@/components/ward-management/delays/wait-bands");

const bandsFor = (waited: number) =>
  WAIT_BANDS.filter((band) => band.test({ waited } as Parameters<(typeof band)["test"]>[0])).map((band) => band.id);

describe("Delays wait bands follow the long-wait value (T8)", () => {
  it("titles the top band from the value", () => {
    expect(WAIT_BANDS[0]?.title).toBe("Past 30 hours");
  });

  it("puts every wait in exactly one band, with the top band starting at the value", () => {
    expect(bandsFor(25 * 60)).toEqual(["over8"]);
    expect(bandsFor(30 * 60)).toEqual(["over24"]);
    expect(bandsFor(30 * 60 - 1)).toEqual(["over8"]);
  });
});
