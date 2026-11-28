"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";

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
import { medianDays } from "@/components/ward-management/ward-statistics";
import type { StatisticsHeroTop } from "./statistics-hero";
import { NO_BEDS_TEXT } from "./statistics-occupancy";
import { statisticsCountText, type StatisticsCount } from "./statistics-small-numbers";
import { setStatisticsSamples } from "./statistics-samples";
import { ChangeWard } from "./statistics-ward-change-ward";
import type { WardDetailModel } from "./statistics-wards-index";
import top from "./statistics-ward-top.module.css";

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
                so far, median <b>{median}</b> {median === 1 ? "day" : "days"}
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
 * figures it already derives, the pulled beds not yet arrived as a calm act row, the ward stepper,
 * Open ward and tools as chips, and on a phone the Length of stay strip.
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
  shareHosted = false,
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
  /** The tabs row draws the Share menu (`useShareMenuHosted`), which carries Example history. */
  shareHosted?: boolean;
}): StatisticsHeroTop {
  const { unit, wardOccupancy, occupancyPct, capacity, statistics, oldestPulled, countsOnly } = model;
  const averageStay = statistics.averageCompletedStayDays;
  const inUse: HeroFigureItem = {
    id: "in-use",
    value: wardOccupancy.inUse,
    unit: <>&thinsp;/&thinsp;{unit.beds}</>,
    label: unit.beds > 0 ? `in use, ${occupancyPct}%` : `in use, ${NO_BEDS_TEXT.toLowerCase()}`,
    testId: "ward-stat-in-use",
  };
  const readyFigure: HeroFigureItem = {
    id: "ready",
    value: <span data-testid="ward-stat-capacity-ready">{capacity.available}</span>,
    label: "ready",
  };
  const stayFigure: HeroFigureItem | null =
    averageStay === null
      ? null
      : { id: "stay", value: averageStay, unit: <>&thinsp;days</>, label: "average completed stay" };
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
  // Audit three #22 (Josh, 28 Nov 2026): Open ward is a chip beside Change ward, not the action of
  // the unrelated pulled-beds line, which stays a plain line.
  const openWard: HeroChipItem[] = countsOnly
    ? []
    : [
        {
          id: "open-ward",
          label: "Open ward",
          icon: <ArrowUpRight strokeWidth={1.75} aria-hidden="true" />,
          href: unitHref(unit.id),
          testId: "ward-statistics-ward-open",
        },
      ];
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
    // Audit two (#65): no Compare or All wards chips; both are tabs in the row below the hero.
    // Example history is a ticked item of the Share menu (audit two #97); the chip stays only on a
    // desk with no tabs row, last.
    const history: HeroChipItem = {
      id: "history",
      label: "Example history",
      icon: <Clock strokeWidth={1.75} aria-hidden="true" />,
      onClick: () => setStatisticsSamples(!samples),
      pressed: samples,
      testId: "ward-statistics-example-history",
    };
    return [...wardSteps(model), ...openWard, ...exportChip, ...(shareHosted ? [] : [history])];
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
          />
        }
        chips={
          chips(exportFigures).length > 0 ? (
            <HeroQuickChips label="Ward tools" items={chips(exportFigures)} />
          ) : undefined
        }
        band={isPhone && stayStrip ? <WardStayBand strip={stayStrip} /> : undefined}
      />
    ),
  };
}
