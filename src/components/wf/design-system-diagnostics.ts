type DiagnosticEmitter = (message: string) => void;

const DEFAULT_CAPACITY = 100;

/**
 * Deduplicates noisy resilience diagnostics without retaining attacker- or
 * data-controlled keys forever. Once full, the oldest key is evicted.
 */
export function createBoundedDiagnosticRecorder({
  capacity = DEFAULT_CAPACITY,
  emit = (message) => console.warn(message),
}: {
  capacity?: number;
  emit?: DiagnosticEmitter;
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Design-system diagnostic capacity must be a positive integer.");
  }
  const recentKeys = new Map<string, true>();

  return (key: string, message: string) => {
    if (recentKeys.has(key)) return;
    if (recentKeys.size >= capacity) {
      const oldest = recentKeys.keys().next().value;
      if (typeof oldest === "string") recentKeys.delete(oldest);
    }
    recentKeys.set(key, true);
    emit(message);
  };
}

/** What counts as one panel for the one-filled-button rule: a dialog or sheet, a form, a section, a hero. */
const PANEL_SELECTOR = '[role="dialog"], [role="alertdialog"], form, section, aside, [data-wf-hero]';

const recordExtraFilled = createBoundedDiagnosticRecorder({
  emit: (message) => {
    if (typeof process === "undefined" || process.env?.NODE_ENV !== "test") console.warn(message);
  },
});

function panelName(panel: Element): string {
  const label = panel.getAttribute("aria-label") ?? panel.getAttribute("data-testid") ?? panel.id;
  return `${panel.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`;
}

/**
 * Audit two #83 (N9, D-98): a development-only check for the house rule "one filled button per
 * panel". Given a filled button on screen, it counts the filled buttons (and links drawn as filled
 * buttons, `filledSelector`) whose nearest panel is the same one, and warns once per panel when there
 * is more than one. It never changes the screen and never runs in a production build.
 */
export function warnExtraFilledButtons(button: Element, filledSelector: string): void {
  if (typeof process === "undefined" || process.env?.NODE_ENV !== "development") return;
  const panel = button.closest(PANEL_SELECTOR);
  if (!panel) return;
  const filled = Array.from(panel.querySelectorAll(filledSelector)).filter(
    (node) => node.closest(PANEL_SELECTOR) === panel && !node.closest("[hidden], [inert]"),
  );
  if (filled.length <= 1) return;
  const name = panelName(panel);
  recordExtraFilled(
    name,
    `[wf] One filled button per panel: ${name} shows ${filled.length} (${filled
      .map((node) => (node.textContent ?? "").trim() || node.getAttribute("aria-label") || "unnamed")
      .join(", ")}).`,
  );
}
