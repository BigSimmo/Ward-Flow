import type { MetadataRoute } from "next";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand";
import { APP_THEME_COLORS } from "@/lib/theme";

const WARD_FLOW = "/ward-flow";
const SHORTCUT_ICONS = [{ src: "/icons/icon-96", type: "image/png", sizes: "96x96" }];

// PWA manifest — makes the app installable with a proper icon. Icons derive from
// the single brand-mark source: the SVG for modern browsers, plus generated PNG
// "any" and "maskable" sets from app/icons/[variant]. The manifest takes one
// colour, so it uses the light app colour (APP_THEME_COLORS.light) for the splash
// screen and title bar; the page's own viewport.themeColor / meta theme-color
// (app/layout.tsx and use-theme.ts) still follows light and dark once it loads.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    // `id` stays "/" so an app installed before the start page moved is still the same app.
    id: "/",
    // Opens Ward Flow Home directly: "/" redirects there, which cost a server round trip on every launch.
    start_url: WARD_FLOW,
    scope: "/",
    lang: "en-AU",
    dir: "ltr",
    display: "standalone",
    background_color: APP_THEME_COLORS.light,
    theme_color: APP_THEME_COLORS.light,
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
    // Long-press shortcuts (Android). Ward Flow pages only, approved with the PWA plan in Oct 2026; the
    // former clinical app's four were removed with its pages on 25-26 September 2026.
    shortcuts: [
      {
        name: "New referral",
        short_name: "New referral",
        description: "Log a new psychiatric inpatient referral",
        url: `${WARD_FLOW}/referrals/new`,
        icons: SHORTCUT_ICONS,
      },
      {
        name: "Alerts",
        short_name: "Alerts",
        description: "View active broadcast alerts and escalations",
        url: `${WARD_FLOW}/alerts`,
        icons: SHORTCUT_ICONS,
      },
      {
        name: "Referrals",
        short_name: "Referrals",
        description: "Triage incoming referrals and see which wards have room",
        url: `${WARD_FLOW}/referrals`,
        icons: SHORTCUT_ICONS,
      },
    ],
    // Richer Android install sheet. Phone captures of the synthetic demo (made-up records only).
    screenshots: [
      {
        src: "/screenshots/home-narrow.webp",
        type: "image/webp",
        sizes: "780x1688",
        form_factor: "narrow",
        label: "Home",
      },
      {
        src: "/screenshots/referrals-narrow.webp",
        type: "image/webp",
        sizes: "780x1688",
        form_factor: "narrow",
        label: "Referrals",
      },
      {
        src: "/screenshots/ward-narrow.webp",
        type: "image/webp",
        sizes: "780x1688",
        form_factor: "narrow",
        label: "A ward",
      },
    ],
  };
}
