import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";

/**
 * Design audit DA-28 (overall review, 20 Oct 2026): the browser tab must name a page the way the
 * menu does. "Search hub" sat under the menu's "Places" and "Forms" under "Legal forms".
 *
 * Each menu entry's page title must contain the menu label (ignoring case and a plural "s"), so
 * "Shift handover" under "Handover" passes and "Search hub" under "Places" does not. Home's tab is
 * the app's own name.
 */
const TAB_IS_APP_NAME = new Set(["/ward-flow"]);

function staticTitle(href: string): string | undefined {
  const file = resolve(process.cwd(), `src/app${href}/page.tsx`);
  if (!existsSync(file)) return undefined;
  return /title:\s*"([^"]+)"/u.exec(readFileSync(file, "utf8"))?.[1];
}

describe("page titles match the menu (DA-28)", () => {
  const entries = [...WARD_VIEWS, ...WARD_NAV].filter((item) => !TAB_IS_APP_NAME.has(item.href));

  it.each(entries.map((item) => [item.label, item.href] as const))("%s (%s)", (label, href) => {
    const title = staticTitle(href);
    if (title === undefined) return; // a redirect or a page whose title is built at request time
    expect(title.toLowerCase(), `the tab for the menu's "${label}"`).toContain(label.toLowerCase().replace(/s$/u, ""));
  });

  it("names Places and Legal forms exactly as the menu does", () => {
    expect(staticTitle("/ward-flow/hub")).toBe("Places — Ward Flow");
    expect(staticTitle("/ward-flow/legal-forms")).toBe("Legal forms — Ward Flow");
  });
});
