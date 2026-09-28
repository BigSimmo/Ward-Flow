import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const appDir = path.join(process.cwd(), "src", "app");
const siteMapPath = path.join(process.cwd(), "docs", "site-map.md");

type RouteKind = "page" | "handler";

type DiscoveredRoute = {
  route: string;
  file: string;
};

type RedirectRoute = {
  route: string;
  file: string;
  target: string;
};

type SiteMapData = {
  pageRoutes: DiscoveredRoute[];
  publicRouteHandlers: DiscoveredRoute[];
  apiRoutes: DiscoveredRoute[];
  redirects: RedirectRoute[];
  nonRoutedMockupArtifacts: string[];
};

const documentedRedirectTargets: Record<string, string> = {
  // The proxy and the page both forward this unlinked compatibility path; pinned because
  // the page's `redirect()` target is not a plain string literal.
  "/mockups/ward-flow/constellation": "/mockups/ward-flow/network",
};

// Ward Flow's routes carry no curated description: they render with the generic "Route
// discovered from app directory" fallback in the Mockup/prototype routes section below.
const routeDescriptions: Record<string, string> = {};

const publicRouteHandlerDescriptions: Record<string, string> = {
  "/icons/[variant]": "Dynamically generated application icon handler.",
};

const apiDescriptions: Record<string, string> = {
  "/api/health": "Railway deployment healthcheck.",
  "/api/local-project-id": "Local project identity guard.",
};

const routeOwnershipRows = [
  ["Ward Flow screens", "src/app/mockups/ward-flow, src/components/ward-management"],
  ["Ward Flow sign-in and digest", "src/app/mockups/ward-flow-sign-in, src/app/mockups/ward-flow-digest"],
  ["Global shell layouts", "src/app/layout.tsx, src/app/mockups/layout.tsx"],
  ["Mockups", "src/app/mockups"],
] as const;

function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

function routeSegment(segment: string) {
  if (segment.startsWith("(") && segment.endsWith(")")) return null;
  if (segment.startsWith("@")) return null;
  return segment;
}

function isApiRoute(route: string) {
  return route === "/api" || route.startsWith("/api/");
}

function fileToRoute(filePath: string, kind: RouteKind) {
  const suffix = path.basename(filePath);
  const expectedSuffixes = kind === "page" ? ["page.tsx"] : ["route.ts", "route.tsx"];
  if (!expectedSuffixes.includes(suffix)) {
    throw new Error(`Unsupported ${kind} route file: ${filePath}`);
  }
  const relative = toPosixPath(path.relative(appDir, filePath));
  const withoutFile = relative.slice(0, -suffix.length).replace(/\/$/, "");
  const segments = withoutFile.split("/").filter(Boolean).map(routeSegment).filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "/";
}

function collectFiles(root: string, targetFileName: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, targetFileName));
      continue;
    }
    if (entry.isFile() && entry.name === targetFileName) files.push(fullPath);
  }
  return files;
}

function discoverRoutes(kind: RouteKind): DiscoveredRoute[] {
  const targetFiles = kind === "page" ? ["page.tsx"] : ["route.ts", "route.tsx"];
  return targetFiles
    .flatMap((targetFile) => collectFiles(appDir, targetFile))
    .map((file) => ({
      route: fileToRoute(file, kind),
      file: toPosixPath(path.relative(process.cwd(), file)),
    }))
    .sort((left, right) => left.route.localeCompare(right.route) || left.file.localeCompare(right.file));
}

function discoverRedirects(routes: DiscoveredRoute[]): RedirectRoute[] {
  return routes
    .map((route) => {
      const source = readFileSync(path.join(process.cwd(), route.file), "utf8");
      const target =
        documentedRedirectTargets[route.route] ?? source.match(/\bredirect\(\s*["']([^"']+)["']\s*\)/)?.[1];
      return target ? { ...route, target } : null;
    })
    .filter((value): value is RedirectRoute => Boolean(value))
    .sort((left, right) => left.route.localeCompare(right.route));
}

function discoverNonRoutedMockupArtifacts() {
  const mockupsDir = path.join(process.cwd(), "mockups");
  if (!existsSync(mockupsDir)) return [];
  return collectFiles(mockupsDir, "page.tsx")
    .map((file) => toPosixPath(path.relative(process.cwd(), file)))
    .sort((left, right) => left.localeCompare(right));
}

