import { describe, expect, it } from "vitest";

import { INBOX_CATEGORIES, inboxItemKindOf } from "../src/components/ward-management/ward-flow-reducer";

/**
 * THE ONE ASSUMPTION `inboxItemKindOf` RESTS ON, AND NOTHING ELSE WOULD NOTICE IT BREAKING.
 *
 * `InboxItem.id` is `${idPrefix}${movementId}`, and the reducer decides whether a row may be ticked
 * off by finding the FIRST `INBOX_CATEGORIES` entry whose prefix the id starts with. If one prefix
 * were ever a prefix of another, a row of the longer category would be classified as the shorter
 * one — and if those two carried different kinds, a commitment's prefix sitting in front of a
 * fact's would make a live legal breach tickable. Nothing in the type system, the enumeration test
 * or the app can see that; the ids would still look right on screen.
 *
 * It is closer than it sounds: `declines-` and `destination-unlawful-` already share their first
 * two characters, and `bed-pull-` would swallow a future `bed-pull-unreleased-`.
 */
describe("INBOX_CATEGORIES id prefixes", () => {
  const entries = Object.entries(INBOX_CATEGORIES);

  it("has at least two categories to compare — otherwise this proves nothing", () => {
    expect(entries.length).toBeGreaterThan(1);
  });

  it("never lets one category's prefix swallow another's", () => {
    const collisions: string[] = [];
    for (const [keyA, a] of entries) {
      for (const [keyB, b] of entries) {
        if (keyA === keyB) continue;
        if (b.idPrefix.startsWith(a.idPrefix))
          collisions.push(`${keyA} (${a.idPrefix}) swallows ${keyB} (${b.idPrefix})`);
      }
    }
    expect(collisions).toEqual([]);
  });

  it("classifies a row of every category by its own id, never by a neighbour's prefix", () => {
    for (const [key, entry] of entries) {
      expect(inboxItemKindOf(`${entry.idPrefix}WF-001`), `${key} is misclassified by id`).toBe(entry.kind);
    }
  });
});
