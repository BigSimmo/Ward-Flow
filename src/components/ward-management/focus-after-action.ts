import { focusIsLost } from "@/components/wf";

/**
 * F-57 (Audit 5 A5-18, Audit 9 A9-28): an action that removes the control that had focus (Save
 * transport booking, Mark handover ready) dropped keyboard focus to the start of the page, about 31
 * Tab presses from where the person was. Next frame, once the page has redrawn, focus goes to the
 * first target that takes it. Focus is only moved when it has fallen to the page (or to the open
 * panel's own frame); a control that kept focus is never pulled away from.
 */
export function focusAfterAction(targets: () => ReadonlyArray<HTMLElement | null | undefined>): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    const onPanelFrame = active instanceof HTMLElement && active.getAttribute("role") === "dialog";
    if (!focusIsLost() && !onPanelFrame) return;
    for (const target of targets()) {
      if (target?.isConnected && handFocusTo(target)) return;
    }
  });
}

/**
 * Focuses `target`. A heading or region takes focus only for this hand-over (`tabindex="-1"`, taken
 * off again on blur), so it never joins the Tab order. Returns true when focus moved.
 */
export function handFocusTo(target: HTMLElement): boolean {
  if (!target.hasAttribute("tabindex") && !target.matches("a[href], button, input, select, textarea")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}
