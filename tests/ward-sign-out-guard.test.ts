import { describe, expect, it } from "vitest";
import { allowWardSignOut } from "../src/components/ward-management/ward-sign-out-guard";

describe("sign-out with pending saves", () => {
  it("requires a positive answer for voluntary sign-out but never delays forced expiry", async () => {
    let questions = 0;
    const ask = async () => {
      questions++;
      return false;
    };
    expect(await allowWardSignOut(true, false, ask)).toBe(false);
    expect(await allowWardSignOut(true, true, ask)).toBe(true);
    expect(await allowWardSignOut(false, false, ask)).toBe(true);
    expect(questions).toBe(1);
  });
  it("keeps the session when the confirmation surface fails", async () => {
    expect(
      await allowWardSignOut(true, false, async () => {
        throw new Error("Synthetic unloaded dialog");
      }),
    ).toBe(false);
  });
});
