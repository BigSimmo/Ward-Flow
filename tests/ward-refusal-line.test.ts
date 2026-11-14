import { describe, expect, it } from "vitest";

import {
  REFUSAL_NOT_RECORDABLE,
  refusalLine,
  refusalReasonText,
  specificRefusalText,
} from "@/components/ward-management/ward-refusal-words";

/** R-STYLE-17 and B2d-Q-1 (14 Nov 2026): one short line, why then what next, never a code. */
describe("one-line refusals", () => {
  it("joins why and what next as two short sentences", () => {
    expect(refusalLine("transport is booked.", "cancel the transport booking first ")).toBe(
      "Transport is booked. Cancel the transport booking first.",
    );
    expect(refusalLine("No bed on this ward", "")).toBe("No bed on this ward.");
  });

  it("gives the Undo pull refusal its own line, not the generic one", () => {
    const reason =
      "movement UM100045 has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull";
    const line = refusalReasonText(reason);
    expect(line).toBe("Transport is booked. Cancel the transport booking first, then undo the pull.");
    expect(line).not.toBe(REFUSAL_NOT_RECORDABLE);
    expect(line).not.toMatch(/UM\d|CANCEL_TRANSPORT|movement/u);
  });

  it("every specific line is one line with no code or record number", () => {
    for (const reason of [
      "movement M1 has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing and reopening the search",
      "movement M1 has a transport job booked; cancel it (CANCEL_TRANSPORT) before withdrawing the acceptance",
    ]) {
      const line = specificRefusalText(reason);
      expect(line).toBeDefined();
      expect(line).not.toMatch(/\n|[A-Z]{2,}_[A-Z]|M1/u);
    }
    expect(specificRefusalText("No allocatable bed on this ward.")).toBeUndefined();
  });
});
