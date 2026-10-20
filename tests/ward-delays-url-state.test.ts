// DA-15 (design audit, 19 Oct 2026): the Delays board's filters and order in the web address.
import { describe, expect, it } from "vitest";

import { NO_FILTERS } from "@/components/ward-management/delays/delays-board-model";
import {
  filtersFromSearch,
  filtersKey,
  filtersKeyOf,
  filtersToParams,
  flatOrderFromSearch,
} from "@/components/ward-management/delays/delays-url-state";

describe("the Delays address", () => {
  it("reads back every filter it writes", () => {
    const filters = {
      ...NO_FILTERS,
      owner: "wards" as const,
      origin: "North Metro" as const,
      cause: "awaiting_transport" as const,
      threshold: 2 as const,
      locked: true,
      silent: true,
      dueSoon: true,
      breached: true,
      severe: true,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filtersToParams(filters))) if (value !== null) params.set(key, value);
    expect(params.toString()).toBe(
      "owner=wards&origin=North+Metro&blocker=awaiting_transport&wait=12h&locked=1&quiet=1&due=soon&passed=1&show=severe",
    );
    expect(filtersFromSearch(`?${params.toString()}`)).toEqual(filters);
  });

  it("never puts search text or the runway dot in the address", () => {
    const params = filtersToParams({ ...NO_FILTERS, search: "a typed name", bin: 3 });
    expect(Object.values(params).every((value) => value === null)).toBe(true);
    expect(filtersKey({ ...NO_FILTERS, search: "a typed name", bin: 3 })).toBe("");
  });

  it("ignores values it does not know rather than guessing", () => {
    expect(filtersFromSearch("?owner=nobody&blocker=made_up&origin=Elsewhere&wait=6h&locked=yes&due=later")).toEqual(
      NO_FILTERS,
    );
  });

  it("keeps the Menu's show=severe link and ignores the address's other keys", () => {
    expect(filtersFromSearch("?show=severe&from=queue").severe).toBe(true);
    expect(filtersKeyOf("?from=queue&bed=05")).toBe("");
  });

  it("gives one key for the same filters in any order", () => {
    expect(filtersKeyOf("?quiet=1&owner=ed")).toBe(filtersKeyOf("?owner=ed&quiet=1"));
  });

  it("reads the order only when the address names it", () => {
    expect(flatOrderFromSearch("?order=longest")).toBe(true);
    expect(flatOrderFromSearch("?order=blocker")).toBe(false);
    expect(flatOrderFromSearch("?order=sideways")).toBeNull();
    expect(flatOrderFromSearch("")).toBeNull();
  });
});
