import { describe, expect, it } from "vitest";
import { settledWardCommand } from "@/components/ward-management/ward-command-completion";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("legacy form adapters retain uncertain command ownership", () => {
  it("does not release the form before its same-command eventual acceptance", async () => {
    const confirmation = deferred();
    const uncertain: WardCommandOutcome = { commandId: "owned", status: "failed", confirmation: confirmation.promise };
    const completion = Promise.resolve(settledWardCommand(Promise.resolve(uncertain)));
    let finished = false;
    void completion.then(() => {
      finished = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    confirmation.resolve({ commandId: "owned", status: "accepted" });
    expect(await completion).toMatchObject({ commandId: "owned", status: "accepted" });
  });

  it("keeps an eventual refusal and cannot adopt a different command's acceptance", async () => {
    const confirmation = deferred();
    const uncertain: WardCommandOutcome = { commandId: "owned", status: "failed", confirmation: confirmation.promise };
    const completion = settledWardCommand(uncertain);
    confirmation.resolve({ commandId: "other", status: "accepted" });
    expect(await completion).toBe(uncertain);
    expect(await settledWardCommand({ commandId: "owned", status: "refused", message: "Conflict" })).toMatchObject({
      status: "refused",
      message: "Conflict",
    });
  });
});
