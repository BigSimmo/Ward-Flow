// Server-only helpers for drawing the BedChart mark inside next/og
// ImageResponse routes (apple-icon, PWA icons, launch screens, link preview).
// All derive from the single geometry source in ./brand-mark, so raster icons
// never drift from the in-app mark or the favicon.
import {
  BRAND_FIELD,
  BRAND_MONOCHROME,
  BRAND_ON_DARK,
  brandMarkSvg,
  brandTileSvg,
  type BrandColors,
} from "@/lib/brand-mark";

/** Opaque field behind full-bleed (apple, maskable) icons: --wf-hero-1. */
const BRAND_ICON_FIELD = BRAND_FIELD.light;

/** data URI of the bare mark, drawn for `px` pixels, for an <img> inside
 *  ImageResponse. Satori rasterises the SVG on the server. */
export function brandMarkDataUri(colors: BrandColors = BRAND_ON_DARK, px = 512): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(colors, px))}`;
}

/** data URI of the mark on its rounded navy tile. */
function brandTileDataUri(px = 512): string {
  return `data:image/svg+xml,${encodeURIComponent(brandTileSvg(px))}`;
}

/**
 * A square brand icon for ImageResponse.
 * - `tile`: the mark on its own rounded navy tile, transparent corners (PWA "any").
 * - `field`: a full-bleed navy field with the bare mark centred at `inset` of the
 *   side (apple-icon, PWA "maskable", whose platforms cut their own shape).
 * - `monochrome`: the white silhouette alone, for alpha-only platforms.
 */
export function BrandIconImage({
  size,
  kind,
  inset = 0.6,
}: {
  size: number;
  kind: "tile" | "field" | "monochrome";
  inset?: number;
}) {
  const markPx = Math.round(size * inset);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: kind === "field" ? BRAND_ICON_FIELD : "transparent",
      }}
    >
      {kind === "tile" ? (
        <img src={brandTileDataUri(size)} width={size} height={size} alt="" />
      ) : (
        <img
          src={brandMarkDataUri(kind === "monochrome" ? BRAND_MONOCHROME : BRAND_ON_DARK, markPx)}
          width={markPx}
          height={markPx}
          alt=""
        />
      )}
    </div>
  );
}
