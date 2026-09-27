/** @vitest-environment jsdom */
// Same fix as tests/favourites.test.ts: this file's own storage assertion needs `localStorage`
// and `sessionStorage` as real globals, which the default node project does not provide. The
// docblock overrides just this file's environment to jsdom without moving it into the
// `*.dom.test.tsx` glob, which this file is not — it renders nothing and needs no DOM.
import { describe, expect, it } from "vitest";
import { ACCESS_RECORD_NOTE, recordSearch } from "@/components/ward-management/search/access-record";

describe("the access record", () => {
  it("keeps one entry per search, newest first", () => {
    let list = recordSearch([], { words: "wenna", at: 1 });
    list = recordSearch(list, { words: "bram", at: 2 });
    expect(list.map((e) => e.words)).toEqual(["bram", "wenna"]);
  });

  it("says in words that it is kept for this session only", () => {
    // D-4 (Ward Lead, 2026-09-11): the RULED sentence, not the drawing's unqualified header note
    // and not the plan's third, unrelated wording — see access-record.ts's own doc comment.
    // ⚠️ D-4 ADDENDUM, 2026-09-11: "What was searched", NOT "Who looked". The first ruling fixed
    // the DURABILITY half of the claim and left the ATTRIBUTION half standing. There is no *who*
    // in this system — the role column's value was a source-level constant that named nobody — so
    // the word came out and the column with it. See `AccessEntry`'s own comment.
    expect(ACCESS_RECORD_NOTE).toBe(
      "What was searched, and when. Kept for this session only, and none is sent anywhere.",
    );
  });

  it("touches no storage at all", () => {
    // ⚠️ THE DECIDING ASSERTION. A persisted access record is a record of who looked at whom.
    // Nobody authorised that, and it would survive a reload where the note promises it does not.
    const before = { local: localStorage.length, session: sessionStorage.length };
    recordSearch([], { words: "kestrel", at: 3 });
    expect({ local: localStorage.length, session: sessionStorage.length }).toEqual(before);
  });
});
