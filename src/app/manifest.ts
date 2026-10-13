import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand";

// PWA manifest — makes the app installable with a proper icon. Icons derive from
// the single brand-mark source: the SVG for modern browsers, plus generated PNG
// "any" and "maskable" sets from app/icons/[variant]. Theme colours stay on
// viewport.themeColor / meta theme-color (see app/layout.tsx and use-theme.ts)
// so light/dark can update without a static PWA manifest colour lock.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "en-AU",
    dir: "ltr",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    // Prefer the standalone window but allow a graceful minimal-ui fallback on
    // platforms that cannot honour it; never fall back to fullscreen.
    display_override: ["standalone", "minimal-ui"],
    // Focus the already-open app window on launch instead of spawning a second
    // instance; "auto" lets platforms without the capability use their default.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    categories: ["medical", "productivity", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable-192", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/maskable-512", type: "image/png", sizes: "512x512", purpose: "maskable" },
      { src: "/icons/monochrome-192", type: "image/png", sizes: "192x192", purpose: "monochrome" },
      { src: "/icons/monochrome-512", type: "image/png", sizes: "512x512", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: "Coordinator Hub",
        short_name: "Coordinator Hub",
        description: "Coordinator Hub bed management",
        url: "/mockups/ward-flow",
        icons: [{ src: "/icons/icon-192", sizes: "192x192" }],
      },
      {
        name: "Capacity Matrix",
        short_name: "Capacity Matrix",
        description: "Capacity Matrix statewide bed overview",
        url: "/mockups/ward-flow/capacity",
        icons: [{ src: "/icons/icon-192", sizes: "192x192" }],
      },
      {
        name: "ED Psychiatry",
        short_name: "ED Psychiatry",
        description: "ED Psychiatry emergency department flow",
        url: "/mockups/ward-flow/ed",
        icons: [{ src: "/icons/icon-192", sizes: "192x192" }],
      },
    ],
  };
}
