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
  const reachable = [...new Set(candidates)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !(element instanceof HTMLInputElement && element.type === "hidden") &&
      !element.closest('[aria-hidden="true"], [inert], [hidden]') &&
      !inClosedDisclosure(element) &&
      getComputedStyle(element).visibility !== "hidden" &&
      (!requireLayout || element.getClientRects().length > 0),
  );
  return oneStopPerRadioGroup(reachable);
}

function isNamedRadio(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === "radio" && element.name !== "";
}

/**
 * A named radio group is one Tab stop, as browsers treat it natively: the focused radio, else the
 * checked one, else the first. Arrow keys move within the group.
 */
function oneStopPerRadioGroup(elements: HTMLElement[]): HTMLElement[] {
  // Radios group by owning form (or none) and name.
  const forms = new Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>();
  for (const element of elements) {
    if (!isNamedRadio(element)) continue;
    const byName = forms.get(element.form) ?? new Map<string, HTMLInputElement[]>();
    forms.set(element.form, byName);
    byName.set(element.name, [...(byName.get(element.name) ?? []), element]);
  }
  if (forms.size === 0) return elements;
  const stops = new Set<HTMLElement>();
  for (const group of [...forms.values()].flatMap((byName) => [...byName.values()])) {
    stops.add(
      group.find((radio) => radio === document.activeElement) ?? group.find((radio) => radio.checked) ?? group[0],
    );
  }
  return elements.filter((element) => !isNamedRadio(element) || stops.has(element));
}
