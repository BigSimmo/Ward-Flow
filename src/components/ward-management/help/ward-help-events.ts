/**
 * The event that opens Help, kept apart from the tour-seen store so the header's always-mounted
 * host loads only this, not the store (phone first-load script budget).
 */
const OPEN_HELP_EVENT = "ward-flow-open-help";

export type HelpView = "desk" | "screen" | "glossary" | "new" | "tour";

/** Opens the Help sheet at `view`, from anywhere in the shell. */
export function openWardHelp(view: HelpView = "screen"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: { view } }));
}

export function subscribeWardHelp(onOpen: (view: HelpView) => void): () => void {
  function handler(event: Event) {
    const view = (event as CustomEvent<{ view?: HelpView }>).detail?.view;
    onOpen(view === "desk" || view === "glossary" || view === "new" || view === "tour" ? view : "screen");
  }
  window.addEventListener(OPEN_HELP_EVENT, handler);
  return () => window.removeEventListener(OPEN_HELP_EVENT, handler);
}
