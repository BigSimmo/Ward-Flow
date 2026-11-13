"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "./cx";
import { SyntheticMark } from "./synthetic-mark";
import styles from "./synthetic-mark.module.css";

type FrameContext = { enlarged: boolean; register: () => () => void };

const FullScreenContext = createContext<FrameContext | null>(null);

export type FullScreenFrameProps = HTMLAttributes<HTMLElement> & {
  /** True while the view fills the screen (enlarged, full screen, handover view). */
  enlarged: boolean;
  /** The element the view already is. Defaults to a div. */
  as?: "div" | "section";
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
};

/**
 * Shared design parts item 7 (Josh, 13 Nov 2026; F-39): the root of any view that can fill the
 * screen. An enlarged view covers the page footer, so this frame always draws the `SyntheticMark`:
 * in the view's own `FullScreenMarkSlot` (the first free place on the right of its top row, since
 * the corner holds Exit full screen), or, when the view placed no slot, in a strip at its top. A
 * future enlarged view cannot forget it.
 */
export function FullScreenFrame({ enlarged, as = "div", children, ...rest }: FullScreenFrameProps) {
  const [slots, setSlots] = useState(0);
  const register = useCallback(() => {
    setSlots((count) => count + 1);
    return () => setSlots((count) => count - 1);
  }, []);
  const value = useMemo(() => ({ enlarged, register }), [enlarged, register]);
  return createElement(
    as,
    { ...rest, "data-wf-full-screen": enlarged ? "true" : undefined },
    <FullScreenContext.Provider value={value}>
      {enlarged && slots === 0 ? (
        <div className={styles.frameTop} data-wf-full-screen-mark="">
          <SyntheticMark />
        </div>
      ) : null}
      {children}
    </FullScreenContext.Provider>,
  );
}

/**
 * Where the frame's `SyntheticMark` sits in this view while it fills the screen. Renders nothing
 * while the view is in the page (the footer carries the mark there) or outside a `FullScreenFrame`.
 * It registers before paint, so the frame's fallback strip never shows beside it.
 */
export function FullScreenMarkSlot({ className }: { className?: string }) {
  const frame = useContext(FullScreenContext);
  const active = Boolean(frame?.enlarged);
  const register = frame?.register;
  useLayoutEffect(() => {
    if (!active || !register) return;
    return register();
  }, [active, register]);
  if (!active) return null;
  return (
    <span className={cx(styles.slot, className)} data-wf-full-screen-mark="">
      <SyntheticMark />
    </span>
  );
}
