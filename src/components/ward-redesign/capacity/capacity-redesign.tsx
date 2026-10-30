"use client";

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
import { CapacityWardSidebar } from "./capacity-ward-sidebar";
import { PlannedAdmissionsPanel } from "./planned-admissions-panel";
import { ReadyByRoadTime } from "@/components/ward-management/capacity/capacity-road-time";
import { StepDownBoard } from "./step-down-board";

import { RedesignPage } from "../parts/redesign-page";
import { gapWords } from "../parts/range-line";
import { Kicker } from "../parts/how-worked-out";
import { BedForecast } from "./bed-forecast";
import { BedMapCards, type Highlight } from "./bed-map-cards";
import { BedMeetingSheetDialog } from "./bed-meeting-sheet-dialog";
import { CapacitySide } from "./capacity-side";
import { MismatchBand } from "./mismatch-band";
import { ScenarioDialog } from "./scenario-dialog";
import { useCapacityModel, type CapacityModel } from "./use-capacity-model";
import styles from "./capacity-redesign.module.css";

type Popup = { kind: "scenario" } | { kind: "sheet" } | { kind: "ward"; unitId: string } | { kind: "forecast" } | null;
type PhoneTab = "overview" | "wards" | "planned";

/**
 * Capacity, redesigned (October 2026 design review). The page answers one question, "where is the
 * mismatch", in reading order: the mismatch by bed type, the forecast at full width, the bed map
 * with its short side column, then planned admissions and step down. On a phone the same parts are
 * three tabs. Every figure comes from the derivations today's screen uses (`use-capacity-model.ts`).
 */
export function CapacityRedesign({ openOnLoad }: { openOnLoad?: string }) {
  const model = useCapacityModel();
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
  const openWard = (unitId: string) => setPopup({ kind: "ward", unitId });

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
            <PhoneOverview model={model} onForecast={() => setPopup({ kind: "forecast" })} />
          ) : phoneTab === "wards" ? (
            <BedMapCards model={model} onSelectWard={openWard} highlight={highlight} onHighlight={setHighlight} />
          ) : (
            <PlannedAdmissionsPanel now={now} />
          )}
        </>
      ) : (
        <>
          <MismatchBand model={model} />
          <BedForecast model={model} onTryScenario={() => setPopup({ kind: "scenario" })} />
          <div className={styles.mapRow}>
            <BedMapCards
              model={model}
              onSelectWard={openWard}
              selectedUnitId={selectedRow?.unit.id}
              highlight={highlight}
              onHighlight={setHighlight}
            />
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
      <Drawer
        open={selectedRow !== undefined}
        onClose={() => setPopup(null)}
        ariaLabel={selectedRow ? `${selectedRow.unit.name}, ward capacity` : "Ward capacity"}
        headerHidden
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
        <BedForecast model={model} onTryScenario={() => setPopup({ kind: "scenario" })} />
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
}: {
  model: CapacityModel;
  isPhone: boolean;
  tvOn: boolean;
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight) => void;
  onSheet: () => void;
  onWard: (unitId: string) => void;
}) {
  const router = useRouter();
  const { totals, gapTotals, occupancy, live, now, oldestCount } = model;
  const scope = "Modelled network";
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
          ? `${gapWords(gapTotals.gap)} for ${gapTotals.waiting} needing a bed`
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
          <div className={styles.heroStats} role="group" aria-label="Network beds">
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

/** The phone's first tab: the mismatch as rows, the forecast in three figures, then wards to check. */
function PhoneOverview({ model, onForecast }: { model: CapacityModel; onForecast: () => void }) {
  const { gapRows, gapTotals, tomorrowByKind, forecast, week, wardsToCheck, networkRows, roadTimeFromEdId, now } =
    model;
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  const tomorrow = forecast.horizons[0];
  const weekOut = week.total.out.reduce((sum, value) => sum + value, 0);
  return (
    <>
      <Card aria-labelledby="phone-mismatch">
        <CardHead id="phone-mismatch" title="Where the mismatch is" />
        <ul className={styles.phoneRows}>
          {[
            ...gapRows.map((row) => ({ ...row, likely: byId.get(row.id)?.likely })),
            { id: "all", need: "All four together", ...gapTotals, likely: tomorrowByKind.total.likely },
          ].map((row) => (
            <li key={row.id} className={styles.phoneRow}>
              <div>
                <b className={styles.small}>{row.need}</b>
                <span className={styles.mutedXs}>
                  {row.waiting} waiting · {row.bedsThatFit} fit
                  {row.likely !== undefined ? ` · tomorrow ${gapWords(row.likely)}` : ""}
                </span>
              </div>
              <span className={`${styles.small} ${row.gap < 0 ? styles.warnInk : styles.okInk}`}>
                <StatusGlyph tone={row.gap < 0 ? "warning" : "success"} size={9} /> {gapWords(row.gap)}
              </span>
            </li>
          ))}
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
        <dl className={styles.phoneForecast}>
          <div>
            <dt>
              <Kicker>Now</Kicker>
            </dt>
            <dd className={gapTotals.gap < 0 ? styles.warnInk : styles.okInk}>{gapWords(gapTotals.gap)}</dd>
          </div>
          {tomorrow ? (
            <div>
              <dt>
                <Kicker>Tomorrow</Kicker>
              </dt>
              <dd className={tomorrow.likely < 0 ? styles.warnInk : styles.okInk}>{gapWords(tomorrow.likely)}</dd>
              <dd className={styles.mutedXs}>
                {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>
              <Kicker>Next 7 days</Kicker>
            </dt>
            <dd>{weekOut}</dd>
            <dd className={styles.mutedXs}>beds going out</dd>
          </div>
        </dl>
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
      <ReadyByRoadTime
        rows={networkRows}
        defaultEdId={roadTimeFromEdId}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        wardHref={(unitId) => `/ward-flow/ward/${unitId}`}
      />
    </>
  );
}
