import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The CSP's `style-src 'self' 'unsafe-inline'` (src/lib/security-headers.ts) blocks the drawing's
 * <link> tags to the Google Fonts stylesheet (fonts.googleapis.com/fonts.gstatic.com), which the
 * browser logs as a console error and then falls back to the page's own CSS font stack — the same
 * rendered look either way. Stripping those tags here avoids the blocked request without loosening
 * the CSP or touching the design-reference HTML itself.
 */
const GOOGLE_FONTS_LINK_TAG = /<link\b[^>]*\bhref=["'](?:https?:)?\/\/fonts\.(?:googleapis|gstatic)\.com[^"']*["'][^>]*\/?>\s*/gi;

/** Serve the single authoritative design reference without a second, drifting copy. */
export async function GET() {
  const document = await readFile(path.join(process.cwd(), "docs/ward-flow/mockups/ward-flow-digest.html"), "utf8");

  return new Response(document.replace(GOOGLE_FONTS_LINK_TAG, ""), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
