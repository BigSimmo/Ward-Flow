import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSecurityHeaders, resolveRuntimeFlags } from "./src/lib/security-headers";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedDistDir = process.env.NEXT_DIST_DIR?.trim();
if (requestedDistDir && !/^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(requestedDistDir)) {
  throw new Error("NEXT_DIST_DIR must be an owned .next-playwright/<run-id>/dist directory.");
}
const requestedTsConfigPath = process.env.NEXT_TSCONFIG_PATH?.trim();
if (requestedTsConfigPath && !/^\.next-playwright\/[a-z0-9-]+\/tsconfig\.json$/i.test(requestedTsConfigPath)) {
  throw new Error("NEXT_TSCONFIG_PATH must be an owned .next-playwright/<run-id>/tsconfig.json file.");
}

// Static (non-CSP) headers for every route. The nonce'd CSP is emitted per
// request from src/proxy.ts; both derive their runtime flags from the same helper.
const securityHeaders = buildSecurityHeaders(resolveRuntimeFlags());

// Opt-in bundle analysis (npm run build:analyze). The analyzer is a devDependency
// loaded lazily so production runtimes (pruned node_modules) never import it.
async function withOptionalBundleAnalyzer(config: NextConfig): Promise<NextConfig> {
  if (process.env.ANALYZE !== "true") return config;
  const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
  return bundleAnalyzer({ enabled: true })(config);
}

/** The demo data modules a live shared build replaces (`webpack` below). */
export const LIVE_BUILD_DEMO_DATA =
  /^@\/components\/ward-management\/(ward-movements|ward-patients-seed|ward-admissions-seed|ward-rulings-demo|ward-demo-planned-moves)$/;

const nextConfig: NextConfig = {
  distDir: requestedDistDir || ".next",
  // WARD_GATE_BUILD=1 (Ward Flow fold gate and CI browser jobs only): skip the build's own type
  // check, because the gate or CI's static job type-checks the same commit (CI runs `next typegen`
  // first, so route types are covered). Never set for a real, deployed build.
  ...(requestedTsConfigPath || process.env.WARD_GATE_BUILD === "1"
    ? {
        typescript: {
          ...(requestedTsConfigPath ? { tsconfigPath: requestedTsConfigPath } : {}),
          ...(process.env.WARD_GATE_BUILD === "1" ? { ignoreBuildErrors: true } : {}),
        },
      }
    : {}),
  // Playwright and some local tooling hit the dev server via 127.0.0.1; without
  // this, Next blocks HMR/client hydration from that host and phone scroll-hide
  // never wires up its listeners.
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  // Fix list 7.3: the React Compiler memoises screens on the inputs it can see. Screens take the
  // warnings and the scenario's wards as inputs (`useDueSoonThresholds()`, `useWardNetwork()`), and
  // tests/ward-compiler-inputs.test.ts stops anything reading them from module-wide values again.
  reactCompiler: true,
  experimental: {
    // Default 1 is the safe fallback for a Node-24 webpack WasmHash worker crash
    // seen on constrained local builds (see the webpack hashFunction override
    // below). CI runners have the cores/memory to build in parallel, so raise it
    // there via NEXT_BUILD_CPUS without changing the local default.
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : 1,
    optimizePackageImports: ["lucide-react"],
    // Proxy is on every API route. Bound its buffered client body. The former
    // "151mb" envelope served PsychSift's multipart document upload; Ward Flow has
    // no upload route (its only API routes are GET /api/health and
    // /api/local-project-id), so 3 October 2026 lowered it to a modest 1 MiB.
    proxyClientMaxBodySize: "1mb",
  },
  poweredByHeader: false,
  images: {
    // Explicit responsive breakpoints for next/image. Leave minimumCacheTTL at
    // Next's default (60s): a day-long floor can retain optimizer output past
    // signed-URL lifetimes if a private preview ever omits `unoptimized`.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    // Prefer AVIF (~20-30% smaller than WebP), falling back to WebP, for any
    // next/image output.
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    root: projectRoot,
  },
  webpack(config, { webpack }) {
    // Avoid a Next/webpack WasmHash worker crash observed on Node 24 during local production builds.
    config.output = {
      ...config.output,
      hashFunction: "sha256",
    };
    // A live shared build carries no demo records: the server owns the board, so phones skip
    // downloading the synthetic night (review item 3.5). See live-build/ward-no-demo-data.ts.
    if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true")
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          LIVE_BUILD_DEMO_DATA,
          path.join(projectRoot, "src/components/ward-management/live-build/ward-no-demo-data.ts"),
        ),
      );
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Static design-review assets under public/mockups remain intentionally
        // retrievable, but must not appear in search results. Next applies
        // headers before public-file handling, so this covers nested assets as
        // well as the app-route namespace without broadening to other files.
        source: "/mockups/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Ward Flow left /mockups on 19 October 2026 and keeps the same header there: a synthetic
        // demonstration that must never be indexed. The root layout's robots metadata says the
        // same in the page itself.
        source: "/ward-flow/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/ward-flow-sign-in",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // The root-level design mockups in public/ (mockup.html, capacity-table-mockup.html,
        // referral-board-mockup.html) are served as static files in production too. They stay
        // retrievable for sharing but must never be indexed (12 October 2026 review, A4-7).
        source: "/:file([^/]+\\.html)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // PWA plan item 7: the service worker and the manifest are always revalidated, so a new
        // version reaches an installed app on its next load rather than after a day of HTTP cache.
        // No Service-Worker-Allowed header: the worker sits at the root, so it may already control
        // its /ward-flow scope.
        source: "/ward-flow-push-sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default async function loadNextConfig() {
  return withOptionalBundleAnalyzer(nextConfig);
}
