import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HELD_UP_LINK_LABEL } from "@/components/ward-management/capacity/capacity-held-up";

/*
 * Spec item 9 (shared design parts, 13 Nov 2026): phone controls are drawn 40px with a 48px tap
 * cover; names, places and second lines wrap to two lines before any "…"; only one bar sticks and a
 * pinned tab row is solid; accessible names start with the visible words.
 */

const css = (file: string) =>
  readFileSync(join(process.cwd(), "src/components", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function phoneBlocks(source: string): string {
  return [...source.matchAll(/@media \(max-width: 46\.4375rem\) \{([\s\S]*?)\n\}/gu)].map((m) => m[1]).join("\n");
}

describe("phone touch: 40px drawn, 48px cover", () => {
  it("hero figure links, band cells and Ask carry a 4px cover above and below", () => {
    const phone = phoneBlocks(css("wf/hero-top.module.css"));
    expect(phone).toMatch(
      /a\.figLink::after,\s*\.figButton::after,\s*\.pillAction::after\s*\{[^}]*content:\s*"";[^}]*inset:\s*-4px 0/u,
    );
    expect(phone).toMatch(/button\.cellBody::after,\s*a\.cellBody::after\s*\{[^}]*inset:\s*-4px 0/u);
    // Ask: an 18px line plus 11px above and below is 40px drawn.
    expect(phone).toMatch(/\.pillAction\s*\{\s*padding-block:\s*11px;\s*margin-block:\s*-11px;/u);
  });

  it("All EDs filter chips and Status and order are 40px faces with a 48px cover", () => {
    const ed = css("ward-management/ed/ed-index.module.css");
    expect(ed).toMatch(/\.phoneFilterRow > \.phoneFilterButton\s*\{\s*width:\s*40px;\s*height:\s*40px;/u);
    expect(ed).toMatch(/\.phoneServices\.phoneServices :global\(\[role="radio"\]\)\s*\{\s*height:\s*40px;/u);
    expect(ed).toMatch(/\.phoneServices\.phoneServices :global\(\[role="radio"\]\)::after\s*\{\s*inset:\s*-4px 0;/u);
    expect(ed).not.toMatch(/height:\s*32px/u);
  });
});

describe("two lines before any ellipsis", () => {
  it("wraps the hero sub-line, the hero pill text and the phone row's second line", () => {
    const hero = css("wf/hero-top.module.css");
    for (const selector of ["actSub", "pillText"]) {
      const body = hero.match(new RegExp(`\\n\\.${selector} \\{([^}]*)\\}`, "u"))?.[1] ?? "";
      expect(body, selector).toMatch(/-webkit-line-clamp:\s*2/u);
      expect(body, selector).not.toMatch(/white-space:\s*nowrap/u);
    }
    const phone = css("wf/phone.module.css").match(/\n\.rowMeta \{([^}]*)\}/u)?.[1] ?? "";
    expect(phone).toMatch(/-webkit-line-clamp:\s*2/u);
    expect(phone).not.toMatch(/white-space:\s*nowrap/u);
  });

  it("lets kit table cells grow and wrap, with an opt-in two-line clamp", () => {
    const table = css("wf/table.module.css");
    const td = table.match(/\n\.table td \{([^}]*)\}/u)?.[1] ?? "";
    expect(td).toMatch(/white-space:\s*normal/u);
    expect(td).not.toMatch(/text-overflow:\s*ellipsis/u);
    expect(table).toMatch(/\.twoLines \{[^}]*-webkit-line-clamp:\s*2/u);
  });
});

describe("one sticky bar, solid when pinned", () => {
  it("unpins the phone Statistics second bar", () => {
    const stats = css("ward-management/statistics/statistics-phone.module.css");
    expect(stats.match(/\n\.segPinned \{([^}]*)\}/u)?.[1] ?? "").toMatch(/position:\s*static/u);
  });

  // F-61 (PR E review, audit A5-17): the Places tab row stays pinned on a phone, so the kind switch
  // under it no longer pins too. Wider screens never draw it.
  it("unpins the phone Hub second bar", () => {
    const hub = css("ward-management/hub/hub.module.css");
    const phone = phoneBlocks(hub);
    expect(phone.match(/\.phoneKindBar \{([^}]*)\}/u)?.[1] ?? "").toMatch(/position:\s*static/u);
    const folder = phoneBlocks(css("wf/folder-tabs.module.css"));
    expect(folder.match(/\.nav\.nav \{([^}]*)\}/u)?.[1] ?? "").toMatch(/position:\s*sticky/u);
  });

  it("paints the pinned tab row and the scrolled header in solid slate, with no blur", () => {
    const folder = css("wf/folder-tabs.module.css");
    expect(folder).toMatch(/--wf-bar-frost:\s*var\(--wf-hero-2\);/u);
    expect(folder.match(/\n\.back \{([^}]*)\}/u)?.[1] ?? "").not.toMatch(/backdrop-filter/u);
    const bar = css("ward-management/shell/ward-bar.module.css");
    const scrolled =
      bar.match(/\.bar\.bar\.bar\[data-band="ink"\]\[data-scrolled="true"\]::before \{([^}]*)\}/u)?.[1] ?? "";
    expect(scrolled).toMatch(/background:\s*var\(--wf-hero-2\);/u);
    expect(scrolled).not.toMatch(/backdrop-filter/u);
  });
});

it("names the held-up link with its visible words first", () => {
  expect(HELD_UP_LINK_LABEL.startsWith("See all")).toBe(true);
});
