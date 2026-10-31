"use client";

import Link from "next/link";
import { ChevronDown, Monitor, Printer } from "lucide-react";

import { buttonClass, durMinutes, Hero, HeroChip, HeroStat, Menu, OccupancyRing, SrOnly } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { formatWardOccupancy } from "@/components/ward-management/ward-occupancy";
import { PageLiveChip } from "@/components/ward-management/ward-page-live";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { BED_MEETING_AGENDA_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";

import type { Highlight } from "./capacity-bed-map-cards";
import { isConfirmationFresh } from "./capacity-gap-words";
import type { CapacityModel } from "./capacity-model";
import { gapWords } from "./capacity-range-line";
import type { SiteEdWaiting } from "./capacity-site-ed";
import styles from "./capacity-page.module.css";

/**
 * Capacity's hero: beds ready of all beds, the ring, and one chip row. The figures are the whole
 * modelled network (or the site, for a site bed manager), whatever service is chosen; the bed map
 * below is the part a service narrows, so the eyebrow says so.
 */
export function CapacityHero({
  model,
  isPhone,
  service,
  tvHref,
  executive,
  edWaiting,
  highlight,
  onHighlight,
  onSheet,
  onWard,
}: {
  model: CapacityModel;
  isPhone: boolean;
  service: string | null;
  /** The bed meeting TV link, or undefined when the TV view is off. */
  tvHref: string | undefined;
  /** The executive desk opens neither the bed meeting nor its TV view. */
  executive: boolean;
  /** Site bed manager only: the site's own ED as counts (Josh, 30 Oct 2026). */
  edWaiting: SiteEdWaiting | null;
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight) => void;
  onSheet: () => void;
  onWard: (unitId: string) => void;
}) {
  // Optional, so the screen also renders outside the app router (its tests, the design preview).
  const router = useOptionalRouter();
  const { totals, gapTotals, occupancy, live, now, oldestCount, site, otherSiteRows } = model;
  // Site bed manager (D-80): the hero is the site's; the rest of the network is one plain count.
  const place = site ? site.name : "Modelled network";
  const scope = service === null || site ? place : `${place}, not only ${service}`;
  const elsewhereReady = otherSiteRows.reduce((sum, row) => sum + row.ready, 0);
  const elsewhereBeds = otherSiteRows.reduce((sum, row) => sum + row.unit.beds, 0);
  const oldestStale = oldestCount ? !isConfirmationFresh(oldestCount.unit, now) : false;
  return (
    <Hero
      level={1}
      eyebrow={`Capacity · ${scope}${isPhone ? "" : ` · ${totals.wards} wards · as at ${formatInstant(now)}`}`}
      title={
        <>
          <SrOnly>Capacity, </SrOnly>
          {totals.ready} {isPhone ? "ready" : "beds ready"} of {totals.beds}
        </>
      }
      titleMeta={
        isPhone
          ? `${gapWords(gapTotals.gap)} for ${gapTotals.waiting} needing a bed${
              edWaiting ? ` · ${edWaiting.waiting} waiting in ${edWaiting.short}` : ""
            }`
          : totals.pendingPreparation
            ? `${totals.pendingPreparation} being made ready`
            : undefined
      }
      lead={isPhone ? undefined : <OccupancyRing percent={occupancy.percent} alertAt={model.alertAt} scope={place} />}
      stats={
        isPhone ? (
          <>
            <HeroStat
              value={model.lockedReady}
              label="Locked ready"
              tone="success"
              pressed={highlight === "locked"}
              onToggle={() => onHighlight("locked")}
            />
            <HeroStat value={model.pulled} label="Beds pulled" tone={model.pulled > 0 ? "warning" : undefined} />
            <HeroStat
              value={formatWardOccupancy(occupancy, "Not known")}
              // Occupancy counts pulled beds as in use (audit P100, D-81), so the label says so; the count
              // itself is the Beds pulled stat beside it, which keeps the label to two lines.
              label={model.pulled > 0 ? "In use, including pulled" : "Of beds in use"}
            />
          </>
        ) : undefined
      }
      bar={
        isPhone ? undefined : (
          <div className={styles.heroStats} role="group" aria-label={site ? `${site.name} beds` : "Network beds"}>
            <HeroChip
              value={model.lockedReady}
              label="Locked ready"
              pressed={highlight === "locked"}
              onPress={() => onHighlight("locked")}
            />
            <HeroChip
              value={model.openReady}
              label="Open ready"
              pressed={highlight === "open"}
              onPress={() => onHighlight("open")}
            />
            <HeroChip value={model.pulled} label="Beds pulled" tone={model.pulled > 0 ? "warning" : undefined} />
            <HeroChip value={model.dueOutToday ?? "Not tracked"} label="Due out today" />
            {oldestCount ? (
              <HeroChip
                value={durMinutes(Math.max(0, now - oldestCount.confirmedAt))}
                label={`Oldest count · ${oldestCount.unit.name}`}
                tone={oldestStale ? "warning" : undefined}
                onPress={() => onWard(oldestCount.unit.id)}
                className={styles.heroJump}
              />
            ) : null}
            {/* Site bed manager: the site's ED, counts only, with the All EDs page's words. */}
            {edWaiting ? (
              <HeroChip value={edWaiting.waiting} label={<SpelledCodes text={`Waiting in ${edWaiting.short}`} />} />
            ) : null}
            {edWaiting && edWaiting.pastTarget > 0 ? (
              <HeroChip
                value={edWaiting.pastTarget}
                label={<SpelledCodes text={`Past target in ${edWaiting.short}`} />}
                tone="warning"
              />
            ) : null}
            {site ? <HeroChip value={elsewhereReady} label={`ready at other sites, of ${elsewhereBeds} beds`} /> : null}
          </div>
        )
      }
      aside={
        <>
          <span className={styles.heroLive}>
            <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
          </span>
          {/* The executive desk: the bed meeting and its TV view are not this desk's screens. */}
          {isPhone || executive ? null : (
            <>
              <Menu
                label="Bed meeting"
                align="end"
                items={[
                  { id: "sheet", label: "Print the meeting sheet", icon: Printer, onSelect: onSheet },
                  {
                    id: "agenda",
                    label: "Open the meeting agenda",
                    onSelect: () =>
                      router ? router.push(BED_MEETING_AGENDA_HREF) : window.location.assign(BED_MEETING_AGENDA_HREF),
                  },
                ]}
                trigger={(props) => (
                  <button type="button" {...props} className={buttonClass({ variant: "onHero" })}>
                    <Printer size={15} aria-hidden="true" /> Bed meeting <ChevronDown size={13} aria-hidden="true" />
                  </button>
                )}
              />
              {tvHref ? (
                <Link href={tvHref} className={buttonClass({ variant: "onHero" })}>
                  <Monitor size={15} aria-hidden="true" /> Open on TV
                </Link>
              ) : null}
            </>
          )}
        </>
      }
    />
  );
}
