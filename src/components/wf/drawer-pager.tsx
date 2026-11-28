"use client";

/**
 * The drawer head's pager, in its own file so the phone sheet (`PhoneSheet`, on every page's first
 * load) can show it without pulling in the whole kit drawer and its tabs (phone script budget, PR
 * #1742). Its classes stay in `drawer.module.css`, whose head rules (`.head:has(> .pager)`) lay it out.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonClass } from "./button";
import s from "./drawer.module.css";

export type DrawerPagerProps = {
  /** Where the open row sits in the list it was opened from, from 0; -1 when it has left the list. */
  index: number;
  total: number;
  /** What a row is, in the buttons' names: "Previous event", "Next event". */
  noun: string;
  /** Opens the row `delta` places away (the caller wraps or stops at the ends). */
  onStep: (delta: -1 | 1) => void;
};

/** Previous, "N of M" and next: the drawer head's pager (audit three #34). */
export function DrawerPager({ index, total, noun, onStep }: DrawerPagerProps) {
  const alone = total < 2;
  return (
    <span className={s.pager} role="group" aria-label={`Move through the ${noun}s`} data-testid="wf-drawer-pager">
      <button
        type="button"
        className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true })}
        aria-label={`Previous ${noun}`}
        disabled={alone}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      <span className={s.pagerCount} role="status">
        {index < 0 ? `${total} in list` : `${index + 1} of ${total}`}
      </span>
      <button
        type="button"
        className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true })}
        aria-label={`Next ${noun}`}
        disabled={alone}
        onClick={() => onStep(1)}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
