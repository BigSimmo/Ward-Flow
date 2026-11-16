import { ImageResponse } from "next/og";

import { BrandIconImage, brandMarkDataUri } from "@/lib/brand-image";
import { BRAND_ON_LIGHT } from "@/lib/brand-mark";
import { APP_THEME_COLORS } from "@/lib/theme";

import { STARTUP_SCREENS, startupImageVariant } from "../startup-images";

// PWA icon set referenced by app/manifest.ts. "any" icons are the mark on its own
// rounded navy tile with transparent corners; "maskable" icons are a full-bleed navy
// field with the mark inside the safe circle, so platform masks never crop it;
// "monochrome" icons are a white alpha-only silhouette that platforms recolour.
const VARIANTS = {
  // Manifest shortcut icons (app/manifest.ts): Android asks for 96px.
  "icon-96": { size: 96, kind: "tile", inset: 1 },
  "icon-192": { size: 192, kind: "tile", inset: 1 },
  "icon-512": { size: 512, kind: "tile", inset: 1 },
  "maskable-192": { size: 192, kind: "field", inset: 0.52 },
  "maskable-512": { size: 512, kind: "field", inset: 0.52 },
  "monochrome-192": { size: 192, kind: "monochrome", inset: 0.72 },
  "monochrome-512": { size: 512, kind: "monochrome", inset: 0.72 },
} as const;

// iOS launch screens (../startup-images.ts): the brand mark on the light app colour, the same colour
// as the manifest's background_color, so the launch runs straight into the app.
const STARTUP = new Map(
  STARTUP_SCREENS.map((screen) => [
    startupImageVariant(screen),
    { width: screen.width * screen.ratio, height: screen.height * screen.ratio },
  ]),
);

// Paths are unversioned (`/icons/icon-192`); do not mark immutable for a
// year. Revalidate daily so brand-mark updates propagate without a query
// bust (manifest tests forbid `?`/`#` on icon URLs).
const CACHE_HEADERS = { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" };

export function generateStaticParams() {
  return [...Object.keys(VARIANTS), ...STARTUP.keys()].map((variant) => ({ variant }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const startup = STARTUP.get(variant);
  if (startup) {
    const mark = Math.round(startup.width * 0.24);
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: APP_THEME_COLORS.light,
        }}
      >
        {/* Satori draws this into the PNG on the server; next/image does not apply inside ImageResponse. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brandMarkDataUri(BRAND_ON_LIGHT, mark)} width={mark} height={mark} alt="" />
      </div>,
      { width: startup.width, height: startup.height, headers: CACHE_HEADERS },
    );
  }
  const conf = VARIANTS[variant as keyof typeof VARIANTS];
  if (!conf) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandIconImage size={conf.size} kind={conf.kind} inset={conf.inset} />, {
    width: conf.size,
    height: conf.size,
    headers: CACHE_HEADERS,
  });
}
