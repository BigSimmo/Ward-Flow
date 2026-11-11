/*
 * Ward desk QR code (Batch 5, item 42; QR library approved by Josh, 10 Nov 2026, D-137).
 *
 * The code holds the ward's web address only: this site's origin plus the ward route
 * (`/ward-flow/ward/<unitId>`), with no query string, fragment, sign-in token, code or patient
 * detail. Scanning it opens that ward's screen after the normal sign-in. It is made in the browser;
 * the encoder (`uqr`) is loaded only when a code is drawn, so no screen's bundle carries it.
 */

import { unitHref } from "../shell/ward-facade";

/** The exact text the code holds: the origin (scheme, host, port) and the ward route, nothing else. */
export function wardDeskUrl(origin: string, unitId: string): string {
  return `${new URL(origin).origin}${unitHref(unitId)}`;
}

/** Error correction M and the standard four-module quiet zone, so a printed desk code scans well. */
export const WARD_DESK_QR_OPTIONS = { ecc: "M", border: 4 } as const;

export type QrMatrix = { size: number; data: readonly (readonly boolean[])[] };

/** Encode the ward address. The encoder is a dynamic import, so it loads on first use only. */
export async function encodeWardDeskQr(url: string): Promise<QrMatrix> {
  const { encode } = await import("uqr");
  const result = encode(url, WARD_DESK_QR_OPTIONS);
  return { size: result.size, data: result.data };
}

/** One SVG path for every dark module, one unit per module ("M x y h1 v1 h-1 z"). */
export function qrPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  matrix.data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
    }),
  );
  return parts.join("");
}
