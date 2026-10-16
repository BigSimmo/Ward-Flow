import type { MouseEvent } from "react";

export { cn } from "@/lib/cn";

/**
 * The click handler for an `aria-disabled` placeholder — a control whose feature
 * is not built yet, or whose action needs data this record does not have.
 *
 * Those controls carry `aria-disabled="true"` rather than the native `disabled`
 * attribute, because `disabled` takes a button out of the tab order: a keyboard
 * user (and a screen-reader user moving by Tab rather than by virtual cursor)
 * can never land on it, so the `title` and the `aria-describedby` reason we went
 * to the trouble of writing are never reached. `aria-disabled` keeps the tab
 * stop and the announcement — "dimmed"/"unavailable" plus the description — and
 * moves the job of doing nothing to this handler.
 *
 * It stops propagation as well as preventing the default, because that is what
 * the native attribute did: a disabled button fires no click at all, so nothing
 * bubbled to a clickable ancestor. Without `stopPropagation` a placeholder
 * inside a clickable row would start activating the row.
 */
export function ignoreUnavailableActivation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export const textMuted = "text-[color:var(--text-muted)]";
// Disabled is ENCODED, not faded. `opacity-50` dims the label and the fill
// together, so a disabled primary stayed a large saturated block that still read
// as available, and a disabled secondary's label dropped below 4.5:1. Instead:
// flatten the fill to --surface-subtle, put the label on --disabled, drop the
// shadow, and remove the press affordance. `!` is required because the variant
// classes that follow this base would otherwise win on source order.
// The `aria-disabled:` half is not belt-and-braces: an unavailable placeholder
// carries `aria-disabled="true"` and no native attribute (see
// `ignoreUnavailableActivation`), so without these the control would lose the
// whole encoding and render as available. The `!` also does a second job here —
// it outranks the un-suffixed `hover:` colours these recipes ship, which a
// native `disabled` control never reaches but an `aria-disabled` one does.
export const controlDisabled =
  "disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-subtle)]! disabled:text-[color:var(--disabled)]! disabled:shadow-none! disabled:active:translate-y-0 aria-disabled:cursor-not-allowed aria-disabled:border-[color:var(--border)] aria-disabled:bg-[color:var(--surface-subtle)]! aria-disabled:text-[color:var(--disabled)]! aria-disabled:shadow-none! aria-disabled:active:translate-y-0";
const controlBase = `inline-flex min-h-tap items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border ${controlDisabled}`;
export const primaryControl = `${controlBase} bg-[color:var(--command)] px-5 text-[color:var(--command-contrast)] shadow-[var(--e1)] hover:bg-[color:var(--command-hover)] hover:shadow-[var(--shadow-hover)]`;