export function collectSiteMapData(): SiteMapData {
  const pageRoutes = discoverRoutes("page");
  const routeHandlers = discoverRoutes("handler");
  const publicRouteHandlers = routeHandlers.filter((route) => !isApiRoute(route.route));
  return {
    pageRoutes,
    publicRouteHandlers,
    apiRoutes: routeHandlers.filter((route) => isApiRoute(route.route)),
    redirects: discoverRedirects([...pageRoutes, ...publicRouteHandlers]),
    nonRoutedMockupArtifacts: discoverNonRoutedMockupArtifacts(),
  };
}

function bullet(route: string, description?: string) {
  return `- \`${route}\`${description ? ` - ${description}` : ""}`;
}

function routeLine(route: DiscoveredRoute, descriptionMap: Record<string, string>) {
  return bullet(
    route.route,
    `${descriptionMap[route.route] ?? "Route discovered from app directory"} Source: \`${route.file}\`.`,
  );
}

function section(title: string, lines: string[]) {
  return [`## ${title}`, "", ...lines, ""];
}

function renderSiteMapRaw(data = collectSiteMapData()) {
  const productRoutes = data.pageRoutes.filter(
    (route) => !route.route.startsWith("/api") && !route.route.startsWith("/mockups"),
  );
  const mockupRoutes = data.pageRoutes.filter((route) => route.route.startsWith("/mockups"));

  const lines = [
    "# Ward Flow Site Map",
    "",
    "This file is generated by `npm run docs:update` (or `npm run sitemap:update` directly). Run `npm run sitemap:check` to verify it is current.",
    "",
    ...section(
      "Main product routes",
      productRoutes.length
        ? productRoutes.map((route) => routeLine(route, routeDescriptions))
        : ["- None. Every product screen is a Ward Flow route under `/mockups/ward-flow`."],
    ),
    ...section("Mockup/prototype routes", [
      ...mockupRoutes.map((route) => routeLine(route, routeDescriptions)),
      ...(data.nonRoutedMockupArtifacts.length
        ? [
            "",
            "### Non-routed mockup artifacts",
            "",
            ...data.nonRoutedMockupArtifacts.map((file) =>
              bullet(file, "Root-level mockup artifact outside `src/app`; not a Next route."),
            ),
          ]
        : []),
    ]),
    ...section(
      "Public utility route handlers",
      data.publicRouteHandlers.map((route) => routeLine(route, publicRouteHandlerDescriptions)),
    ),
    ...section(
      "API routes",
      data.apiRoutes.map((route) => routeLine(route, apiDescriptions)),
    ),
    ...section(
      "Redirects",
      data.redirects.length
        ? data.redirects.map((redirect) =>
            bullet(redirect.route, `Redirects to \`${redirect.target}\`. Source: \`${redirect.file}\`.`),
          )
        : ["- No page-level redirects discovered."],
    ),
    ...section("Known caveats and stale-path flags", [
      "- `/mockups/*` routes are development-only: in production `src/proxy.ts` returns 404 for every path except the developer-gated subtrees named in `src/lib/developer-area/headers.ts`, which carry their own gate, and the isolated offline Playwright server. Responses under `/mockups/:path*` carry `X-Robots-Tag: noindex, nofollow`.",
    ]),
    ...section("Route ownership/source map", [
      "| Area | Source |",
      "| --- | --- |",
      ...routeOwnershipRows.map(([area, source]) => `| ${area} | \`${source}\` |`),
    ]),
  ];

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export async function renderSiteMap(data = collectSiteMapData()) {
  return format(renderSiteMapRaw(data), { parser: "markdown", printWidth: 120 });
}

async function main() {
  const expected = await renderSiteMap();
  const check = process.argv.includes("--check");

  if (check) {
    const current = existsSync(siteMapPath) ? readFileSync(siteMapPath, "utf8") : "";
    if (current !== expected) {
      console.error("docs/site-map.md is stale. Run `npm run sitemap:update` and commit the result.");
      process.exitCode = 1;
    }
    return;
  }

  writeFileSync(siteMapPath, expected, "utf8");
  console.log(`Updated ${toPosixPath(path.relative(process.cwd(), siteMapPath))}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
