import { describe, expect, it } from "vitest";

import {
  IN_USE_CAPTION,
  IN_USE_NOUN,
  OCCUPIED_CAPTION,
  OCCUPIED_NOUN,
  ON_THE_WARD_NOUN,
  wardBedsInUse,
} from "@/components/ward-management/ward-occupancy";

/**
 * WF-16 follow-up: paired figures either share one source or are labelled so
 * a reader can tell them apart (discharges due vs forecast; ready vs spare that
 * fit; Occupied vs In use).
 */
describe("WF-16 figure labels", () => {
  it("exports Occupied / In use nouns that match the one occupancy math", () => {
    expect(OCCUPIED_NOUN).toBe("Occupied");
    expect(ON_THE_WARD_NOUN).toBe("On the ward");
    expect(IN_USE_NOUN).toBe("In use");
    expect(OCCUPIED_CAPTION.toLowerCase()).toMatch(/leave/);
    expect(IN_USE_CAPTION.toLowerCase()).toMatch(/pulled/);
    expect(typeof wardBedsInUse).toBe("function");
  });
});
