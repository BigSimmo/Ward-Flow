"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Download, ListOrdered, Scale } from "lucide-react";

import {
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  cx,
  durMinutes,
  heroChipClassName,
  type HeroChipItem,
  type HeroFigureItem,
} from "@/components/wf";
import { unitHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import type { StatisticsHeroTop } from "./statistics-hero";
import { STATISTICS_COMPARE_HREF, STATISTICS_WARDS_HREF } from "./statistics-sections";
import { statisticsCountText, type StatisticsCount } from "./statistics-small-numbers";
import { setStatisticsSamples } from "./statistics-samples";
import { ChangeWard } from "./statistics-ward-change-ward";
import type { WardDetailModel } from "./statistics-wards-index";
import top from "./statistics-ward-top.module.css";

/** The middle stay in whole days, as the ward page worked it out (the two middle ones averaged). */
export function medianDays(days: readonly number[]): number | null {
  const sorted = [...days].sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** The four stay bands, shortened for the phone strip (the card below keeps the long names). */
const STRIP_LABEL: Record<string, string> = {
  "under-2-weeks": "Under 2 wk",
  "2-weeks-1-month": "2–4 wk",
  "1-3-months": "1–3 mo",
  "over-3-months": "Over 3 mo",
};

/** What the phone's Length of stay strip reads: the four bands and, where known, each person's days. */
export type WardStayStrip = {
  bands: { id: string; label: string; count: StatisticsCount }[];
  /** Each person in a bed now, their whole days so far. Left out where only counts are released. */
  inBedDays?: readonly number[];
};

/**
 * Phone page-top (9 Nov 2026): the Length of stay card's four bands, lifted to the top so the
 * ward's stays are read without scrolling past the bed map and roster. The card stays below.
 */
function WardStayBand({ strip }: { strip: WardStayStrip }) {
  const median = strip.inBedDays ? medianDays(strip.inBedDays) : null;
  const inBeds = strip.inBedDays?.length ?? null;
  return (
    <HeroBand
      title="Length of stay"
      testId="ward-statistics-ward-stay-band"
      aside={
        median === null && inBeds === null ? undefined : (
          <>
            {median === null ? null : (
              <>
                median <b>{median}</b> {median === 1 ? "day" : "days"}
              </>
            )}
            {median !== null && inBeds !== null ? " · " : null}
            {inBeds === null ? null : (
              <>
                <b>{inBeds}</b> in beds
              </>
            )}
          </>
        )
      }
      variant="inline"
      cells={strip.bands.map((band) => ({
        id: band.id,
        label: STRIP_LABEL[band.id] ?? band.label,
        value: statisticsCountText(band.count),
        ariaLabel: `${band.label}: ${statisticsCountText(band.count)}`,
      }))}
    />
  );
}

/** Previous, Change ward and next, as chips: stepping wards is this page's main job. */
function wardSteps(model: WardDetailModel): HeroChipItem[] {
  const { openUnits, unit } = model;
  const index = openUnits.findIndex((each) => each.id === unit.id);
  if (index < 0 || openUnits.length < 2) return [];
  const previous = openUnits[(index - 1 + openUnits.length) % openUnits.length]!;
  const next = openUnits[(index + 1) % openUnits.length]!;
  return [
    {
      id: "steps",
      label: "Change ward",
      node: (
        <span className={top.stepper} data-testid="ward-statistics-unit-stepper">
          <Link
            href={wardStatisticsHref(previous.id)}
            className={cx(heroChipClassName, top.square)}
            aria-label={`Previous ward: ${previous.name}`}
          >
            <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <ChangeWard units={openUnits} currentId={unit.id} className={heroChipClassName} plain />
          <Link
            href={wardStatisticsHref(next.id)}
            className={cx(heroChipClassName, top.square)}
            aria-label={`Next ward: ${next.name}`}
          >
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </span>
      ),
    },
  ];
}

/**
 * The ward page's top (Josh, 9 Nov 2026): the ward's name with its hospital and kind, three or four
 * figures it already derives, the pulled beds not yet arrived as a calm act row with Open the ward,
 * the ward stepper and tools as chips, and on a phone the Length of stay strip.
 */
export function wardStatisticsTop({
  model,
  isPhone,
  wardDesk,
  cohortLabel,
  siteLabel,
  dueThisWeekText,
  stayStrip,
  samples,
}: {
  model: WardDetailModel;
  isPhone: boolean;
  wardDesk: boolean;
  cohortLabel: string;
  siteLabel: string;
  dueThisWeekText: ReactNode;
  stayStrip?: WardStayStrip;
  /** Example history on or off (`useStatisticsSamples`). */
  samples: boolean;
}): StatisticsHeroTop {
  const { unit, wardOccupancy, occupancyPct, capacity, statistics, oldestPulled, canOpen, countsOnly } = model;
  const averageStay = statistics.averageLengthOfStayDays;
  const inUse: HeroFigureItem = {
    id: "in-use",
    value: wardOccupancy.inUse,
    unit: <>&thinsp;/&thinsp;{unit.beds}</>,
    label: `in use, ${occupancyPct}%`,
    testId: "ward-stat-in-use",
  };
  const readyFigure: HeroFigureItem = {
    id: "ready",
    value: <span data-testid="ward-stat-capacity-ready">{capacity.available}</span>,
    label: "ready",
  };
  const stayFigure: HeroFigureItem | null =
    averageStay === null ? null : { id: "stay", value: averageStay, unit: <>&thinsp;days</>, label: "average stay" };
  const dueFigure: HeroFigureItem = { id: "due", value: dueThisWeekText, label: "discharges due, 7 days" };
  const figures: HeroFigureItem[] = wardDesk
    ? [
        inUse,
        readyFigure,
        {
          id: "allocatable",
          value: <span data-testid="ward-stat-capacity-allocatable">{model.allocatableBeds}</span>,
          label: "allocatable",
        },
        { id: "empty", value: <span data-testid="ward-stat-capacity-empty">{model.emptyBeds}</span>, label: "empty" },
      ]
    : isPhone
      ? [inUse, readyFigure, stayFigure ?? dueFigure]
      : [inUse, readyFigure, ...(stayFigure ? [stayFigure] : []), dueFigure];
  const pulled = wardOccupancy.pulled;
  // A counts-only desk (executive) cannot open the ward's board.
  const openWard = countsOnly ? undefined : { label: "Open the ward", phoneLabel: "Open", href: unitHref(unit.id) };
  const chips = (exportFigures?: () => void): HeroChipItem[] => {
    const exportChip: HeroChipItem[] = exportFigures
      ? [
          {
            id: "export",
            label: "Export",
            icon: <Download strokeWidth={1.75} aria-hidden="true" />,
            onClick: exportFigures,
            testId: "ward-statistics-export",
          },
        ]
      : [];
    const compare: HeroChipItem[] = canOpen(STATISTICS_COMPARE_HREF)
      ? [
          {
            id: "compare",
            label: "Compare",
            icon: <Scale strokeWidth={1.75} aria-hidden="true" />,
            href: STATISTICS_COMPARE_HREF,
            testId: "ward-statistics-ward-compare",
          },
        ]
      : [];
    const allWards: HeroChipItem[] = canOpen(STATISTICS_WARDS_HREF)
      ? [
          {
            id: "all-wards",
            label: "All wards",
            icon: <ListOrdered strokeWidth={1.75} aria-hidden="true" />,
            href: STATISTICS_WARDS_HREF,
            testId: "ward-statistics-ward-all-wards",
          },
        ]
      : [];
    // The ward page kept its Example history switch in the old hero, so it stays, last.
    const history: HeroChipItem = {
      id: "history",
      label: "Example history",
      icon: <Clock strokeWidth={1.75} aria-hidden="true" />,
      onClick: () => setStatisticsSamples(!samples),
      pressed: samples,
      testId: "ward-statistics-example-history",
    };
    return [
      ...wardSteps(model),
      ...(isPhone ? [...exportChip, ...compare] : [...allWards, ...compare, ...exportChip]),
      history,
    ];
  };
  return {
    title: unit.name,
    soft: (
      <span data-testid="ward-statistics-ward-identity">
        <span data-testid="ward-statistics-ward-site">{siteLabel}</span>
        {` · ${cohortLabel.toLowerCase()}`}
      </span>
    ),
    live: !isPhone,
    content: ({ exportFigures }) => (
      <HeroTop
        figures={<HeroFigures label="Ward figures" items={figures} />}
        act={
          <HeroAct
            tone="calm"
            testId="ward-statistics-ward-act"
            title={
              pulled > 0
                ? `${pulled} pulled ${pulled === 1 ? "bed" : "beds"} not arrived`
                : "No pulled beds waiting to arrive"
            }
            sub={wardDesk && pulled > 0 && oldestPulled !== null ? `oldest ${durMinutes(oldestPulled)}` : undefined}
            action={openWard ? { ...openWard, testId: "ward-statistics-ward-open" } : undefined}
          />
        }
        chips={<HeroQuickChips label="Ward tools" items={chips(exportFigures)} />}
        band={isPhone && stayStrip ? <WardStayBand strip={stayStrip} /> : undefined}
      />
    ),
  };
}
