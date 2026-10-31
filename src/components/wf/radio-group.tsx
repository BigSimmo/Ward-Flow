"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

type RadioGroupProps = Omit<ComponentPropsWithoutRef<"div">, "role">;

/** Keyboard behaviour for existing, styled button radios. Native radio inputs need no wrapper. */
export function RadioGroup({ children, onKeyDown, ...props }: RadioGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const radios = (root: HTMLDivElement) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button[role="radio"]')).filter(
      (button) => button.closest('[role="radiogroup"]') === root,
    );
  const available = (button: HTMLButtonElement) => !button.disabled && button.getAttribute("aria-disabled") !== "true";

  // Choices can appear or disappear while a group is open. The selected enabled choice, or the
  // first enabled choice when unanswered, always remains the group's one Tab entry point.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const all = radios(root);
    const enabled = all.filter(available);
    const stop = enabled.find((button) => button.getAttribute("aria-checked") === "true") ?? enabled[0];
    for (const button of all) button.tabIndex = button === stop ? 0 : -1;
  });

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the child radios own the single roving tab stop
    <div
      {...props}
      ref={ref}
      role="radiogroup"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const target =
          event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[role="radio"]') : null;
        const enabled = radios(event.currentTarget).filter(available);
        const current = target ? enabled.indexOf(target) : -1;
        if (current < 0) return;
        let next: number;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % enabled.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
          next = (current - 1 + enabled.length) % enabled.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = enabled.length - 1;
        else return;
        event.preventDefault();
        enabled[next]!.focus();
        enabled[next]!.click();
      }}
    >
      {children}
    </div>
  );
}
