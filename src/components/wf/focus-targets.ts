const FOCUSABLE = "a[href], button, textarea, input, select, summary, [tabindex]";

/** Closed details can give their hidden controls rectangles while refusing focus. */
function inClosedDisclosure(element: HTMLElement): boolean {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
      const summary = Array.from(ancestor.children).find((child) => child.tagName === "SUMMARY");
      if (!summary?.contains(element)) return true;
    }
  }
  return false;
}

export function modalFocusTargets(
  panel: HTMLElement | null,
  includeToasts = false,
  requireLayout = true,
): HTMLElement[] {
  const roots = [
    panel,
    ...(includeToasts ? document.querySelectorAll<HTMLElement>('[data-overlay-host="toast"]') : []),
  ];
  const candidates = roots.flatMap((root) => Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []));
  return [...new Set(candidates)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !(element instanceof HTMLInputElement && element.type === "hidden") &&
      !element.closest('[aria-hidden="true"], [inert], [hidden]') &&
      !inClosedDisclosure(element) &&
      getComputedStyle(element).visibility !== "hidden" &&
      (!requireLayout || element.getClientRects().length > 0),
  );
}
