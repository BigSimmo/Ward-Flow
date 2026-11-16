// Single source of truth for the BedChart mark, the Folded B: a pillow above a
// bed whose lower right corner is turned down like a sheet (D-261, 16 November
// 2026). Every surface that draws the mark derives from the geometry here, so
// the favicon, the in-app mark, the browser-tab icon (app/icon.svg) and the
// generated app-icon, maskable, launch-screen and link-preview images can never
// drift apart.
//
// The construction is recorded in docs/brand/brand-mark.md. The paths below are
// the exact output of the master generator (master.py in the brand pack), not
// hand drawn. Do not edit one master without regenerating the set.
//
// Pure data and strings (no JSX, no imports), so it is consumable everywhere:
// the in-app BrandMark renders the geometry as JSX, app/icon.svg is written from
// brandIconSvg(), and the next/og image routes embed brandMarkSvg() as a data URI.

/** One optical-size master: its own square drawing grid and the three shapes.
 *  `flap` is the turned-down corner; it is null where the fold is dropped. */
export type BrandMaster = {
  viewBox: number;
  pillow: string;
  bed: string;
  flap: string | null;
  /** Width of the crease cut between the flap and the bed, in grid units. */
  crease: number;
  /** The ink box of the whole mark, used to set it inside a line of type. */
  ink: { x: number; y: number; width: number; height: number };
};

export type BrandMasterName = "display" | "text" | "small" | "micro";

/** The four masters. The mark is redrawn, not just scaled, as it gets smaller:
 *  - display (48 px and up): the full fold, a 2-unit crease.
 *  - text (24 to 47 px): a heavier 2.6-unit crease and a rounder flap.
 *  - small (17 to 23 px): a tighter bed corner, a bigger fold, a 3-unit crease.
 *  - micro (16 px and below): redrawn on a 16-pixel grid, every edge on a whole
 *    pixel, and no fold, because at that size a fold only blurs. */
export const BRAND_MASTERS: Record<BrandMasterName, BrandMaster> = {
  display: {
    viewBox: 48,
    pillow: "M11.75 5H28A7.75 7.75 0 0 1 28 20.5H11.75A2.5 2.5 0 0 1 9.25 18V7.5A2.5 2.5 0 0 1 11.75 5Z",
    bed:
      "M11.75 24.5H29.5A9.25 9.25 0 0 1 38.75 33.75V33.336Q38.75 33.75 38.457 34.043L29.793 42.707Q29.5 43 29.086 43" +
      "H11.75A2.5 2.5 0 0 1 9.25 40.5V27A2.5 2.5 0 0 1 11.75 24.5Z",
    flap: "M38.75 33.75H32.5A3 3 0 0 0 29.5 36.75V43Z",
    crease: 2,
    ink: { x: 9.25, y: 5, width: 29.5, height: 38 },
  },
  text: {
    viewBox: 48,
    pillow: "M11.75 5H28A7.75 7.75 0 0 1 28 20.5H11.75A2.5 2.5 0 0 1 9.25 18V7.5A2.5 2.5 0 0 1 11.75 5Z",
    bed:
      "M11.75 24.5H29.5A9.25 9.25 0 0 1 38.75 33.75V33.253Q38.75 33.75 38.399 34.101L29.851 42.649Q29.5 43 29.003 43" +
      "H11.75A2.5 2.5 0 0 1 9.25 40.5V27A2.5 2.5 0 0 1 11.75 24.5Z",
    flap: "M38.75 33.75H32.583A3.083 3.083 0 0 0 29.5 36.833V43Z",
    crease: 2.6,
    ink: { x: 9.25, y: 5, width: 29.5, height: 38 },
  },
  small: {
    viewBox: 48,
    pillow: "M11.75 5H28.125A7.625 7.625 0 0 1 28.125 20.25H11.75A2.5 2.5 0 0 1 9.25 17.75V7.5A2.5 2.5 0 0 1 11.75 5Z",
    bed:
      "M11.75 24.75H31.75A7 7 0 0 1 38.75 31.75V31.336Q38.75 31.75 38.457 32.043L27.793 42.707Q27.5 43 27.086 43" +
      "H11.75A2.5 2.5 0 0 1 9.25 40.5V27.25A2.5 2.5 0 0 1 11.75 24.75Z",
    flap: "M38.75 31.75H30.5A3 3 0 0 0 27.5 34.75V43Z",
    crease: 3,
    ink: { x: 9.25, y: 5, width: 29.5, height: 38 },
  },
  micro: {
    viewBox: 16,
    pillow: "M4 2H9.5A2.5 2.5 0 0 1 9.5 7H4A1 1 0 0 1 3 6V3A1 1 0 0 1 4 2Z",
    bed: "M4 8H10A3 3 0 0 1 10 14H4A1 1 0 0 1 3 13V9A1 1 0 0 1 4 8Z",
    flap: null,
    crease: 0,
    ink: { x: 3, y: 2, width: 10, height: 12 },
  },
};

