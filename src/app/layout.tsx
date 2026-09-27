import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { resolveMetadataBase } from "@/lib/metadata-base";
import { APP_THEME_COLORS, THEME_BOOTSTRAP_SCRIPT, THEME_COOKIE_NAME } from "@/lib/theme";
import { AppAnnouncements } from "@/components/app-announcements";
import { OverlayRoot } from "@/components/ui/overlay-root";
import { PRIVATE_APP_ROBOTS_METADATA } from "@/lib/crawler-policy";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const geistSans = localFont({
  src: "../fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  // next/font/local only emits font-weight when this is set. The vendored
  // WOFF2s are variable (wght 100–900); without the range, @font-face has no
  // font-weight and browsers faux-bold headings.
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
  // The mono face is only used deep in the UI (tabular figures, `kbd`, code) and
  // never in initial/LCP text, so don't preload it on every route — it competes
  // for the critical-path connection. It still loads on-demand via `swap` when
  // first painted, while the body sans face remains preloaded for LCP text.
  preload: false,
});

const baseMetadata: Metadata = {
  applicationName: BRAND_NAME,
  title: BRAND_NAME,
  description: BRAND_DESCRIPTION,
  robots: PRIVATE_APP_ROBOTS_METADATA,
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "black-translucent",
  },
};

/**
 * Generates application metadata with a request-aware base URL.
 *
 * @returns The application metadata, including its resolved base URL.
 */
export async function generateMetadata(): Promise<Metadata> {
  const allowRequestOrigin = process.env.NODE_ENV !== "production";
  const requestHeaders = await headers();
  const metadataHeaders = allowRequestOrigin ? requestHeaders : new Headers();
  return {
    ...baseMetadata,
    metadataBase: resolveMetadataBase(metadataHeaders, {
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      trustedDeploymentDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
      allowRequestOrigin,
    }),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: APP_THEME_COLORS.dark },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce set by src/proxy.ts. Next.js stamps its own scripts
  // automatically, but the hand-authored theme-flash <script> below is ours, so
  // it must carry the nonce explicitly or the strict script-src blocks it (a
  // silent runtime failure: theme flash returns). Reading headers() opts the app
  // into dynamic rendering — inherent to nonce-based CSP.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const cookieStore = await cookies();
  const clinicalTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const isDark = clinicalTheme === "dark";
  const themeClass = isDark ? "dark" : "";

  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ckb-v2 ${themeClass}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Applies the resolved theme before first paint on every route (standalone
            pages don't mount useTheme, and hydration-time toggling flashes light).
            Mirrors resolveThemePreference in src/lib/theme.ts: stored choice wins,
            otherwise the OS preference. Key must match use-theme.ts. The second
            block applies the density/motion preferences (keys must match
            use-app-preferences.ts) so an opted-in choice never flashes in.
            Its catch swallows deliberately (see the inline note): this runs
            before React mounts, so there is no logger or toast to report to,
            and both failure modes — storage blocked, or corrupt stored JSON —
            mean the same thing, that the default density/motion apply. */}
        <script
          nonce={nonce}
          // Next.js strips the nonce from the client payload (so scripts can't
          // read it), which reads as a hydration mismatch on this attribute.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `${THEME_BOOTSTRAP_SCRIPT}(function(){try{var p=JSON.parse(localStorage.getItem("clinical-kb-preferences")||"{}");if(p&&typeof p==="object"){if(p.density==="compact"||p.density==="spacious"){document.documentElement.setAttribute("data-density",p.density);}if(p.motion==="reduced"||p.motion==="full"){document.documentElement.setAttribute("data-motion",p.motion);}}}catch(e){/* storage blocked or stored preferences JSON corrupt - the default density/motion apply */}})();`,
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:top-[max(0.75rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-lg focus:border focus:border-[color:var(--border-lux)] focus:bg-[color:var(--surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--text)] focus:shadow-[var(--shadow-elevated)]"
        >
          Skip to main content
        </a>
        <AppAnnouncements />
        <OverlayRoot />
        {children}
      </body>
    </html>
  );
}
