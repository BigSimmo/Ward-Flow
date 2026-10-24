import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { STARTUP_SCREENS, startupImages } from "@/app/icons/startup-images";
import { generateStaticParams as iconParams } from "@/app/icons/[variant]/route";
import { APP_THEME_COLORS } from "@/lib/theme";
import { config as proxyConfig } from "@/proxy";

/** PWA plan items 1, 3, 7, 9, 10 and 14 (Oct 2026): the install surface. */

describe("web app manifest", () => {
  const app = manifest();

  it("opens Ward Flow Home directly, and stays the same installed app", () => {
    expect(app.start_url).toBe("/ward-flow");
    expect(app.id).toBe("/");
    expect(app.scope).toBe("/");
  });

  it("uses the light app colour for the splash screen and title bar", () => {
    expect(app.theme_color).toBe(APP_THEME_COLORS.light);
    expect(app.background_color).toBe(APP_THEME_COLORS.light);
  });

  it("offers the three Ward Flow shortcuts, each with an icon the icon route makes", () => {
    const variants = new Set(iconParams().map(({ variant }) => `/icons/${variant}`));
    expect(app.shortcuts?.map(({ name, url }) => [name, url])).toEqual([
      ["New referral", "/ward-flow/referrals/new"],
      ["Alerts", "/ward-flow/alerts"],
      ["Referrals", "/ward-flow/referrals"],
    ]);
    for (const shortcut of app.shortcuts ?? []) {
      expect(shortcut.short_name, shortcut.name).toBe(shortcut.name);
      expect(shortcut.description?.length ?? 0, shortcut.name).toBeGreaterThan(10);
      expect(existsSync(join(process.cwd(), "src/app", shortcut.url, "page.tsx")), shortcut.url).toBe(true);
      for (const icon of shortcut.icons ?? []) expect(variants.has(icon.src), icon.src).toBe(true);
    }
  });

  it("lists every icon from a file or the icon route, with no query string", () => {
    const variants = new Set(iconParams().map(({ variant }) => `/icons/${variant}`));
    for (const icon of app.icons ?? []) {
      expect(icon.src).not.toMatch(/[?#]/);
      if (icon.src.startsWith("/icons/")) expect(variants.has(icon.src), icon.src).toBe(true);
    }
  });

  it("shows narrow phone screenshots that exist, at their real size", () => {
    const shots = app.screenshots ?? [];
    expect(shots.length).toBeGreaterThanOrEqual(2);
    for (const shot of shots) {
      expect(shot.form_factor).toBe("narrow");
      expect(shot.sizes).toBe("780x1688");
      expect(shot.type).toBe("image/webp");
      const file = join(process.cwd(), "public", shot.src);
      expect(existsSync(file), shot.src).toBe(true);
      // A WebP file names its own width and height in the VP8/VP8L/VP8X header; check the real size.
      expect(webpSize(readFileSync(file)), shot.src).toEqual({ width: 780, height: 1688 });
    }
  });
});

function webpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

describe("iOS launch screens", () => {
  it("names one icon-route image per screen, matched by an exact portrait media query", () => {
    const variants = new Set(iconParams().map(({ variant }) => `/icons/${variant}`));
    const images = startupImages();
    expect(images).toHaveLength(STARTUP_SCREENS.length);
    expect(images[0]).toEqual({
      url: "/icons/startup-1170x2532",
      media:
        "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    });
    for (const image of images) expect(variants.has(image.url), image.url).toBe(true);
    expect(new Set(images.map((image) => image.media)).size).toBe(images.length);
  });

  it("is listed in the root metadata", () => {
    expect(readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8")).toContain("startupImage: startupImages()");
  });
});

describe("proxy matcher (PWA plan item 7)", () => {
  const [, pages] = proxyConfig.matcher;
  const runsProxy = (path: string) => new RegExp(`^${pages}$`).test(path);

  it("skips the generated app images, screenshots and the manifest", () => {
    for (const path of [
      "/icons/icon-192",
      "/icons/startup-1170x2532",
      "/apple-icon",
      "/screenshots/home-narrow.webp",
      "/manifest.webmanifest",
      "/icon.svg",
      "/_next/static/chunks/app.js",
    ]) {
      expect(runsProxy(path), path).toBe(false);
    }
  });

  it("still runs on every page, the worker script and the offline page", () => {
    for (const path of [
      "/",
      "/ward-flow",
      "/ward-flow/referrals",
      "/ward-flow-push-sw.js",
      "/ward-flow-offline.html",
      "/icons-elsewhere",
      "/apple-icon-page",
      "/ward-flow/icons/thing",
    ]) {
      expect(runsProxy(path), path).toBe(true);
    }
  });

  it("runs on unknown icon and screenshot paths, whose 404 page needs the CSP", () => {
    for (const path of [
      "/icons/anything-else",
      "/icons/icon-192/extra",
      "/screenshots/missing",
      "/screenshots/nested/home-narrow.webp",
    ]) {
      expect(runsProxy(path), path).toBe(true);
    }
    for (const { variant } of iconParams()) expect(runsProxy(`/icons/${variant}`), variant).toBe(false);
  });
});

describe("response headers (PWA plan item 7)", () => {
  it("sends the worker and the manifest with no-cache, so updates arrive on the next load", async () => {
    const { default: loadNextConfig } = await import("../next.config");
    const rules = (await (await loadNextConfig()).headers?.()) ?? [];
    for (const source of ["/ward-flow-push-sw.js", "/manifest.webmanifest"]) {
      const rule = rules.find((entry) => entry.source === source);
      expect(rule?.headers, source).toContainEqual({ key: "Cache-Control", value: "no-cache" });
    }
  });
});
