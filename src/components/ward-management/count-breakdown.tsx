"use client";

/**
 * TAP A NUMBER TO SEE WHO IS IN IT (feature plan item 5). The figure stays where it is and becomes a
 * button named by its own visible words (WCAG 2.5.3), with `aria-haspopup` saying it opens a list. On a wider screen it opens a small pop-up beside the
 * figure (the kit's `Popover`); on a phone, a bottom sheet (the kit's `Sheet`). The list inside is
 * fetched on first use, so phone first loads carry only this button.
 *
 * The caller hands over the list the figure was counted from (`rows`), never a second list; the
 * panel checks the rows add up to the figure before it shows any (`breakdownView`). See
 * `count-breakdown-model.ts` for the scope and small-number rules. Not for the wall TV.
 */
import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";

import { Popover, useIsPhone } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";

import { type BreakdownKind, type BreakdownRow, type BreakdownScope } from "./count-breakdown-model";
import styles from "./count-breakdown.module.css";

const loadPanel = () => import("./count-breakdown-panel");
const CountBreakdownPanel = dynamic(() => loadPanel().then((m) => m.CountBreakdownPanel), {
  loading: () => <p className={styles.loading}>Loading the list…</p>,
});
const CountBreakdownSheet = dynamic(() => loadPanel().then((m) => m.CountBreakdownSheet), { loading: () => null });

export type CountBreakdownProps = {
  /** The figure, exactly as shown. */
  value: number;
  /** What it counts, after the number: "open ED movements", "beds ready". */
  noun: string;
  kind?: BreakdownKind;
  scope?: BreakdownScope;
  /** The minute the figure was counted, from the same `now` the figure used. */
  countedAt: Instant;
  /** The figure's own list, built on opening. */
  rows: () => readonly BreakdownRow[];
  /** The button's look: the figure's own label or cell class, so the figure looks as before. */
  className?: string;
  anchorClassName?: string;
  testId?: string;
  children: ReactNode;
};

export function CountBreakdown({
  value,
  noun,
  kind = "people",
  scope = "own",
  countedAt,
  rows,
  className,
  anchorClassName,
  testId,
  children,
}: CountBreakdownProps) {
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const phoneTriggerRef = useRef<HTMLButtonElement>(null);
  const panelProps = { value, noun, kind, scope, countedAt, rows };
  const title = kind === "beds" ? `Where the ${value} ${noun} are` : `Who is in ${value} ${noun}`;

  if (isPhone) {
    return (
      <>
        <button
          ref={phoneTriggerRef}
          type="button"
          className={className}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          data-testid={testId}
          data-count-breakdown=""
          onClick={() => setSheetOpen(true)}
          onPointerEnter={() => void loadPanel()}
        >
          {children}
        </button>
        {sheetOpen ? (
          <CountBreakdownSheet
            {...panelProps}
            title={title}
            returnFocusRef={phoneTriggerRef}
            onClose={() => setSheetOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <Popover
      label={title}
      className={anchorClassName}
      panelClassName={styles.popover}
      trigger={({ ref, onKeyDown, ...props }) => (
        <button
          ref={ref}
          type="button"
          {...props}
          onKeyDown={onKeyDown}
          className={className}
          data-testid={testId}
          data-count-breakdown=""
          onPointerEnter={() => void loadPanel()}
          onFocus={() => void loadPanel()}
        >
          {children}
        </button>
      )}
    >
      {() => <CountBreakdownPanel {...panelProps} />}
    </Popover>
  );
}
