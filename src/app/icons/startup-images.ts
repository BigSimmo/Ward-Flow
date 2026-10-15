/**
 * iOS launch screens (PWA plan item 14, Oct 2026). Without a matching `apple-touch-startup-image`
 * an iPhone Home Screen app opens on a plain flash. iOS picks the image whose media query matches
 * the device exactly, so each entry is one screen size in portrait. A minimal set: the iPhone 14,
 * 15 and 16 families, plus the iPhone SE. Other devices keep the plain launch. Images come from
 * app/icons/[variant]/route.tsx (`/icons/startup-1170x2532`); app/layout.tsx lists them in
 * `appleWebApp.startupImage`.
 */
export const STARTUP_SCREENS = [
  { width: 390, height: 844, ratio: 3 }, // iPhone 14, 13, 12
  { width: 428, height: 926, ratio: 3 }, // iPhone 14 Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 16, 15, 15 Pro, 14 Pro
  { width: 430, height: 932, ratio: 3 }, // iPhone 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro
  { width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max
  { width: 375, height: 667, ratio: 2 }, // iPhone SE
] as const;

export type StartupScreen = (typeof STARTUP_SCREENS)[number];

/** The icon route variant for a screen, named by its pixel size: `startup-1170x2532`. */
export function startupImageVariant(screen: StartupScreen): string {
  return `startup-${screen.width * screen.ratio}x${screen.height * screen.ratio}`;
}

/** `appleWebApp.startupImage` entries: one image and its exact device media query per screen. */
export function startupImages(): { url: string; media: string }[] {
  return STARTUP_SCREENS.map((screen) => ({
    url: `/icons/${startupImageVariant(screen)}`,
    media:
      `(device-width: ${screen.width}px) and (device-height: ${screen.height}px) and ` +
      `(-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait)`,
  }));
}
