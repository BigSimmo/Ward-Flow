"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cx } from "./cx";
import { Tooltip } from "./tooltip";

export type ClampTextProps = {
  children: string;
  /** Lines shown before the text is cut. Default 2. */
  lines?: number;
  className?: string;
};

/**
 * R-STRUCT-27. Detail text cut to N lines. Only when it is actually cut does it become focusable and
 * show the full text in the kit tooltip on hover and keyboard focus.
 */
export function ClampText({ children, lines = 2, className }: ClampTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, lines]);
  const style = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    lineClamp: lines,
    overflow: "hidden",
    overflowWrap: "anywhere",
  } as CSSProperties;
  // Focusable only when cut, so a keyboard user can reach the full text in the tooltip.
  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  const text = (
    <span ref={ref} className={cx(className)} style={style} tabIndex={cut ? 0 : undefined}>
      {children}
    </span>
  );
  return cut ? <Tooltip content={children}>{text}</Tooltip> : text;
}
