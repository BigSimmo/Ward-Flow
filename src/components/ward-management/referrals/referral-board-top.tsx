"use client";

/**
 * The Referrals board's top for the bed coordinator (page tops, Josh 9 Nov 2026). Josh kept the live
 * layout's structure: the "7 awaiting decision" headline with its oldest and median line, the
 * Decision overdue and Beds ready figures, Next overdue as the act row, the bed meeting and type
 * chips, the since-referral runway on a desktop (a quiet due-times line on a phone) and Beds ready as
 * one slim band. Every figure comes from the board; nothing here counts or decides. The other desks
 * (ward, ED, community, site bed manager) keep their own tops in `referral-board.tsx`.
 */
import type { ReactNode } from "react";
import { ChevronRight, ListOrdered } from "lucide-react";

import {
  FolderTabs,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  cx,
  folderTabClasses,
  type HeroChipItem,
} from "@/components/wf";
import { BED_MEETING_REFERRALS_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import { durMinutes } from "@/components/wf";

import type { BedsReadySummary } from "./referral-board-parts";
import pageTop from "../page-top-hero.module.css";
import top from "./referral-board-top.module.css";

const CHIP_ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export type ReferralTopChip = { key: string; label: string; count: number };

export function ReferralCoordinatorTop({
  isPhone,
  title,
  titleMeta,
  overdueCount,
  overdueHighlighted,
  onOverdueFigure,
  nextOverdue,
  onNextOverdue,
  beds,
  onBeds,
  chips,
  highlight,
  onHighlight,
  runway,
  axisOpen,
  onAxis,
  viewSwitch,
  view,
  tabsAside,
  className,
  testId,
  level,
  children,
}: {
  isPhone: boolean;
  /** Heading level of the hero title: 1 when it is the page's title. */
  level?: 1 | 2;
  title: ReactNode;
  /** "Oldest 3d 3h · decided in 4h 30m (median)", worded by the board. */
  titleMeta: ReactNode;
  overdueCount: number;
  overdueHighlighted: boolean;
  onOverdueFigure: () => void;
  /** The referral Next overdue opens: how long overdue, and who (named on a desktop). */
  nextOverdue: { by: string; name: string } | undefined;
  onNextOverdue: () => void;
  beds: BedsReadySummary;
  /** Phone: the Beds ready figure opens the beds sheet. */
  onBeds: () => void;
  chips: readonly ReferralTopChip[];
  highlight: string | null;
  onHighlight: (key: string) => void;
  /** Desktop: the since-referral runway. */
  runway: ReactNode;
  axisOpen: boolean;
  /** Phone: the due-times line opens the runway sheet. */
  onAxis: () => void;
  /** Queue and History (a PillTabs); it gets the folder tab class here. */
  viewSwitch: (className: string) => ReactNode;
  view: string;
  /** Right of the tabs: the order note, or the highlight note with Clear. */
  tabsAside: ReactNode;
  className?: string;
  testId?: string;
  /** After the tabs: the phone's waiting-time and beds sheet. */
  children?: ReactNode;
}) {
  // Opted out of the React Compiler, as the shared page top parts are (hero-top.tsx): memoising it
  // added to the Referrals phone download (script-budget.json) and changed nothing visible.
  "use no memo";
  const chipItems: HeroChipItem[] = [
    {
      id: "meeting",
      label: "Bed meeting",
      icon: <ListOrdered {...CHIP_ICON} />,
      href: BED_MEETING_REFERRALS_HREF,
      testId: "ward-referral-meeting",
    },
    ...chips.map((chip) => ({
      id: chip.key,
      label: chip.label,
      count: chip.count,
      countTone: "quiet" as const,
      pressed: highlight === chip.key,
      onClick: () => onHighlight(chip.key),
      testId: isPhone ? `ward-referral-phone-chip-${chip.key}` : `ward-referral-highlight-${chip.key}`,
    })),
  ];
  const updated = beds.oldestUpdateMinutes;
  return (
    <div className={top.wrap} data-testid={testId}>
      <Hero
        level={level}
        className={cx(pageTop.hero, folderTabClasses.hero, top.hero, className)}
        // The page's name stays in the heading for a screen reader; the slate shows no eyebrow.
        title={
          <>
            <span className="sr-only">Referrals </span>
            {title}
          </>
        }
        titleMeta={titleMeta}
        aside={<LiveChip state="live" onHero />}
        testId={isPhone ? "ward-referral-phone-hero" : undefined}
      >
        <HeroTop
          testId="ward-referral-top"
          figures={
            <HeroFigures
              label="Highlight referrals"
              items={[
                {
                  id: "overdue",
                  value: overdueCount,
                  label: "Decision overdue",
                  tone: overdueCount > 0 ? "danger" : undefined,
                  onClick: overdueCount > 0 || overdueHighlighted ? onOverdueFigure : undefined,
                  testId: "ward-referral-figure-overdue",
                },
                {
                  id: "beds",
                  value: beds.total,
                  label: "Beds ready",
                  ...(isPhone ? { onClick: onBeds } : { href: "/ward-flow/hub" }),
                  linkTestId: isPhone ? "ward-referral-phone-beds" : undefined,
                  testId: "ward-referral-figure-beds",
                },
              ]}
            />
          }
          act={
            nextOverdue ? (
              <HeroAct
                tone="danger"
                testId="ward-referral-next"
                title={isPhone ? `Overdue by ${nextOverdue.by}` : `Overdue by ${nextOverdue.by} · ${nextOverdue.name}`}
                action={{ label: "Next overdue", onClick: onNextOverdue, testId: "ward-referral-next-overdue" }}
              />
            ) : (
              <HeroAct tone="calm" testId="ward-referral-next" title="No decision overdue" />
            )
          }
          chips={<HeroQuickChips label="Referral highlights" items={chipItems} />}
          band={
            <>
              {isPhone ? (
                <button
                  type="button"
                  className={top.dueLine}
                  aria-expanded={axisOpen}
                  onClick={onAxis}
                  data-testid="ward-referral-phone-axis"
                >
                  <span>
                    Due T1 <b>{OVERDUE_AFTER_MINUTES_BY_TIER[1] / 60}h</b> · T2{" "}
                    <b>{OVERDUE_AFTER_MINUTES_BY_TIER[2] / 60}h</b> · T3 <b>{OVERDUE_AFTER_MINUTES_BY_TIER[3] / 60}h</b>
                  </span>
                  <span className="sr-only">, waiting time against due times</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <div className={top.runway}>{runway}</div>
              )}
              <HeroBand
                title="Beds ready"
                aside={updated === undefined ? undefined : `updated ${durMinutes(updated)} ago`}
                testId="ward-referral-beds-ready"
                cells={[
                  ...beds.cells.map((cell) => ({ id: cell.label, label: cell.label, value: cell.value })),
                  ...(beds.preparing > 0
                    ? [{ id: "preparing", label: "Being made ready", value: beds.preparing, tone: "warning" as const }]
                    : []),
                ]}
              />
            </>
          }
        />
      </Hero>
      <FolderTabs className={top.tabs} label="Referral views" value={view} testId="ward-referral-tabs" more={tabsAside}>
        {viewSwitch(folderTabClasses.switch)}
      </FolderTabs>
      {children}
    </div>
  );
}
