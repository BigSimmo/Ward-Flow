import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Spec item 9 (13 Nov 2026), checked against the approved picture: on a phone the Waiting page's
 * pinned tab row (Longest wait, By hold-up, Filter) sits on one solid slate band. The table's own
 * head used to pin too (`pinnedSwitch`, sticky under the header at the same z-index, later in the
 * page), and with the order switch moved up into the tabs it was an empty 16px canvas band that
 * painted across the top of the tab row. Only the tab row pins now.
 */
const tsx = readFileSync(join(process.cwd(), "src/components/ward-management/delays/delays-board.tsx"), "utf8");

describe("Waiting on a phone: one pinned row", () => {
  it("does not pin the table head over the tab row", () => {
    const at = tsx.indexOf('data-testid="delays-table-head"');
    expect(at).toBeGreaterThan(-1);
    const open = tsx.lastIndexOf("<div", at);
    expect(tsx.slice(open, at)).not.toMatch(/pinnedSwitch/u);
    expect(tsx).not.toMatch(/ward-pinned-switch\.module\.css/u);
  });
});
