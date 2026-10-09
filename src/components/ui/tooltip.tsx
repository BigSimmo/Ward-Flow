"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import { cn } from "@/components/ui-primitives";
import styles from "./tooltip.module.css";

export type TooltipProps = {
  children: ReactElement<Record<string, unknown>>;
  /** Plain text shown by the tooltip and, by default, added to the trigger's description. */
  content: string;
  placement?: "top" | "bottom" | "right";
  className?: string;
  wrapperClassName?: string;
  /** Render visual help without repeating a trigger name that is already complete. */
  presentationOnly?: boolean;
  disabled?: boolean;
};

type Position = {
  left: number;
  top: number;
  placement: "top" | "bottom" | "right" | "left";
  maxWidth?: number;
  maxHeight?: number;
};

export function Tooltip({
  children,
  content,
  placement = "top",
  className,
  wrapperClassName,
  presentationOnly = false,
  disabled = false,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const visibleOpen = open && !disabled;
  const [position, setPosition] = useState<Position>({ left: 0, top: 0, placement });
  // Keep the first paint invisible until geometry is measured so the tooltip never
  // flashes at the (0, 0) placeholder before requestAnimationFrame repositions it.
  const [positioned, setPositioned] = useState(false);
  // Reset visibility during render when the tooltip closes — avoid setState inside
  // the effect body (react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (visibleOpen !== wasOpen) {
    setWasOpen(visibleOpen);
    if (!visibleOpen && positioned) setPositioned(false);
  }
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerWrapRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = placement === "right" ? 10 : 6;
    const margin = 8;
    const horizontalMargin = Math.min(margin, Math.max(0, window.innerWidth / 2));
    const verticalMargin = Math.min(margin, Math.max(0, window.innerHeight / 2));
    const maxWidth = Math.max(0, Math.min(320, window.innerWidth - horizontalMargin * 2));
    const maxHeight = Math.max(0, window.innerHeight - verticalMargin * 2);
    const width = Math.min(tooltipRect.width, maxWidth);
    const height = Math.min(tooltipRect.height, maxHeight);
    const roomAbove = triggerRect.top - verticalMargin;
    const roomBelow = window.innerHeight - triggerRect.bottom - verticalMargin;
    const roomRight = window.innerWidth - triggerRect.right - horizontalMargin;
    const roomLeft = triggerRect.left - horizontalMargin;
    const resolvedPlacement: Position["placement"] =
      placement === "top" && roomAbove < height + gap && roomBelow > roomAbove
        ? "bottom"
        : placement === "bottom" && roomBelow < height + gap && roomAbove > roomBelow
          ? "top"
          : placement === "right" && roomRight < width + gap && roomLeft > roomRight
            ? "left"
            : placement;
    const unclampedLeft =
      resolvedPlacement === "right"
        ? triggerRect.right + gap
        : resolvedPlacement === "left"
          ? triggerRect.left - width - gap
          : triggerRect.left + triggerRect.width / 2 - width / 2;
    const maximumLeft = Math.max(horizontalMargin, window.innerWidth - width - horizontalMargin);
    const left = Math.max(horizontalMargin, Math.min(unclampedLeft, maximumLeft));
    const desiredTop =
      resolvedPlacement === "right" || resolvedPlacement === "left"
        ? triggerRect.top + 2
        : resolvedPlacement === "top"
          ? triggerRect.top - height - gap
          : triggerRect.bottom + gap;
    const maximumTop = Math.max(verticalMargin, window.innerHeight - height - verticalMargin);
    const top = Math.max(verticalMargin, Math.min(desiredTop, maximumTop));
    setPosition({ left, top, placement: resolvedPlacement, maxWidth, maxHeight });
    setPositioned(true);
  }, [placement]);

  useEffect(() => {
    if (!visibleOpen) return;

    let frame: number | null = null;
    const schedulePositionUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updatePosition();
      });
    };
    const scrollOptions: AddEventListenerOptions = { capture: true, passive: true };

    schedulePositionUpdate();
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("scroll", schedulePositionUpdate, scrollOptions);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("scroll", schedulePositionUpdate, scrollOptions);
    };
  }, [updatePosition, visibleOpen]);

  // Escape dismisses an open tooltip first, even one opened by hover (WCAG 1.4.13), and stops at
  // the document so it does not also reach a Sheet's window listener and close the drawer too.
  useEffect(() => {
    if (!visibleOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visibleOpen]);

  if (!isValidElement(children)) return <>{children}</>;

  const childProps = children.props as Record<string, unknown>;
  const compose =
    <E,>(ours: (event: E) => void, theirs?: unknown) =>
    (event: E) => {
      if (typeof theirs === "function") (theirs as (event: E) => void)(event);
      ours(event);
    };
  const describedBy =
    [childProps["aria-describedby"], visibleOpen && !presentationOnly ? id : null].filter(Boolean).join(" ") ||
    undefined;

  const trigger = cloneElement(children, {
    "aria-describedby": describedBy,
    onMouseEnter: compose(() => setOpen(true), childProps.onMouseEnter),
    onMouseLeave: compose(() => setOpen(false), childProps.onMouseLeave),
    onFocus: compose(() => setOpen(true), childProps.onFocus),
    onBlur: compose(() => setOpen(false), childProps.onBlur),
  });

  return (
    <span ref={triggerWrapRef} className={cn("inline-flex", wrapperClassName)}>
      {trigger}
      {visibleOpen ? (
        <OverlayPortal layer="popover" name="tooltip">
          <span
            ref={tooltipRef}
            role="tooltip"
            id={id}
            aria-hidden={presentationOnly || undefined}
            aria-label={presentationOnly ? undefined : content}
            data-testid="tooltip"
            data-placement={position.placement}
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              maxWidth: position.maxWidth ?? "min(20rem, calc(100vw - 1rem))",
              visibility: positioned ? "visible" : "hidden",
            }}
            className={cn(styles.tip, className)}
          >
            <span
              aria-hidden="true"
              data-testid="tooltip-visual"
              className="block overflow-hidden"
              style={{ maxHeight: position.maxHeight ?? "calc(100vh - 1rem)" }}
            >
              {content}
            </span>
            {!presentationOnly ? (
              <span data-testid="tooltip-description" className="sr-only">
                {content}
              </span>
            ) : null}
          </span>
        </OverlayPortal>
      ) : null}
    </span>
  );
}
