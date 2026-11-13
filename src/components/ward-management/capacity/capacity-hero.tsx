"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Presentation, Printer } from "lucide-react";

import {
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
import { BED_MEETING_AGENDA_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";

import type { BedKindGap } from "./capacity-derivations";
import { isConfirmationFresh } from "./capacity-gap-words";
import { shortNeed } from "./capacity-mismatch-band";
import { MismatchPopup } from "./capacity-mismatch-popup";
import type { CapacityModel } from "./capacity-model";
import { waitingHref } from "../delays/waiting-href";
import type { SiteEdWaiting } from "./capacity-site-ed";
import { formatInstant } from "@/components/ward-management/ward-clock";
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
 * Wave 4 (D-191, ruling 8): four figures with their windows (Ready, Need a bed, Short, In use, each
 * "· now"), the counts pill that says since when, one on-hero action (Bed meeting sheet, a split
 * chip with the TV view and agenda under its caret) and the gap by bed type. Find a bed moved to the
 * bed map's head; the forecast and held-up chips went (both are rail cards now).
 *
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
  const { confirmations } = model;
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
    <span className={styles.figLabel}>
      In use
      <span className={styles.heroWin}> · now</span>
      {/* Occupancy counts pulled beds as in use (audit P100, D-81). */}
      {model.pulled > 0 ? <SrOnly>, including pulled beds</SrOnly> : null}
    </span>
  );

  // Wave 4 (D-191, ruling 8): one on-hero action. The sheet opens in one tap; the TV view and the
  // agenda sit under its caret (MU3, Josh 5 Nov 2026, kept).
  const meetingMore = [
    ...(tvHref && canOpen(tvHref)
      ? [{ id: "tv", label: "Open on TV", icon: Presentation, onSelect: () => go(tvHref) }]
      : []),
    // Only when this desk may open the agenda (access audit, 31 Oct 2026).
    ...(canOpen(BED_MEETING_AGENDA_HREF)
      ? [{ id: "agenda", label: "Open the meeting agenda", onSelect: () => go(BED_MEETING_AGENDA_HREF) }]
      : []),
  ];
  const chips: HeroChipItem[] = [
    ...(executive
      ? []
      : [
          {
            id: "meeting",
            label: "Bed meeting sheet",
            node: (
              <span className={styles.splitChip}>
                <button
                  type="button"
                  className={`${heroChipClassName} ${styles.splitMain}`}
                  onClick={onSheet}
                  aria-haspopup="dialog"
                  data-testid="capacity-bed-meeting"
                >
                  <Printer {...ICON} />
                  <span>Bed meeting sheet</span>
                </button>
                {meetingMore.length > 0 ? (
                  <Menu
                    label="More bed meeting views"
                    items={meetingMore}
                    align="end"
                    trigger={(props) => (
                      <button
                        type="button"
                        {...props}
                        className={`${heroChipClassName} ${styles.splitCaret}`}
                        aria-label={`More bed meeting views: ${meetingMore.map((item) => item.label).join(", ")}`}
                        data-testid="capacity-bed-meeting-more"
                      >
                        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                  />
                ) : null}
              </span>
            ),
          },
        ]),
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

  const jobs = chips.length > 0 ? <HeroQuickChips label="Capacity jobs" items={chips} /> : undefined;
  // Count labels "Label · window" (shared spec 2): the window word in quiet ink, under the label on a phone.
  // PR E swap: the kit's `window` prop on HeroStat / WindowWord replaces this span.
  const win = (word: string) => <span className={styles.heroWin}> · {word}</span>;
  return (
    <Hero
      level={1}
      className={`${pageTop.hero} ${folderTabClasses.hero} ${styles.capHero}`}
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
                label: <span className={styles.figLabel}>Ready{win("now")}</span>,
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
                id: "need",
                value: gapTotals.waiting,
                label: <span className={styles.figLabel}>Need a bed{win("now")}</span>,
                testId: "capacity-hero-need",
              },
              {
                // PR C owns the rule (ruling 6: add each type's shortfall); this reads `gapTotals`.
                id: "gap",
                value: Math.abs(gap),
                label: (
                  <span className={styles.figLabel}>
                    {gap > 0 ? "Spare" : "Short"}
                    {win("now")}
                  </span>
                ),
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
                  counts confirmed
                  <span className={styles.heroWin}> · since {formatInstant(confirmations.since)}</span>
                  {firstToConfirm
                    ? ` · ${firstToConfirm.name} last at ${formatInstant(firstToConfirm.allocatable.confirmedAt)}`
                    : null}
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
              title={
                <>
                  By bed type<span className={styles.heroWin}> · now</span>
                </>
              }
              aside={networkWide ? "Network-wide" : undefined}
              testId="capacity-mismatch"
              cells={typeRows.map((row) => {
                const title = shortNeed(row.need);
                const likely = byId.get(row.id)?.likely;
                const short = row.gap < 0;
                // Wave 4: "13 waiting · 7 fit"; tomorrow is the Forecast card's, not repeated here.
                const fit = `${row.bedsThatFit} fit`;
                const tomorrow = likely === undefined ? "" : `, tomorrow ${gapShort(likely)}`;
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
                  note: `${row.waiting} waiting · ${fit}`,
                  // The spoken name starts with the cell's visible words in order (WCAG 2.5.3, label in
                  // name), then adds the beds that fit and what pressing it opens.
                  ariaLabel: `${title}: ${gapShort(row.gap)}, ${row.waiting} waiting, ${fit}${tomorrow}. Who is waiting and where`,
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
  return phone ? (
    <div className={styles.pillWrap}>{children}</div>
  ) : (
    <section aria-label="Bed counts confirmed" className={styles.pillWrap}>
      {children}
    </section>
  );
}
