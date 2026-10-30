"use client";

// Fork of src/components/ward-redesign/capacity/capacity-redesign.tsx: a site bed manager branch.

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Monitor, Printer } from "lucide-react";

import {
  Button,
  buttonClass,
  Card,
  CardHead,
  Drawer,
  Hero,
  HeroStat,
  Menu,
  OccupancyRing,
  Segmented,
  SrOnly,
  StatusGlyph,
  durMinutes,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { formatWardOccupancy } from "@/components/ward-management/ward-occupancy";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { PageLiveChip } from "@/components/ward-management/ward-page-live";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { BED_MEETING_AGENDA_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import { CapacityWardSidebar } from "@/components/ward-redesign/capacity/capacity-ward-sidebar";
import { PlannedAdmissionsPanel } from "@/components/ward-redesign/capacity/planned-admissions-panel";
import { ReadyByRoadTime } from "@/components/ward-management/capacity/capacity-road-time";
import { StepDownBoard } from "@/components/ward-redesign/capacity/step-down-board";

import { RedesignPage } from "@/components/ward-redesign/parts/redesign-page";
import { gapWords } from "@/components/ward-redesign/parts/range-line";
import { BedForecast } from "./bed-forecast";
import { BedMapCards, type Highlight } from "@/components/ward-redesign/capacity/bed-map-cards";
import { BedMeetingSheetDialog } from "@/components/ward-redesign/capacity/bed-meeting-sheet-dialog";
import { CapacitySide } from "./capacity-side";
import { MismatchBand } from "./mismatch-band";
import { ScenarioDialog } from "@/components/ward-redesign/capacity/scenario-dialog";
import { useCapacityModel, type CapacityModel } from "./use-capacity-model";
import { OtherSitesCounts } from "./other-sites-counts";
import { useSiteEdWaiting, type SiteEdWaiting } from "./site-ed-waiting";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";
import site from "./capacity-site.module.css";

type Popup = { kind: "scenario" } | { kind: "sheet" } | { kind: "ward"; unitId: string } | { kind: "forecast" } | null;
type PhoneTab = "overview" | "wards" | "planned";

/**
 * Capacity, redesigned (October 2026 design review). The page answers one question, "where is the
 * mismatch", in reading order: the mismatch by bed type, the forecast at full width, the bed map
 * with its short side column, then planned admissions and step down. On a phone the same parts are
 * three tabs. Every figure comes from the derivations today's screen uses (`use-capacity-model.ts`).
 */
export function AsBedManagerCapacity({ openOnLoad }: { openOnLoad?: string }) {
  const model = useCapacityModel();
  // ROLE BRANCH (bed_manager, D-80): `model.site` is set only for a site bed manager. Its page leads
  // with its own site's wards in detail and shows every other site as bed counts only.
  const siteDesk = model.site !== undefined;
  const isPhone = useIsPhone();
  const [popup, setPopup] = useState<Popup>(() => initialPopup(openOnLoad, model));
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("overview");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const highlightFromHero = (next: Highlight) => {
    const value = highlight === next ? null : next;
    setHighlight(value);
    if (isPhone) startTransition(() => setPhoneTab("wards"));
    else if (value) document.getElementById("capacity-bed-map")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const { dispatch, units, movements, bedReleases, admissions, leaveBeds, referrals, configuration } =
    useWardFlowSelect(
      "dispatch",
      "units",
      "movements",
      "bedReleases",
      "admissions",
      "leaveBeds",
      "referrals",
      "configuration",
    );
  const thresholds = useDueSoonThresholds();
  const patientOf = usePatientOf();
  const toast = useOptionalToast();
  const tvOn = useWardFeatureFlag("bed-meeting-tv");
  const { now } = model;
  // ROLE BRANCH (bed_manager, Josh 30 Oct): the site's own ED as counts, since Places does not list it.
  const edWaiting = useSiteEdWaiting(model.site, now);

  const sheet = useMemo(
    () =>
      popup?.kind === "sheet"
        ? bedMeetingSheet({
            units,
            movements,
            bedReleases,
            admissions,
            leaveBeds,
            now,
            thresholds,
            service: null,
            // D-83: the printed sheet names people surname first, as the coordinator's copy does.
            nameOf: (movement) => patientOf(movement).formalName,
            referrals,
            referralLimitMinutes: configuration.referralDecisionTargetMinutes,
          })
        : null,
    [popup, units, movements, bedReleases, admissions, leaveBeds, now, thresholds, patientOf, referrals, configuration],
  );
  const selectedRow =
    popup?.kind === "ward" ? model.networkRows.find((row) => row.unit.id === popup.unitId) : undefined;

  const askWard = (unitId: string) => {
    const unit = units.find((candidate) => candidate.id === unitId);
    dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId });
    toast?.push({ tone: "success", title: `Asked ${unit?.name ?? "the ward"} to confirm its beds.` });
  };
  // ROLE BRANCH (bed_manager): another site's ward has no drawer here (its Open ward and Discharge
  // board are not this desk's to open), so choosing one shows its row in Other sites instead.
  const [focusUnitId, setFocusUnitId] = useState<string | undefined>(undefined);
  const openWard = (unitId: string) => {
    if (siteDesk && !model.networkRows.some((row) => row.unit.id === unitId)) {
      setFocusUnitId(unitId);
      if (isPhone) startTransition(() => setPhoneTab("wards"));
      window.setTimeout(
        () => document.getElementById(`bm-other-${unitId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
        50,
      );
      return;
    }
    setPopup({ kind: "ward", unitId });
  };

  return (
    <RedesignPage
      testId="redesign-capacity-page"
      hero={
        <CapacityHero
          model={model}
          isPhone={isPhone}
          tvOn={tvOn}
          highlight={highlight}
          onHighlight={highlightFromHero}
          onSheet={() => setPopup({ kind: "sheet" })}
          onWard={openWard}
          edWaiting={edWaiting}
        />
      }
      footNote="Modelled network bed capacity · CAHS inpatient wards are not modelled · private live feeds are unavailable · Not approved for clinical use"
    >
      {isPhone ? (
        <>
          <Segmented
            label="Capacity view"
            className={styles.phoneTabs}
            items={[
              { id: "overview" as const, label: "Overview" },
              { id: "wards" as const, label: "Wards", count: model.networkRows.length },
              { id: "planned" as const, label: "Planned", count: model.plannedBooked },
            ]}
            value={phoneTab}
            onChange={(tab) => startTransition(() => setPhoneTab(tab))}
          />
          {phoneTab === "overview" ? (
            <PhoneOverview model={model} onForecast={() => setPopup({ kind: "forecast" })} onWard={openWard} />
          ) : phoneTab === "wards" ? (
            <>
              <BedMapCards model={model} onSelectWard={openWard} highlight={highlight} onHighlight={setHighlight} />
              {siteDesk ? <OtherSitesCounts model={model} focusUnitId={focusUnitId} /> : null}
            </>
          ) : (
            <PlannedAdmissionsPanel now={now} />
          )}
        </>
      ) : (
        <>
          <MismatchBand model={model} />
          <BedForecast model={model} onTryScenario={() => setPopup({ kind: "scenario" })} />
          <div className={styles.mapRow}>
            <div className={site.mapColumn}>
              <BedMapCards
                model={model}
                onSelectWard={openWard}
                selectedUnitId={selectedRow?.unit.id}
                highlight={highlight}
                onHighlight={setHighlight}
              />
              {siteDesk ? <OtherSitesCounts model={model} focusUnitId={focusUnitId} /> : null}
            </div>
            <CapacitySide
              model={model}
              selectedUnitId={selectedRow?.unit.id}
              onSelectWard={openWard}
              onAskWard={askWard}
            />
          </div>
          <div className={styles.footRow}>
            <PlannedAdmissionsPanel now={now} />
            <StepDownBoard now={now} />
          </div>
        </>
      )}

      <ScenarioDialog open={popup?.kind === "scenario"} onClose={() => setPopup(null)} model={model.forecastModel} />
      {sheet ? <BedMeetingSheetDialog open onClose={() => setPopup(null)} sheet={sheet} now={now} /> : null}
      {/* Redesign (Josh, 30 Oct): the drawer's own title and close replace the panel's "Back to
          network" line. */}
      <Drawer
        open={selectedRow !== undefined}
        onClose={() => setPopup(null)}
        title={selectedRow?.unit.name ?? "Ward capacity"}
        ariaLabel={selectedRow ? `${selectedRow.unit.name}, ward capacity` : "Ward capacity"}
        testId="redesign-capacity-ward-drawer"
      >
        {selectedRow ? <CapacityWardSidebar row={selectedRow} onBack={() => setPopup(null)} now={now} /> : null}
      </Drawer>
      <Drawer
        open={popup?.kind === "forecast"}
        onClose={() => setPopup(null)}
        title="Bed forecast"
        mobileSize="viewport"
        testId="redesign-capacity-forecast-sheet"
      >
        <BedForecast model={model} onTryScenario={() => setPopup({ kind: "scenario" })} stacked />
      </Drawer>
    </RedesignPage>
  );
}

function initialPopup(openOnLoad: string | undefined, model: CapacityModel): Popup {
  if (openOnLoad === "scenario") return { kind: "scenario" };
  if (openOnLoad === "sheet") return { kind: "sheet" };
  if (openOnLoad === "forecast") return { kind: "forecast" };
  if (openOnLoad === "ward") {
    const first = model.networkRows.find((row) => !row.unit.isClosed);
    return first ? { kind: "ward", unitId: first.unit.id } : null;
  }
  return null;
}

function CapacityHero({
  model,
  isPhone,
  tvOn,
  highlight,
  onHighlight,
  onSheet,
  onWard,
  edWaiting,
}: {
  model: CapacityModel;
  isPhone: boolean;
  tvOn: boolean;
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight) => void;
  onSheet: () => void;
  onWard: (unitId: string) => void;
  /** ROLE BRANCH (bed_manager): the site's ED, counts only; null for every other desk. */
  edWaiting: SiteEdWaiting | null;
}) {
  const router = useRouter();
  const { totals, gapTotals, occupancy, live, now, oldestCount, site: deskSite, otherSiteRows } = model;
  // ROLE BRANCH (bed_manager): the hero is the site's; the rest of the network is one plain count.
  const scope = deskSite ? deskSite.name : "Modelled network";
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
          ? `${gapWords(gapTotals.gap)} for ${gapTotals.waiting} needing a bed${edWaiting ? ` · ${edWaiting.waiting} waiting in ${edWaiting.short}` : ""}`
          : totals.pendingPreparation
            ? `${totals.pendingPreparation} being made ready`
            : undefined
      }
      lead={isPhone ? undefined : <OccupancyRing percent={occupancy.percent} alertAt={model.alertAt} scope={scope} />}
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
            <HeroStat value={formatWardOccupancy(occupancy, "Not known")} label="Of beds in use" />
          </>
        ) : undefined
      }
      bar={
        isPhone ? undefined : (
          <div
            className={styles.heroStats}
            role="group"
            aria-label={deskSite ? `${deskSite.name} beds` : "Network beds"}
          >
            <HeroStat
              inline
              value={model.lockedReady}
              label="Locked ready"
              pressed={highlight === "locked"}
              onToggle={() => onHighlight("locked")}
            />
            <HeroStat
              inline
              value={model.openReady}
              label="Open ready"
              pressed={highlight === "open"}
              onToggle={() => onHighlight("open")}
            />
            {/* Plain figures after the highlight chips, behind a hairline, so they do not read as
                chips that fail to press. */}
            <span className={styles.heroFigures}>
              <HeroStat
                inline
                value={model.pulled}
                label="Beds pulled"
                tone={model.pulled > 0 ? "warning" : undefined}
              />
              <HeroStat inline value={model.dueOutToday ?? "Not tracked"} label="Due out today" />
              {/* ROLE BRANCH (bed_manager): the site's ED, counts only, with the All EDs page's word. */}
              {edWaiting ? (
                <HeroStat
                  inline
                  value={edWaiting.waiting}
                  label={<SpelledCodes text={`Waiting in ${edWaiting.short}`} />}
                />
              ) : null}
              {edWaiting && edWaiting.pastTarget > 0 ? (
                <HeroStat
                  inline
                  value={edWaiting.pastTarget}
                  label={<SpelledCodes text={`Past target in ${edWaiting.short}`} />}
                  tone="warning"
                />
              ) : null}
              {deskSite ? (
                <HeroStat inline value={elsewhereReady} label={`ready at other sites, of ${elsewhereBeds} beds`} />
              ) : null}
            </span>
            {oldestCount ? (
              <HeroStat
                inline
                command
                value={durMinutes(Math.max(0, now - oldestCount.confirmedAt))}
                label={`Oldest count · ${oldestCount.unit.name}`}
                tone={oldestStale ? "warning" : undefined}
                onToggle={() => onWard(oldestCount.unit.id)}
                className={styles.heroJump}
              />
            ) : null}
          </div>
        )
      }
      aside={
        <>
          <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
          {isPhone ? null : (
            <>
              <Menu
                label="Bed meeting"
                align="end"
                items={[
                  { id: "sheet", label: "Print the meeting sheet", icon: Printer, onSelect: onSheet },
                  {
                    id: "agenda",
                    label: "Open the meeting agenda",
                    onSelect: () => router.push(BED_MEETING_AGENDA_HREF),
                  },
                ]}
                trigger={(props) => (
                  <button type="button" {...props} className={buttonClass({ variant: "onHero" })}>
                    <Printer size={15} aria-hidden="true" /> Bed meeting <ChevronDown size={13} aria-hidden="true" />
                  </button>
                )}
              />
              {tvOn ? (
                <Link href={bedMeetingTvHref({})} className={buttonClass({ variant: "onHero" })}>
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

/**
 * The phone's first tab: the mismatch as rows, the forecast in three figures, then wards to check.
 * The network total is the hero's line, so the mismatch lists the four bed types only and the
 * forecast starts at tomorrow (Josh, 30 Oct 2026).
 */
function PhoneOverview({
  model,
  onForecast,
  onWard,
}: {
  model: CapacityModel;
  onForecast: () => void;
  onWard: (unitId: string) => void;
}) {
  const { gapRows, tomorrowByKind, forecast, week, wardsToCheck, networkRows, roadTimeFromEdId, now } = model;
  // ROLE BRANCH (bed_manager): every site's ready beds by road time, opened in the ward drawer
  // (counts only), because another site's ward page is not this desk's to open.
  const siteDesk = model.site !== undefined;
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  const [tomorrow, twoDays] = forecast.horizons;
  const weekOut = week.total.out.reduce((sum, value) => sum + value, 0);
  return (
    <>
      <Card aria-labelledby="phone-mismatch">
        <CardHead id="phone-mismatch" title="Where the mismatch is" />
        <ul className={styles.phoneRows}>
          {gapRows.map((row) => {
            const likely = byId.get(row.id)?.likely;
            return (
              <li key={row.id} className={styles.phoneRow}>
                <div>
                  <b className={styles.small}>{row.need}</b>
                  <span className={styles.mutedXs}>
                    {row.waiting} waiting · {row.bedsThatFit} fit
                    {likely !== undefined ? ` · tomorrow ${gapWords(likely)}` : ""}
                  </span>
                </div>
                <span className={`${styles.small} ${row.gap < 0 ? styles.warnInk : styles.okInk}`}>
                  <StatusGlyph tone={row.gap < 0 ? "warning" : "success"} size={9} /> {gapWords(row.gap)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card aria-labelledby="phone-forecast">
        <CardHead
          id="phone-forecast"
          title="Bed forecast"
          action={
            <Button size="sm" variant="ghost" iconEnd={ChevronRight} onClick={onForecast} aria-haspopup="dialog">
              Open
            </Button>
          }
        />
        <ul className={styles.phoneRows}>
          {tomorrow ? (
            <li className={styles.phoneRow}>
              <div>
                <b className={styles.small}>Tomorrow</b>
                <span className={styles.mutedXs}>
                  Range {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
                </span>
              </div>
              <span className={`${styles.small} ${tomorrow.likely < 0 ? styles.warnInk : styles.okInk}`}>
                {gapWords(tomorrow.likely)}
              </span>
            </li>
          ) : null}
          {twoDays ? (
            <li className={styles.phoneRow}>
              <div>
                <b className={`${styles.small} ${styles.fcKpiSoftLabel}`}>
                  <span className={`${styles.fcSoftSwatch} ${styles.swHatch}`} aria-hidden="true" />
                  In 48 hours
                </b>
                <span className={styles.mutedXs}>Likely {gapWords(twoDays.likely)} · may move</span>
              </div>
              <span className={`${styles.small} ${styles.muted}`}>
                {gapWords(twoDays.low)} to {gapWords(twoDays.high)}
              </span>
            </li>
          ) : null}
          <li className={styles.phoneRow}>
            <div>
              <b className={styles.small}>Next 7 days</b>
              <span className={styles.mutedXs}>Beds going out</span>
            </div>
            <span className={styles.small}>{weekOut}</span>
          </li>
        </ul>
      </Card>
      <Card aria-labelledby="phone-check">
        <CardHead id="phone-check" title="Wards to check" meta={String(wardsToCheck.length)} />
        {wardsToCheck.length === 0 ? (
          <p className={styles.sideBody}>Every open ward has a ready bed and a fresh count.</p>
        ) : (
          <ul className={styles.phoneRows}>
            {wardsToCheck.slice(0, 5).map((row) => (
              <li key={row.unit.id} className={styles.phoneRow}>
                <div>
                  <b className={styles.small}>
                    <SpelledCodes text={row.unit.name} />
                  </b>
                  <span className={styles.mutedXs}>
                    {row.ready === 0 ? "No ready bed" : `${row.ready} ready`} · count{" "}
                    {durMinutes(Math.max(0, now - row.confirmedAt))} old
                  </span>
                </div>
                <span className={`${styles.small} ${styles.warnInk}`}>
                  <StatusGlyph tone="warning" size={9} /> {isConfirmationFresh(row.unit, now) ? "No bed" : "Stale"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {siteDesk ? (
        <ReadyByRoadTime
          rows={[...networkRows, ...model.otherSiteRows]}
          defaultEdId={roadTimeFromEdId}
          selectedUnitId={undefined}
          onSelectUnit={(unitId) => onWard(unitId)}
        />
      ) : (
        <ReadyByRoadTime
          rows={networkRows}
          defaultEdId={roadTimeFromEdId}
          selectedUnitId={undefined}
          onSelectUnit={() => {}}
          wardHref={(unitId) => `/ward-flow/ward/${unitId}`}
        />
      )}
    </>
  );
}
