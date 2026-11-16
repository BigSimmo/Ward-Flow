import { ImageResponse } from "next/og";

import { BrandIconImage } from "@/lib/brand-image";

// Fixes the appleWebApp.capable mismatch: without this, iOS "Add to Home
// Screen" falls back to a page screenshot. iOS masks corners and paints
// transparency black, so render the full-bleed navy field with the mark on it.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandIconImage size={size.width} kind="field" inset={0.62} />, {
    ...size,
  });
}
