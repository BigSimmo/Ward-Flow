import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Minimal warnings (design audit, Josh 1 Nov 2026): the ward layout used to stack up to seven pinned
 * notes at once. Now the holder shows one, the most important present: the notes sit in priority
 * order and the stylesheet hides every note after the first one rendered. Each note renders nothing
 * when it has nothing to say, so the first one present is always the highest.
 */
const PRIORITY = [
  "WardBroadcastBanner",
  "WardRecoveryNotice",
  "WardOfflineBanner",
  "WardDowntimePackLine",
  "WardAccessBanner",
  "WardPracticeLine",
  "WardDemoNotSavedNote",
];

const strip = (text: string) => text.replace(/\{\/\*[\s\S]*?\*\/\}/gu, "").replace(/\/\*[\s\S]*?\*\//gu, "");

describe("one pinned note at a time, by priority", () => {
  const layout = strip(readFileSync("src/app/ward-flow/layout.tsx", "utf8"));
  const start = layout.indexOf("<div className={styles.bannerHolder}");
  const holder = layout.slice(start, layout.indexOf("</div>", start));

  it("mounts every note inside the holder, in priority order", () => {
    expect(start).toBeGreaterThan(-1);
    const order = [...holder.matchAll(/<(Ward\w+)\b/gu)].map((match) => match[1]);
    expect(order).toEqual(PRIORITY);
    // None of them is also mounted outside the holder, where it would show beside it.
    for (const name of PRIORITY) expect(layout.split(`<${name}`).length - 1, name).toBe(1);
  });

  it("mounts the practice line on its own, so it ranks below offline and the broadcast", () => {
    expect(holder).toContain("<WardOfflineBanner practice={false} />");
    const banner = readFileSync("src/components/ward-management/shell/ward-offline-banner.tsx", "utf8");
    expect(banner).toMatch(/export function WardPracticeLine\(\)/u);
    expect(banner).toMatch(/\{practice \? <WardPracticeLine \/> : null\}/u);
  });

  it("hides every note after the first one present", () => {
    const css = strip(readFileSync("src/app/ward-flow/ward-flow-layout.module.css", "utf8"));
    // `!important`: a note's own, more specific display rule must not show it beside the first.
    expect(css).toMatch(/\.bannerHolder > \* \+ \* \{\s*display: none !important;\s*\}/u);
  });
});
