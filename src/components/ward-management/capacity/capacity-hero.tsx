"use client";

import { useState, type ReactNode } from "react";
import { ChartColumn, ChevronDown, Clock, Presentation, Printer, Search } from "lucide-react";

import {
  durMinutes,
  folderTabClasses,
  Hero,
  HeroBand,
  HeroFigures,
  HeroPill,
  HeroQuickChips,
  HeroTop,
  heroChipClassName,
  Menu,
  SrOnly,
  type HeroChipItem,
} from "@/components/wf";
import { formatWardOccupancy } from "@/components/ward-management/ward-occupancy";
import { PageLiveChip } from "@/components/ward-management/ward-page-live";
import { CountBreakdown } from "@/components/ward-management/count-breakdown";
import { wardReadyBreakdownRows } from "@/components/ward-management/count-breakdown-rows";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { PAGE_OWNERS } from "@/components/ward-management/ward-page-owners";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { BED_MEETING_AGENDA_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";

import type { BedKindGap } from "./capacity-derivations";
import { isConfirmationFresh } from "./capacity-gap-words";
import { shortNeed } from "./capacity-mismatch-band";
import { MismatchPopup } from "./capacity-mismatch-popup";
import type { CapacityModel } from "./capacity-model";
import { waitingHref } from "../delays/waiting-href";
import { HELD_UP_HREF } from "./capacity-held-up";
import type { SiteEdWaiting } from "./capacity-site-ed";
import styles from "./capacity-page.module.css";
import pageTop from "@/components/ward-management/page-top-title.module.css";

const WARDS_HREF = "/ward-flow/wards";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** "6 short", "2 spare", "enough": the band's short words (the Mismatch pop-up keeps the long ones). */
function gapShort(gap: number): string {
  if (gap === 0) return "enough";
  return gap < 0 ? `${-gap} short` : `${gap} spare`;
}

/**
 * Capacity's top (page tops, Josh 9 Nov 2026): three figures, the counts-confirmed pill with the
 * coordinator's Ask, the page's jobs as chips, and one slim band of the gap by bed type now (each
 * cell opens who is waiting and where, the pop-up the Mismatch card used to open). The figures are
 * the whole modelled network (or the site, for a site bed manager), whatever service is chosen;
 * the bed map below is the part a service narrows, so the eyebrow then says so.
 */
export function CapacityHero({
  model,
  isPhone,
  service,
  executive,
  edWaiting,
  networkWide,
  hideEmptyTypes,
  tvHref,
  onSheet,
  onForecast,
  onWard,
  onAskWard,
}: {
  model: CapacityModel;
  isPhone: boolean;
  service: string | null;
  /** The executive desk opens neither the bed meeting nor the bed finder. */
  executive: boolean;
  /** Site bed manager only: the site's own ED as counts (Josh, 30 Oct 2026). */
  edWaiting: SiteEdWaiting | null;
  /** A service is chosen, but who is waiting is counted across the network, so the band says so. */
  networkWide: boolean;
  /** A site bed manager's site holds only some bed types; an empty type is left out. */
  hideEmptyTypes: boolean;
  /** The bed meeting TV link, or undefined when the TV view is off. */
  tvHref: string | undefined;
  onSheet: () => void;
  onForecast: () => void;
  onWard: (unitId: string) => void;
  /** The coordinator's Ask on the counts pill; absent for a desk that may not ask a ward. */
  onAskWard?: (unitId: string) => void;
}) {
  const canOpen = useCanOpenHref();
  const router = useOptionalRouter();
  const go = (href: string) => (router ? router.push(href) : window.location.assign(href));
  const [openKind, setOpenKind] = useState<BedKindGap["id"] | null>(null);
  const { totals, gapTotals, gapRows, tomorrowByKind, occupancy, live, now, oldestCount, site } = model;
  const place = site ? site.name : "Modelled network";
  const oldestStale = oldestCount ? !isConfirmationFresh(oldestCount.unit, now) : false;
  const { confirmations, heldUp } = model;
  const firstToConfirm = confirmations.waiting[0];
  const countTarget = firstToConfirm?.id ?? oldestCount?.unit.id;
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  // Role view (site bed manager): a type with nobody waiting, no bed that fits and nothing
  // forecast is left out, not drawn as 0 (the rule the Mismatch card had).
  const typeRows = hideEmptyTypes
    ? gapRows.filter((row) => {
        const next = byId.get(row.id);
        const forecastNothing = next === undefined || (next.low === 0 && next.likely === 0 && next.high === 0);
        return row.waiting > 0 || row.bedsThatFit > 0 || !forecastNothing;
      })
    : gapRows;
  const openRow = gapRows.find((row) => row.id === openKind) ?? null;
  const gap = gapTotals.gap;
  const occupancyLabel = (
    <>
      in use
      {/* Occupancy counts pulled beds as in use (audit P100, D-81). */}
      {model.pulled > 0 ? <SrOnly>, including pulled beds</SrOnly> : null}
    </>
  );

  const chips: HeroChipItem[] = [
    ...(executive
      ? []
      : [
          {
            id: "find",
            label: "Find a bed",
            icon: <Search {...ICON} />,
            onClick: () => requestToolsTool("bed-finder", activeElement()),
            testId: "capacity-hero-find-bed",
          },
          {
            id: "meeting",
            label: "Bed meeting",
            // The sheet, the TV view and the agenda stay in one menu (MU3, Josh 5 Nov 2026).
            node: (
              <Menu
                label="Bed meeting"
                items={[
                  { id: "sheet", label: "Print the meeting sheet", icon: Printer, onSelect: onSheet },
                  ...(tvHref && canOpen(tvHref)
                    ? [{ id: "tv", label: "Open on TV", icon: Presentation, onSelect: () => go(tvHref) }]
                    : []),
                  // Only when this desk may open the agenda (access audit, 31 Oct 2026).
                  ...(canOpen(BED_MEETING_AGENDA_HREF)
                    ? [{ id: "agenda", label: "Open the meeting agenda", onSelect: () => go(BED_MEETING_AGENDA_HREF) }]
                    : []),
                ]}
                trigger={(props) => (
                  <button type="button" {...props} className={heroChipClassName} data-testid="capacity-bed-meeting">
                    <Printer {...ICON} />
                    <span>Bed meeting</span>
                    <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              />
            ),
          },
        ]),
    // The phone's Overview opens with the forecast card, so the chip would repeat it there.
    ...(isPhone
      ? []
      : [
          {
            id: "forecast",
            label: "Bed forecast",
            icon: <ChartColumn {...ICON} />,
            onClick: onForecast,
            testId: "capacity-hero-forecast",
          },
        ]),
    {
      id: "held-up",
      // D-191 item 5 (Josh, 13 Nov 2026): held up is due by tomorrow, as the meeting sheet and TV
      // count it (`heldUpDueByTomorrow`); the label names the span.
      label: heldUp.total === 1 ? "Held-up discharge, due by tomorrow" : "Held-up discharges, due by tomorrow",
      icon: <Clock {...ICON} />,
      count: heldUp.total,
      countTone: "quiet",
      href: canOpen(HELD_UP_HREF) ? HELD_UP_HREF : undefined,
      testId: "capacity-hero-held-up",
    },
    // Site bed manager: the site's ED, counts only, with the All EDs page's words (WF-FIG-016).
    ...(edWaiting && canOpen(PAGE_OWNERS.waiting.route)
      ? [
          {
            id: "ed-waiting",
            label: `Waiting in ${edWaiting.short}`,
            count: edWaiting.waiting,
            countTone: edWaiting.pastTarget > 0 ? ("warning" as const) : ("quiet" as const),
            href: waitingHref(undefined, edWaiting.edId),
            testId: "capacity-hero-ed-waiting-link",
          },
        ]
      : []),
  ];

  const jobs = <HeroQuickChips label="Capacity jobs" items={chips} />;
  return (
    <Hero
      level={1}
      className={`${pageTop.hero} ${folderTabClasses.hero}`}
      // A chosen service or a site: say whose figures these are; otherwise the header says it.
      eyebrow={site || service !== null ? (site ? place : `${place}, not only ${service}`) : undefined}
      phoneEyebrow={site || service !== null ? "show" : undefined}
      title={
        <>
          <SrOnly>Capacity, </SrOnly>
          Beds <span className={styles.titleSoft}>ready and short</span>
        </>
      }
      aside={<PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />}
    >
      <HeroTop
        figures={
          <HeroFigures
            label={site ? `${site.name} beds` : "Network beds"}
            items={[
              {
                id: "ready",
                value: totals.ready,
                unit: `/ ${totals.beds}`,
                label: totals.ready === 1 ? "bed ready" : "beds ready",
                testId: "capacity-hero-ready",
                // Item 5: the wards the figure sums (`networkTotals` over these rows), each with its ready beds.
                renderPress: (press) => (
                  <CountBreakdown
                    value={totals.ready}
                    noun={totals.ready === 1 ? "bed ready" : "beds ready"}
                    kind="beds"
                    scope={executive ? "aggregate" : "own"}
                    countedAt={now}
                    rows={() => wardReadyBreakdownRows(model.networkRows, canOpen)}
                    className={press.className}
                    id={press.id}
                    labelledBy={press.labelledBy}
                    testId="capacity-hero-ready-breakdown"
                  >
                    {press.children}
                  </CountBreakdown>
                ),
              },
              {
                id: "gap",
                value: Math.abs(gap),
                label: `${gap < 0 ? "short" : gap > 0 ? "spare" : "short"} for ${gapTotals.waiting}`,
                testId: "capacity-hero-gap",
              },
              {
                id: "occupancy",
                value: formatWardOccupancy(occupancy, "Not known"),
                label: occupancyLabel,
                href: canOpen(WARDS_HREF) ? WARDS_HREF : undefined,
                underline: true,
                testId: "capacity-hero-occupancy",
              },
            ]}
          />
        }
        pill={
          <CountsRegion phone={isPhone}>
            <HeroPill
              tone={firstToConfirm || oldestStale ? "warning" : undefined}
              testId="capacity-hero-confirmed"
              text={
                <>
                  <b className={styles.pillCount}>
                    {confirmations.confirmed} of {confirmations.total}
                  </b>{" "}
                  {firstToConfirm
                    ? `confirmed · ${firstToConfirm.name} ${durMinutes(Math.max(0, now - firstToConfirm.allocatable.confirmedAt))} old`
                    : "counts confirmed this shift"}
                </>
              }
              action={
                firstToConfirm && onAskWard
                  ? {
                      label: "Ask",
                      ariaLabel: `Ask ${firstToConfirm.name} to confirm its beds`,
                      onClick: () => onAskWard(firstToConfirm.id),
                      testId: "capacity-hero-ask",
                    }
                  : countTarget && (firstToConfirm || oldestStale)
                    ? { label: "Open", onClick: () => onWard(countTarget), testId: "capacity-hero-open-count" }
                    : undefined
              }
            />
          </CountsRegion>
        }
        // Wider screens: the chips sit right of the figures (Home's act place) with the pill under the
        // figures; a phone stacks figures, pill, then chips (page tops, Josh 9 Nov 2026).
        act={isPhone ? undefined : jobs}
        chips={isPhone ? jobs : undefined}
        // The site bed manager's home never shows the shell Quick bar as a second chip row.
        quickBar={false}
        band={
          typeRows.length > 0 ? (
            <HeroBand
              title="Short now, by bed type"
              aside={networkWide ? "Network-wide" : undefined}
              testId="capacity-mismatch"
              cells={typeRows.map((row) => {
                const title = shortNeed(row.need);
                const likely = byId.get(row.id)?.likely;
                const short = row.gap < 0;
                const tomorrow = likely === undefined ? "" : ` · tomorrow ${gapShort(likely)}`;
                return {
                  id: row.id,
                  label: title,
                  value: (
                    <>
                      {row.gap === 0 ? null : Math.abs(row.gap)}{" "}
                      <span className={styles.bandWord}>{row.gap === 0 ? "enough" : short ? "short" : "spare"}</span>
                    </>
                  ),
                  tone: short ? "warning" : "ok",
                  note: `${row.waiting} waiting${tomorrow}`,
                  // The spoken name starts with the cell's visible words in order (WCAG 2.5.3, label in
                  // name), then adds the beds that fit and what pressing it opens.
                  ariaLabel: `${title}: ${gapShort(row.gap)}, ${row.waiting} waiting${tomorrow}. ${row.bedsThatFit} ready that fit. Who is waiting and where`,
                  onClick: () => setOpenKind(row.id),
                  testId: `capacity-mismatch-${row.id}`,
                };
              })}
            />
          ) : undefined
        }
      />
      <MismatchPopup
        row={openRow}
        title={shortNeed(openRow?.need ?? "")}
        tomorrow={openKind ? byId.get(openKind) : undefined}
        now={now}
        onClose={() => setOpenKind(null)}
        units={model.gapUnits}
        onWard={(unitId) => {
          setOpenKind(null);
          onWard(unitId);
        }}
      />
    </Hero>
  );
}

/**
 * Wider screens: the counts pill and its Ask are the "Bed counts confirmed" region, as the hero's
 * shift figure was. A phone leaves the region to the Overview's This shift card, so the name stays
 * unique on each screen size.
 */
function CountsRegion({ phone, children }: { phone: boolean; children: ReactNode }) {
  return phone ? children : <section aria-label="Bed counts confirmed">{children}</section>;
}

/** The chip that opened the bed finder gets focus back when it closes. */
function activeElement(): HTMLElement | undefined {
  return document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
}