/** The master for a mark drawn `px` CSS pixels square. */
export function pickBrandMaster(px: number): BrandMasterName {
  if (px >= 48) return "display";
  if (px >= 24) return "text";
  if (px >= 17) return "small";
  return "micro";
}

/** Two-part colours: the pillow carries the accent, the bed the deep ink. */
export type BrandColors = { pillow: string; bed: string };

/** On a light page: --wf-pri-1 and --wf-hero-2 from the v9 kit. */
export const BRAND_ON_LIGHT: BrandColors = { pillow: "#2f6aa3", bed: "#1c2f41" };
/** On a dark page, the navy hero band, and every icon tile: --wf-accent (dark)
 *  and --wf-ink-1 (dark). The light pillow is only 2.1:1 on navy, so anything
 *  dark always takes this pair. */
export const BRAND_ON_DARK: BrandColors = { pillow: "#8cbcf0", bed: "#e9eef3" };
/** One colour for platforms that read only the alpha channel. */
export const BRAND_MONOCHROME: BrandColors = { pillow: "#ffffff", bed: "#ffffff" };

/** App-icon field: --wf-hero-1 (light) and --wf-surface (dark). */
export const BRAND_FIELD = { light: "#22384d", dark: "#141d26" } as const;

/** 512-unit square app-icon tile with a 3/16 corner radius, as before. */
export const BRAND_TILE = { size: 512, rx: 96 } as const;

/** Inner SVG for one master. The crease is a cut, not a painted line: a mask
 *  removes it from the bed and the flap, so the mark sits on any ground (tile,
 *  hero band, card, transparent icon) without a visible stripe. `id` must be
 *  unique in the document. */
export function brandMarkInner(colors: BrandColors, master: BrandMasterName, id = "bc-crease"): string {
  const m = BRAND_MASTERS[master];
  if (!m.flap) {
    return `<path d="${m.pillow}" fill="${colors.pillow}"/><path d="${m.bed}" fill="${colors.bed}"/>`;
  }
  const v = m.viewBox;
  return (
    `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${v}" height="${v}">` +
    `<rect width="${v}" height="${v}" fill="#fff"/>` +
    `<path d="${m.flap}" fill="none" stroke="#000" stroke-width="${m.crease}" stroke-linejoin="round"/>` +
    `</mask></defs>` +
    `<path d="${m.pillow}" fill="${colors.pillow}"/>` +
    `<g mask="url(#${id})"><path d="${m.bed}" fill="${colors.bed}"/><path d="${m.flap}" fill="${colors.pillow}"/></g>`
  );
}

/** Standalone SVG of the bare mark, drawn for `px` pixels (which picks the
 *  master). Embedded as a data URI in the next/og image routes. */
export function brandMarkSvg(colors: BrandColors = BRAND_ON_LIGHT, px = 512): string {
  const master = pickBrandMaster(px);
  const v = BRAND_MASTERS[master].viewBox;
  return `<svg viewBox="0 0 ${v} ${v}" xmlns="http://www.w3.org/2000/svg">${brandMarkInner(colors, master)}</svg>`;
}

/** The mark on its rounded navy tile, drawn for `px` pixels: the app icon.
 *  `inset` is the mark's share of the tile side (0.64 leaves the corner margin). */
export function brandTileSvg(px = 512, field: string = BRAND_FIELD.light, inset = 0.64): string {
  const t = BRAND_TILE;
  const markPx = px <= 16 ? px : px * inset;
  const master = pickBrandMaster(markPx);
  const v = BRAND_MASTERS[master].viewBox;
  const s = (t.size * (px <= 16 ? 1 : inset)) / v;
  const o = (t.size - v * s) / 2;
  return (
    `<svg viewBox="0 0 ${t.size} ${t.size}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${t.size}" height="${t.size}" rx="${t.rx}" fill="${field}"/>` +
    `<g transform="translate(${round(o)} ${round(o)}) scale(${round(s)})">${brandMarkInner(BRAND_ON_DARK, master)}</g>` +
    `</svg>`
  );
}

/** The browser-tab icon (app/icon.svg). Browsers draw it at 16 to 32 px, so it
 *  uses the small master on the navy tile, with a dark-mode field. Written by
 *  scripts/generate-brand-assets.ts and checked by tests/brand-mark-optics.test.ts. */
export function brandIconSvg(): string {
  const t = BRAND_TILE;
  const m = BRAND_MASTERS.small;
  const s = (t.size * 0.68) / m.viewBox;
  const o = (t.size - m.viewBox * s) / 2;
  return `<svg viewBox="0 0 ${t.size} ${t.size}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .field { fill: ${BRAND_FIELD.light}; }
    @media (prefers-color-scheme: dark) {
      .field { fill: ${BRAND_FIELD.dark}; }
    }
  </style>
  <rect class="field" width="${t.size}" height="${t.size}" rx="${t.rx}" />
  <g transform="translate(${round(o)} ${round(o)}) scale(${round(s)})">${brandMarkInner(BRAND_ON_DARK, "small")}</g>
</svg>
`;
}

function round(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}
