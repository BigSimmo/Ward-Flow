/**
 * Wave 4 item 15 — alias pedagogy for the Delays family (MERGE 01).
 *
 * `/queue`, `/exceptions` and `/escalation` redirect here with `?from=…`. The banner names the
 * old bookmark so operators are not left thinking three boards still exist.
 */

export const DELAYS_ALIAS_FROM = ["queue", "exceptions", "escalation"] as const;

export type DelaysAliasFrom = (typeof DELAYS_ALIAS_FROM)[number];

const COPY: Record<DelaysAliasFrom, string> = {
  queue: "Opened from a Queue bookmark — that board is now Delays.",
  exceptions: "Opened from an Exceptions bookmark — that board is now Delays.",
  escalation: "Opened from an Escalation bookmark — that board is now Delays.",
};

export function parseDelaysAliasFrom(raw: string | null | undefined): DelaysAliasFrom | null {
  if (raw === "queue" || raw === "exceptions" || raw === "escalation") return raw;
  return null;
}

export function delaysAliasBannerCopy(from: DelaysAliasFrom): string {
  return COPY[from];
}
