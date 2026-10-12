/**
 * Privacy guard that refuses real Australian healthcare identifiers before a payload is sent or
 * saved. Ward Flow holds synthetic data only.
 *
 * The scan itself lives in `backend/ward-flow/synthetic-scan.mjs`, the single implementation the
 * Azure backend also runs server-side on every session save and shared workspace command. This
 * file only re-exports it with TypeScript types, so the browser and the server cannot drift apart.
 * See that module for the identifier formats it detects and the synthetic shapes it leaves alone.
 */
import {
  checkSyntheticPayload as scanPayload,
  scanIdentifierText as scanText,
} from "../../backend/ward-flow/synthetic-scan.mjs";

export type SyntheticCheckResult = { safe: true } | { safe: false; reason: string; sample?: string };

export const checkSyntheticPayload: (payload: unknown, maxDepth?: number) => SyntheticCheckResult = scanPayload;

/** One string's verdict, or null when it carries no real-looking identifier. */
export const scanIdentifierText: (value: string, options?: { numeric?: boolean }) => SyntheticCheckResult | null =
  scanText;
