"use client";

import { useEffect } from "react";

/** The control a step names, if it is on the page. */
function findControl(name: string): HTMLElement | undefined {
  // A step in square brackets, or naming a button by an attribute, is a selector instead.
  if (/^(\[|button\[)/.test(name)) {
    // " || " lists selectors in order of preference: the first one on the page is pressed.
    return name
      .split(" || ")
      .map((selector) => document.querySelector<HTMLElement>(selector) ?? undefined)
      .find(Boolean);
  }
  return [...document.querySelectorAll<HTMLElement>("button, [role='menuitem']")].find(
    (element) =>
      element.offsetParent !== null &&
      (element.getAttribute("aria-label")?.startsWith(name) || element.textContent?.trim().startsWith(name)),
  );
}

/**
 * Preview only (Q221, Josh, 2 Nov 2026): opens a real page's own pop-up on load, the way a click
 * does, so the master design shows main's current dialog. Each step is the start of a control's
 * accessible name (its aria-label or its text), or a selector (square brackets), pressed in turn
 * once it is on the page. Nothing is recorded.
 */
export function useOpenOnLoad(openOnLoad: string | undefined, steps: Readonly<Record<string, readonly string[]>>) {
  useEffect(() => {
    const names = openOnLoad ? steps[openOnLoad] : undefined;
    if (!names?.length) return;
    let step = 0;
    let tries = 0;
    const timer = window.setInterval(() => {
      const name = names[step]!;
      // A step starting "?" is only on some layouts (a phone's More menu): it is passed over once the
      // next step's control is already on the page.
      const optional = name.startsWith("?");
      const control = findControl(optional ? name.slice(1) : name);
      if (control) {
        control.click();
        step += 1;
      } else if (optional && names[step + 1] && findControl(names[step + 1]!)) {
        step += 1;
      }
      if (step >= names.length || tries++ > 200) window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, [openOnLoad, steps]);
}
