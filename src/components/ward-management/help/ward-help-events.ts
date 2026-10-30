/**
 * The event that opens Help, kept apart from the tour-seen store so the header's always-mounted
 * host loads only this, not the store (phone first-load script budget).
 */
const OPEN_HELP_EVENT = "ward-flow-open-help";

/** "tasks" is How do I…, the desk's common tasks, each with Show me (Josh, 30 Oct 2026). */
export type HelpView = "tasks" | "desk" | "screen" | "glossary" | "new" | "tour";

type OpenHelpDetail = { view?: HelpView; ask?: string; showMe?: string; task?: string };

/** Opens the Help sheet at `view`, from anywhere in the shell; `task` opens that how-to in How do I…. */
export function openWardHelp(view: HelpView = "screen", task?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenHelpDetail>(OPEN_HELP_EVENT, { detail: { view, task } }));
}

/**
 * Opens Help with the Ask box filled with `question` (the header search hands a typed question
 * over). The words travel in memory only, in this event, and are never stored.
 */
export function askWardHelp(question: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenHelpDetail>(OPEN_HELP_EVENT, { detail: { ask: question } }));
}

/** Runs the Show me for the how-to `id` (`ward-help-howto.ts`). */
export function showWardHowTo(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenHelpDetail>(OPEN_HELP_EVENT, { detail: { showMe: id } }));
}

/**
 * Whether a header search query reads as a question for Help ("how do I pull a bed") rather than
 * a name, UMRN or place. Kept here, not with the how-to list, so the search loads no help content.
 */
export function looksLikeHelpQuestion(query: string): boolean {
  return /^\s*(how|where|why|what)\b\s*\S/i.test(query);
}

export type HelpRequest =
  | { kind: "view"; view: HelpView; task?: string }
  | { kind: "ask"; question: string }
  | { kind: "show-me"; id: string };

export function subscribeWardHelp(onOpen: (request: HelpRequest) => void): () => void {
  function handler(event: Event) {
    // Only the functions above send this event, so its detail is already well formed. No check is
    // kept here: this file loads on every page, inside the phone script budget.
    const detail = (event as CustomEvent<OpenHelpDetail>).detail ?? {};
    if (detail.showMe) onOpen({ kind: "show-me", id: detail.showMe });
    else if (detail.ask !== undefined) onOpen({ kind: "ask", question: detail.ask });
    else onOpen({ kind: "view", view: detail.view ?? "screen", task: detail.task });
  }
  window.addEventListener(OPEN_HELP_EVENT, handler);
  return () => window.removeEventListener(OPEN_HELP_EVENT, handler);
}
