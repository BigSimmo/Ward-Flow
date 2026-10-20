import { describe, expect, it } from "vitest";
import { notRecordedMessage } from "@/components/ward-management/ward/ward-screen-overlays";

describe("the ward drawer's refusal line", () => {
  it("says nothing was changed once, whether or not the shared board already said so (audit E-25)", () => {
    expect(notRecordedMessage("No allocatable bed on this ward. Nothing was changed.")).toBe(
      "Not recorded: No allocatable bed on this ward. Nothing was changed.",
    );
    expect(notRecordedMessage("Someone else changed this stay first.")).toBe(
      "Not recorded: Someone else changed this stay first. Nothing was changed.",
    );
    expect(notRecordedMessage()).toBe("Not recorded: The change was refused. Nothing was changed.");
  });
});
