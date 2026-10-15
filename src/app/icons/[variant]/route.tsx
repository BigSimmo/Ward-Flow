import { ImageResponse } from "next/og";

import { BRAND_ICON_FIELD, BRAND_MONOCHROME, BrandIconImage, brandMarkDataUri } from "@/lib/brand-image";
import { APP_THEME_COLORS } from "@/lib/theme";

import { STARTUP_SCREENS, startupImageVariant } from "../startup-images";

// PWA icon set referenced by app/manifest.ts. "any" icons are transparent so the
// mark's own rounded tile shows; "maskable" icons are full-bleed teal with the
// mark inside the ~72% safe zone so platform circular/rounded masks don't crop it;
// "monochrome" icons are a white alpha-only silhouette that platforms recolour.
const VARIANTS = {
  // Manifest shortcut icons (app/manifest.ts): Android asks for 96px.
  "icon-96": { size: 96, background: "transparent", inset: 1 },
  "icon-192": { size: 192, background: "transparent", inset: 1 },
  "icon-512": { size: 512, background: "transparent", inset: 1 },
  "maskable-192": { size: 192, background: BRAND_ICON_FIELD, inset: 0.72 },
  "maskable-512": { size: 512, background: BRAND_ICON_FIELD, inset: 0.72 },
  "monochrome-192": { size: 192, background: "transparent", inset: 1, colors: BRAND_MONOCHROME },
  "monochrome-512": { size: 512, background: "transparent", inset: 1, colors: BRAND_MONOCHROME },
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
    const mark = Math.round(startup.width * 0.28);
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
        <img src={brandMarkDataUri()} width={mark} height={mark} alt="" />
      </div>,
      { width: startup.width, height: startup.height, headers: CACHE_HEADERS },
    );
  }
  const conf = VARIANTS[variant as keyof typeof VARIANTS];
  if (!conf) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <BrandIconImage
      size={conf.size}
      background={conf.background}
      inset={conf.inset}
      colors={"colors" in conf ? conf.colors : undefined}
    />,
    {
      width: conf.size,
      height: conf.size,
      headers: CACHE_HEADERS,
    },
  );
}
