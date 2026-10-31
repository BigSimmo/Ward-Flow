"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { Drawer, Segmented, StatusGlyph, useIsPhone, useOptionalToast } from "@/components/wf";
import {
  useDueSoonThresholds,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { HomeBedflow } from "@/components/ward-management/coordinator/home-bedflow";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { tvServiceParam } from "@/components/ward-management/bed-meeting/tv-derivations";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { bedMeetingSheet } from "./bed-meeting-derivations";
import { BedForecast } from "./capacity-bed-forecast";
import { BedMapCards, type Highlight } from "./capacity-bed-map-cards";
import { ComingIn } from "./capacity-coming-in";
import { CapacityHero } from "./capacity-hero";
import { BedMeetingSheetDialog } from "./capacity-meeting-sheet-dialog";
import { MismatchBand } from "./capacity-mismatch-band";
import { useCapacityModel, type CapacityModel } from "./capacity-model";
import { OtherSitesCounts } from "./capacity-other-sites";
import { PhoneOverview } from "./capacity-phone-overview";
import { PlannedCounts } from "./capacity-planned-counts";
import { RoadTimeCard } from "./capacity-road-time-card";
import { ScenarioDialog } from "./capacity-scenario-dialog";
import { ShiftChecks } from "./capacity-shift-checks";
import { useSiteEdWaiting } from "./capacity-site-ed";
import { CapacityWardSidebar } from "./capacity-ward-drawer";
import { PlannedAdmissionsPanel } from "./planned-admissions-panel";
import styles from "./capacity-page.module.css";

type Popup = { kind: "scenario" } | { kind: "sheet" } | { kind: "ward"; unitId: string } | { kind: "forecast" } | null;
type PhoneTab = "overview" | "wards" | "planned";

/**
 * Capacity (redesign approved by Josh, 31 Oct 2026). The page answers one question, "where is the
 * mismatch", never "where could this person go": the mismatch by bed type, the forecast at full
 * width, the bed map, then one row of what is coming in, the nearest ready beds and this shift's
 * checks. On a phone the same parts are three tabs. Every figure comes from the derivations in
 * `capacity-model.ts`; nothing here ranks a ward for a patient.
 *
 * One component serves every desk that opens Capacity:
 * - the bed coordinator sees the modelled network;
 * - a site bed manager (D-80) sees its own site's wards in detail and every other site as bed
 *   counts only, with its own ED as counts (`model.site`);
 * - the executive (Josh, 27 Oct 2026) sees counts only: no bed meeting, no TV view, no asking a
 *   ward, no list of people and no link to a page the desk cannot open.
 *
 * A chosen service narrows the bed map; the hero, mismatch and forecast stay whole-network and the
 * eyebrow says so, as before.
 */
export function CapacityScreen({ openOnLoad }: { openOnLoad?: string } = {}) {
  const model = useCapacityModel();
  const isPhone = useIsPhone();
  const access = useEffectiveWardAccess();
  const executive = access.role === "executive";
  const siteDesk = model.site !== undefined;
  const service = useServiceScope();
  const [openPopup, setOpenPopup] = useState<{ popup: Popup; generation: number | null }>(() => ({
    popup: initialPopup(openOnLoad, model),
    generation: null,
  }));
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("overview");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  // Site bed manager: another site's ward has no drawer here (its ward page and Discharge board are
  // not this desk's to open), so choosing one shows its row in Other sites instead.
  const [focusUnitId, setFocusUnitId] = useState<string | undefined>(undefined);
  const { dispatch, units, movements, bedReleases, admissions, leaveBeds, referrals, configuration, worldGeneration } =
    useWardFlowSelect(
      "dispatch",
      "units",
      "movements",
      "bedReleases",
      "admissions",
      "leaveBeds",
      "referrals",
      "configuration",
      "worldGeneration",
    );
  // A demo reset closes whatever was open (the old side panel did the same), so no drawer shows a
  // ward from the world before; the drawer then hands focus back to its opener.
  const [firstGeneration] = useState(worldGeneration);
  const popup = (openPopup.generation ?? firstGeneration) === worldGeneration ? openPopup.popup : null;
  const setPopup = (next: Popup) => setOpenPopup({ popup: next, generation: worldGeneration });
  // The ward a demo reset closed. The bed map redraws for the new world, so the card that opened
  // the drawer may be a new element; focus goes to that ward's card by its id, once per reset, and
  // only when nothing else has taken focus.
  const resetWardId =
    openPopup.popup?.kind === "ward" && (openPopup.generation ?? firstGeneration) !== worldGeneration
      ? openPopup.popup.unitId
      : undefined;
  useEffect(() => {
    if (resetWardId === undefined) return;
    if (document.activeElement !== document.body && document.activeElement !== null) return;
    const card = [...document.querySelectorAll<HTMLElement>("#capacity-bed-map [data-unit-id]")].find(
      (candidate) => candidate.dataset.unitId === resetWardId,
    );
    card?.focus({ preventScroll: true });
  }, [resetWardId, worldGeneration]);
  const thresholds = useDueSoonThresholds();
  const patientOf = usePatientOf();
  const toast = useOptionalToast();
  const tvOn = useWardFeatureFlag("bed-meeting-tv");
  const edWaiting = useSiteEdWaiting(model.site, model.now);
  const { now } = model;
  const network = useWardNetwork();
  const [bedflowUnitId, setBedflowUnitId] = useState<string | undefined>(undefined);
  const bedflowDischargesHeldUp = useMemo(
    () => serviceRollup(network.sites, units, [...bedReleases], [...leaveBeds], now).service.blockedToday,
    [network.sites, units, bedReleases, leaveBeds, now],
  );

  const mapModel = useMemo<CapacityModel>(() => scopeToService(model, service), [model, service]);
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
            service,
            // D-83: the printed sheet names people surname first.
            nameOf: (movement) => patientOf(movement).formalName,
            referrals,
            referralLimitMinutes: configuration.referralDecisionTargetMinutes,
          })
        : null,
    [
      popup,
      units,
      movements,
      bedReleases,
      admissions,
      leaveBeds,
      now,
      thresholds,
      service,
      patientOf,
      referrals,
      configuration,
    ],
  );
  const selectedRow =
    popup?.kind === "ward" ? model.networkRows.find((row) => row.unit.id === popup.unitId) : undefined;

  // Asking a ward to confirm its beds is the coordinator's step (REQUEST_CAPACITY_REFRESH), as in the
  // ward drawer. A site bed manager confirms on the ward's own page instead, and every other desk,
  // the executive included, changes nothing here.
  const askWard =
    access.role !== "coordinator" || siteDesk
      ? undefined
      : (unitId: string) => {
          const unit = units.find((candidate) => candidate.id === unitId);
          dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId });
          toast?.push({ tone: "success", title: `Asked ${unit?.name ?? "the ward"} to confirm its beds.` });
        };
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
  const highlightFromHero = (next: Highlight) => {
    const value = highlight === next ? null : next;
    setHighlight(value);
    if (isPhone) startTransition(() => setPhoneTab("wards"));
    else if (value) document.getElementById("capacity-bed-map")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const bedMap = (
    <>
      {service !== null && !siteDesk ? (
        <WardServiceScopeBar
          service={service}
          shown={mapModel.networkRows.length}
          total={model.networkRows.length}
          noun="wards"
        />
      ) : null}
      <BedMapCards
        model={mapModel}
        onSelectWard={openWard}
        selectedUnitId={selectedRow?.unit.id}
        highlight={highlight}
        onHighlight={setHighlight}
      />
      {siteDesk ? <OtherSitesCounts model={model} focusUnitId={focusUnitId} /> : null}
    </>
  );
  // The executive sees planned bookings as counts only: the list names each person.
  const planned = executive ? <PlannedCounts now={now} /> : <PlannedAdmissionsPanel key={worldGeneration} now={now} />;

  return (
    <div className={styles.screen} data-testid="ward-capacity-screen" data-ward-design="redesign-2026-10">
      <main id="main-content" className={styles.main}>
        <CapacityHero
          model={model}
          isPhone={isPhone}
          service={service}
          tvHref={tvOn && !executive ? bedMeetingTvHref({ service: tvServiceParam(service) }) : undefined}
          executive={executive}
          edWaiting={edWaiting}
          highlight={highlight}
          onHighlight={highlightFromHero}
          onSheet={() => setPopup({ kind: "sheet" })}
          onWard={openWard}
        />
        {isPhone ? (
          <>
            <Segmented
              label="Capacity view"
              className={styles.phoneTabs}
              items={[
                { id: "overview" as const, label: "Overview" },
                { id: "wards" as const, label: "Wards", count: mapModel.networkRows.length },
                { id: "planned" as const, label: "Planned", count: model.plannedBooked },
              ]}
              value={phoneTab}
              onChange={(tab) => startTransition(() => setPhoneTab(tab))}
            />
            {phoneTab === "overview" ? (
              <PhoneOverview
                model={model}
                executive={executive}
                onForecast={() => setPopup({ kind: "forecast" })}
                onWard={openWard}
              />
            ) : phoneTab === "wards" ? (
              bedMap
            ) : (
              planned
            )}
          </>
        ) : (
          <>
            <MismatchBand model={model} hideEmptyTypes={siteDesk} />
            <BedForecast
              model={model}
              onTryScenario={() => setPopup({ kind: "scenario" })}
              siteName={model.site?.name}
            />
            {bedMap}
            <div className={styles.lowerRow}>
              {executive ? planned : <ComingIn now={now} plannedBooked={model.plannedBooked} />}
              <RoadTimeCard
                rows={siteDesk ? [...model.networkRows, ...model.otherSiteRows] : model.networkRows}
                defaultEdId={model.roadTimeFromEdId}
                selectedUnitId={selectedRow?.unit.id}
                onSelectUnit={openWard}
              />
              <ShiftChecks model={model} onAskWard={askWard} siteName={model.site?.name} />
            </div>
            {/* Home v7 (Josh, 22 Oct 2026): State bedflow sits at the foot of Capacity, desktop only. No
                patient is chosen here, so it reads beds only: a ward can be picked out, never offered. */}
            <HomeBedflow
              units={units}
              movements={movements}
              bedReleases={bedReleases}
              leaveBeds={leaveBeds}
              admissions={admissions}
              now={now}
              selectedUnitId={bedflowUnitId}
              onSelectUnit={(unitId) => setBedflowUnitId((current) => (current === unitId ? undefined : unitId))}
              dischargesHeldUp={bedflowDischargesHeldUp}
              service={service}
            />
          </>
        )}
        <WardPrototypeFooter
          testId="ward-capacity-governance"
          note="Modelled network · CAHS wards not modelled · Not approved for clinical use"
        />
      </main>

      <ScenarioDialog open={popup?.kind === "scenario"} onClose={() => setPopup(null)} model={model.forecastModel} />
      {sheet ? <BedMeetingSheetDialog open onClose={() => setPopup(null)} sheet={sheet} now={now} /> : null}
      <Drawer
        open={selectedRow !== undefined}
        onClose={() => setPopup(null)}
        title={selectedRow?.unit.name ?? "Ward capacity"}
        ariaLabel={selectedRow ? `${selectedRow.unit.name}, ward capacity` : "Ward capacity"}
        description={selectedRow ? wardPlace(selectedRow.unit.siteCode) : undefined}
        titleAccessory={
          selectedRow ? (
            <span className={styles.wdHeadTag}>
              <StatusGlyph tone={selectedRow.ready > 0 ? "success" : "warning"} size={8} />
              {selectedRow.ready > 0 ? `${selectedRow.ready} ready` : "None ready"}
            </span>
          ) : undefined
        }
        testId="ward-capacity-ward-drawer"
      >
        {selectedRow ? (
          <CapacityWardSidebar row={selectedRow} onBack={() => setPopup(null)} now={now} showPlace={false} />
        ) : null}
      </Drawer>
      <Drawer
        open={popup?.kind === "forecast"}
        onClose={() => setPopup(null)}
        title="Bed forecast"
        mobileSize="viewport"
        testId="ward-capacity-forecast-sheet"
      >
        <BedForecast
          model={model}
          onTryScenario={() => setPopup({ kind: "scenario" })}
          stacked
          siteName={model.site?.name}
        />
      </Drawer>
    </div>
  );
}

/** The bed map's part of the model, narrowed to the chosen health service (null is all services). */
function scopeToService(model: CapacityModel, service: string | null): CapacityModel {
  if (service === null || model.site) return model;
  return {
    ...model,
    networkRows: model.networkRows.filter((row) => unitHealthService(row.unit) === service),
    mapGroups: model.mapGroups.filter((group) => group.service === service),
  };
}

/** "Royal Perth Hospital · East Metro": the ward drawer's line under its title. */
function wardPlace(siteCode: string): string {
  const site = siteByCode(siteCode);
  return `${siteLabel(siteCode, site?.name)} · ${site?.service ?? "Service not recorded"}`;
}

/** The design preview opens a pop-up on load; the app always opens on the page itself. */
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
