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

const nextConfig: NextConfig = {
  distDir: requestedDistDir || ".next",
  // WARD_GATE_BUILD=1 (Ward Flow fold gate only): skip the build's own type check, because the gate
  // runs the full `tsc -p tsconfig.typecheck.json` on the same commit. Never set for a real build.
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
  experimental: {
    // Default 1 is the safe fallback for a Node-24 webpack WasmHash worker crash
    // seen on constrained local builds (see the webpack hashFunction override
    // below). CI runners have the cores/memory to build in parallel, so raise it
    // there via NEXT_BUILD_CPUS without changing the local default.
    cpus: process.env.NEXT_BUILD_CPUS ? Number(process.env.NEXT_BUILD_CPUS) : 1,
    optimizePackageImports: ["lucide-react"],
    // Proxy is on every API route. Bound its buffered client body so a
    // chunked multipart upload cannot grow without limit before route code
    // reaches request.formData(). MAX_UPLOAD_MB is capped at 150 below this
    // 151 MiB transport envelope (1 MiB reserved for multipart framing).
    proxyClientMaxBodySize: "151mb",
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
  webpack(config) {
    // Avoid a Next/webpack WasmHash worker crash observed on Node 24 during local production builds.
    config.output = {
      ...config.output,
      hashFunction: "sha256",
    };
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
    ];
  },
};

export default async function loadNextConfig() {
  return withOptionalBundleAnalyzer(nextConfig);
}
