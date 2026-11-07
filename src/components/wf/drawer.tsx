"use client";

/**
 * The kit patient drawer (plan item 2c, Josh, 3 Nov 2026), promoted from Home's Placement drawer
 * (PR #1337) so every patient panel (ward bed, transport job, out of area, forms, alerts, on-call)
 * can move to it inside its own page group.
 *
 * It wraps the kit `Sheet` (`placement="responsive-right"`): a side drawer on tablet and desktop, a
 * sheet rising from the foot on a phone. The Sheet owns the focus trap, Escape, the outside click
 * (D-95) and the return of focus to the opener. This adds the v9 pop-up layout:
 *
 * - a fixed head: optional eyebrow, the title (the dialog's name), a subtitle, a status tag beside
 *   the title and the Close button, which takes focus on open;
 * - optional tabs inside the drawer when there is a lot to show;
 * - the body as the one scroll area;
 * - an optional foot, pinned under the body as a light band, for the main actions.
 *
 * Neutral borders only; tone goes in the tag (no side stripes, D-94).
 */
import { X } from "lucide-react";
import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { buttonClass } from "./button";
import { PillTabs, TabPanel } from "./choice";
import { cx } from "./cx";
import s from "./drawer.module.css";
import { Sheet } from "./sheet";

export type DrawerTab<T extends string = string> = { id: T; label: ReactNode; count?: number | string };

type DataAttributes = { [key: `data-${string}`]: string | undefined };

export type PanelDrawerProps<T extends string = string> = {
  open: boolean;
  onClose: () => void;
  /** The dialog's name: the patient, the job or the form. Wraps in full, never ends in "…". */
  title: ReactNode;
  /** Id for the title element; one is made when omitted. */
  titleId?: string;
  /** Small heading above the title ("Placement"); when given it is the `h2` and the title a line. */
  eyebrow?: ReactNode;
  /**
   * Status tag beside the title (a tier, a StatusPill), between the title block and Close. Tone
   * lives here, never in a stripe. Give it `flex: none` (StatusPill and the tier pill already do).
   */
  tag?: ReactNode;
  /** One quiet line under the title (UMRN, where). */
  subtitle?: ReactNode;
  /** Close button's accessible name. */
  closeLabel?: string;
  /** Tabs inside the drawer when there is a lot to show; the body becomes the selected tab's panel. */
  tabs?: DrawerTab<T>[];
  tab?: T;
  onTabChange?: (id: T) => void;
  /** Accessible name of the tab list. */
  tabsLabel?: string;
  /** The body: the one scroll area. */
  children: ReactNode;
  /** Main actions, pinned under the body in a light band. */
  foot?: ReactNode;
  footProps?: ComponentPropsWithoutRef<"div"> & DataAttributes;
  /**
   * Names the drawer's frame (head, body and foot) as a landmark, for pages and journeys that find
   * the panel by it. Without it the frame is a plain wrapper.
   */
  region?: { label: string; testId?: string } & DataAttributes;
  /** Names the scroll area and gives it a tab stop, for a body that may hold nothing focusable. */
  bodyLabel?: string;
  /** Added to the Sheet panel (width, Home-only tweaks). */
  className?: string;
  bodyClassName?: string;
  /** On the Sheet panel (`role="dialog"`). */
  testId?: string;
  /**
   * Passed to the Sheet: where focus goes on close, tried before the opener. Return null to keep
   * the opener. Must be referentially stable (`useCallback`).
   */
  resolveReturnFocusTarget?: () => HTMLElement | null;
};

export function PanelDrawer<T extends string = string>({
  open,
  onClose,
  title,
  titleId,
  eyebrow,
  tag,
  subtitle,
  closeLabel = "Close",
  tabs,
  tab,
  onTabChange,
  tabsLabel = "Sections",
  children,
  foot,
  footProps,
  region,
  bodyLabel,
  className,
  bodyClassName,
  testId,
  resolveReturnFocusTarget,
}: PanelDrawerProps<T>) {
  const ownTitleId = useId();
  const tabsId = useId();
  const resolvedTitleId = titleId ?? ownTitleId;
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const selectedTab = hasTabs ? (tab ?? tabs![0].id) : undefined;

  const head = (
    <div className={s.head} data-drawer-head="">
      <div className={s.who}>
        {eyebrow ? (
          <>
            <h2 className={s.eyebrow}>{eyebrow}</h2>
            <p id={resolvedTitleId} className={s.title}>
              {title}
            </p>
          </>
        ) : (
          <h2 id={resolvedTitleId} className={s.title}>
            {title}
          </h2>
        )}
        {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}
      </div>
      {/* The tag sits straight in the head row (no wrapper), so a page's own pill keeps its DOM. */}
      {tag ?? null}
      <button
        type="button"
        className={buttonClass({ variant: "sec", size: "sm", iconOnly: true })}
        onClick={onClose}
        aria-label={closeLabel}
        data-sheet-autofocus="true"
        data-testid="wf-drawer-close"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );

  const body =
    hasTabs && selectedTab !== undefined ? (
      <TabPanel idPrefix={tabsId} id={selectedTab}>
        {children}
      </TabPanel>
    ) : (
      children
    );

  const { label: regionLabel, testId: regionTestId, ...regionData } = region ?? { label: "" };
  const frameContent = (
    <>
      {head}
      {hasTabs && selectedTab !== undefined ? (
        <div className={s.tabs}>
          <PillTabs
            items={tabs!}
            value={selectedTab}
            onChange={(id) => onTabChange?.(id)}
            label={tabsLabel}
            idPrefix={tabsId}
          />
        </div>
      ) : null}
      <div
        className={cx(s.scroll, bodyClassName)}
        data-drawer-scroll=""
        tabIndex={bodyLabel ? 0 : undefined}
        role={bodyLabel ? "region" : undefined}
        aria-label={bodyLabel}
      >
        {body}
      </div>
      {foot ? (
        <div {...footProps} className={cx(s.foot, footProps?.className)} data-drawer-foot="">
          {foot}
        </div>
      ) : null}
    </>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={resolvedTitleId}
      placement="responsive-right"
      contentClassName={cx(s.panel, className)}
      bodyClassName={s.body}
      testId={testId}
      resolveReturnFocusTarget={resolveReturnFocusTarget}
    >
      {region ? (
        <aside aria-label={regionLabel} className={s.frame} data-testid={regionTestId} {...regionData}>
          {frameContent}
        </aside>
      ) : (
        <div className={s.frame}>{frameContent}</div>
      )}
    </Sheet>
  );
}

export type DrawerFact = { id?: string; label: ReactNode; value: ReactNode };

/** The drawer's fact grid: two columns of label over value, neutral hairlines between cells. */
export function DrawerFacts({ items, className }: { items: DrawerFact[]; className?: string }) {
  return (
    <div className={cx(s.facts, className)}>
      <dl className={s.grid}>
        {items.map((item, index) => (
          <div key={item.id ?? index}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A row of foot actions (record links, a secondary beside the primary). */
export function DrawerFootRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(s.footRow, className)}>{children}</div>;
}
