"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { OverlayPortal } from "./overlay-root";
import { resolveTipPosition } from "./tooltip";
import { cx } from "./cx";
import styles from "./info-tip.module.css";

export type InfoTipProps = {
  /** What the tip explains, said in the button's name: "About Ready" for `about="Ready"`. */
  about: string;
  /** The explanation. Keep it to one or two short lines (D-218). */
  children: ReactNode;
  placement?: "top" | "bottom" | "right";
  className?: string;
};

type Position = ReturnType<typeof resolveTipPosition>;

/**
 * D-224 (Josh, 14 Nov 2026): every explanatory tip is a small ⓘ that opens with a tap, a click or
 * the keyboard. Hover-only tips do not work on phones or iPads, so this part never opens on hover.
 * It closes on Escape (focus goes back to the ⓘ), on a tap or click outside, or on a second press.
 */
export function InfoTip({ about, children, placement = "bottom", className }: InfoTipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!button || !tip) return;
    setPosition(resolveTipPosition(button.getBoundingClientRect(), tip.getBoundingClientRect(), placement));
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    let frame: number | null = window.requestAnimationFrame(() => {
      frame = null;
      place();
    });
    const onMove = () => place();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Stop here so an open tip inside a sheet closes first, not the sheet.
      event.stopPropagation();
      close(true);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (buttonRef.current?.contains(target) || tipRef.current?.contains(target))) return;
      close(false);
    };
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, scrollOptions);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, scrollOptions);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [close, open, place]);

  return (
    <span className={cx(styles.wrap, className)}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={`About ${about}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-testid="info-tip"
        data-print-hide=""
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open ? (
        <OverlayPortal layer="popover" name="info-tip">
          <span
            ref={tipRef}
            id={id}
            role="note"
            aria-label={`About ${about}`}
            data-testid="info-tip-text"
            data-placement={position?.placement ?? placement}
            className={styles.tip}
            style={{
              position: "fixed",
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              maxWidth: position?.maxWidth ?? "min(20rem, calc(100vw - 1rem))",
              visibility: position ? "visible" : "hidden",
            }}
          >
            {children}
          </span>
        </OverlayPortal>
      ) : null}
    </span>
  );
}
