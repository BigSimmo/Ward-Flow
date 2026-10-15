"use client";

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/wf";
import { announceToWardShell } from "./shell/ward-live-region";
import styles from "./not-wired-button.module.css";

/** D4 wording, shared with the shell's primary action (`shell/ward-bar.tsx`, D-16). */
const NOT_WIRED_NOTE = "Not wired in this prototype.";

type NotWiredButtonProps = Omit<ComponentPropsWithRef<"button">, "children" | "onClick"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Icon only: `label` becomes the accessible name. */
  iconOnly?: boolean;
  /** The control's own words, used as the button text, the popover heading and the announcement. */
  label: string;
  /** What the popover heading and the announcement call it, when the button text alone is too short. */
  name?: string;
  /** Class for the wrapper, so a page can place or hide the control as a whole. */
  wrapClassName?: string;
};

/**
 * D-16 for a control the prototype does not connect. The coordinator can do everything, so the
 * control is never greyed: it stays pressable and, on press, announces "<label> is not wired in
 * this prototype." and opens a small popover saying so — the same shape as the shell's primary
 * action in `shell/ward-bar.tsx`. Escape, a second press or a press outside closes it.
 */
export function NotWiredButton({
  label,
  name = label,
  iconOnly,
  icon,
  wrapClassName,
  className,
  ...rest
}: NotWiredButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const btnClassName = className ? `${styles.button} ${className}` : styles.button;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const trigger = {
    "aria-expanded": open,
    "aria-controls": open ? panelId : undefined,
    "data-not-wired": "preview",
    className: btnClassName,
    onClick: () => {
      if (open) {
        setOpen(false);
        return;
      }
      setOpen(true);
      announceToWardShell(`${name} is not wired in this prototype.`);
    },
  };

  return (
    <span
      ref={wrapRef}
      className={wrapClassName ? `${styles.wrap} ${wrapClassName}` : styles.wrap}
      onKeyDown={(event) => {
        // Close the popover first; preventDefault keeps an enclosing sheet open on this press.
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      {iconOnly && icon ? (
        <Button {...rest} {...trigger} iconOnly icon={icon} aria-label={label} />
      ) : (
        <Button {...rest} {...trigger} icon={icon}>
          {label}
        </Button>
      )}
      {open ? (
        <span id={panelId} role="group" aria-label={name} className={styles.panel} data-testid="not-wired-popover">
          <span className={styles.head}>{name}</span>
          <span className={styles.note}>{NOT_WIRED_NOTE}</span>
        </span>
      ) : null}
    </span>
  );
}
