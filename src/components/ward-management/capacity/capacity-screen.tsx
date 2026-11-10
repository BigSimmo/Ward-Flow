"use client";

import { useWardFormSave } from "../use-ward-form-save";
import { wardScrollBehavior } from "../ward-scroll";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  Drawer,
  FolderTabs,
  folderTabClasses,
  PanelDrawer,
  Segmented,
  StatusPill,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { sheetPatientLabel } from "@/components/ward-management/ward-patient-resolver";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { tvServiceParam } from "@/components/ward-management/bed-meeting/tv-derivations";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type { BedRelease } from "@/components/ward-management/ward-model";

import { bedMeetingSheet } from "./bed-meeting-derivations";
import { BedForecast } from "./capacity-bed-forecast";
import { BedMapCards, BedMapHighlights, type Highlight } from "./capacity-bed-map-cards";
import { ComingIn } from "./capacity-coming-in";
import { CapacityHero } from "./capacity-hero";
import { useCapacityModel, type CapacityModel } from "./capacity-model";
import { OtherSitesCounts } from "./capacity-other-sites";
import { PhoneOverview } from "./capacity-phone-overview";
import { PlannedCounts } from "./capacity-planned-counts";
import { useSiteEdWaiting } from "./capacity-site-ed";
import { heldUpReleases } from "./capacity-held-up";
import { shiftConfirmations, unchangedConfirmations } from "./shift-confirmations";
import { useCapacityWardTabs } from "./capacity-ward-tabs";
import styles from "./capacity-page.module.css";

// Phone size limit (9 Nov 2026): the ward drawer's body and the two pop-ups load when first opened,
// not with the page. Each is drawn only while open, as the bed meeting sheet already was.
const ScenarioDialog = dynamic(() => import("./capacity-open-parts").then((m) => m.ScenarioDialog), {
  ssr: false,
});
const BedMeetingSheetDialog = dynamic(() => import("./capacity-open-parts").then((m) => m.BedMeetingSheetDialog), {
  ssr: false,
});
const CapacityWardFoot = dynamic(() => import("./capacity-open-parts").then((m) => m.CapacityWardFoot), {
  ssr: false,
});
const CapacityWardSidebar = dynamic(() => import("./capacity-open-parts").then((m) => m.CapacityWardSidebar), {
  ssr: false,
});

type Popup = { kind: "scenario" } | { kind: "sheet" } | { kind: "ward"; unitId: string } | { kind: "forecast" } | null;
type PageTab = "overview" | "wards" | "planned";

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
 * A chosen service narrows every ward-based panel: the bed map, nearest ready beds, This shift and
 * the phone's wards to check. The hero, mismatch, forecast and planned moves count people waiting or
 * booked across the network, so they stay whole-network and say "Network-wide" (scope audit, Josh,
 * 3 Nov 2026).
 */
export function CapacityScreen({ openOnLoad }: { openOnLoad?: string } = {}) {
  const model = useCapacityModel();
  const isPhone = useIsPhone();
  const access = useEffectiveWardAccess();
  const executive = access.role === "executive";
  const siteDesk = model.site !== undefined;
  const service = useServiceScope();
  const tvOn = useWardFeatureFlag("bed-meeting-tv");
  const [openPopup, setOpenPopup] = useState<{ popup: Popup; generation: number | null }>(() => ({
    popup: initialPopup(openOnLoad, model),
    generation: null,
  }));
  const [tab, setTab] = useState<PageTab>("overview");
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
  const edWaiting = useSiteEdWaiting(model.site, model.now);
  const { now } = model;

  const mapModel = useMemo<CapacityModel>(
    () => scopeToService(model, service, bedReleases),
    [model, service, bedReleases],
  );
  // A figure that does not follow the chosen service says so, quietly.
  const networkWide = service !== null && !siteDesk;
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
            // M103 (Josh, 10 Nov 2026): the printed sheet shows initials and UMRN only.
            nameOf: (movement) => sheetPatientLabel(patientOf(movement)),
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
  const wardTabs = useCapacityWardTabs(selectedRow?.unit.id);

  const refreshSave = useWardFormSave(`capacity-refresh:${worldGeneration}`);
  // Asking a ward to confirm its beds is the coordinator's step (REQUEST_CAPACITY_REFRESH), as in the
  // ward drawer. A site bed manager confirms on the ward's own page instead, and every other desk,
  // the executive included, changes nothing here.
  const askWard =
    access.role !== "coordinator" || siteDesk
      ? undefined
      : (unitId: string) => {
          const unit = units.find((candidate) => candidate.id === unitId);
          refreshSave.submit(
            () => dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId }),
            () => toast?.push({ tone: "success", title: `Asked ${unit?.name ?? "the ward"} to confirm its beds.` }),
          );
        };
  useEffect(() => {
    if (refreshSave.error) toast?.push({ tone: "warning", title: refreshSave.error });
  }, [refreshSave.error, toast]);
  const openWard = (unitId: string) => {
    if (siteDesk && !model.networkRows.some((row) => row.unit.id === unitId)) {
      setFocusUnitId(unitId);
      startTransition(() => setTab("wards"));
      window.setTimeout(
        () =>
          document
            .getElementById(`bm-other-${unitId}`)
            ?.scrollIntoView({ block: "center", behavior: wardScrollBehavior() }),
        50,
      );
      return;
    }
    setPopup({ kind: "ward", unitId });
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
        // Desktop: the highlights sit at the right of the page tabs (page tops, 9 Nov 2026).
        highlightsInCard={isPhone}
      />
      {siteDesk ? <OtherSitesCounts model={model} focusUnitId={focusUnitId} /> : null}
    </>
  );
  // The executive sees planned bookings as counts only: the list names each person.
  // Capacity issue 6 (Josh, 3 Nov 2026): every other desk gets Planned moves, on the phone too.
  const planned = executive ? (
    <PlannedCounts now={now} networkWide={networkWide} />
  ) : (
    <ComingIn
      key={worldGeneration}
      now={now}
      wardRows={[...model.networkRows, ...model.otherSiteRows]}
      networkWide={networkWide}
    />
  );

  return (
    <div className={styles.screen} data-testid="ward-capacity-screen" data-ward-design="redesign-2026-10">
      <main id="main-content" className={styles.main}>
        <CapacityHero
          model={model}
          isPhone={isPhone}
          service={service}
          executive={executive}
          edWaiting={edWaiting}
          networkWide={networkWide}
          hideEmptyTypes={siteDesk}
          tvHref={tvOn && !executive ? bedMeetingTvHref({ service: tvServiceParam(service) }) : undefined}
          onSheet={() => setPopup({ kind: "sheet" })}
          onForecast={() => setPopup({ kind: "forecast" })}
          onWard={openWard}
          onAskWard={askWard}
        />
        {/* Page tops (Josh, 9 Nov 2026): Overview, Wards and Planned on every size. The Mismatch card
            is gone: its gap by bed type is the hero's band, and each band cell opens its pop-up. */}
        <FolderTabs label="Capacity view" value={tab} testId="capacity-tabs" className={styles.pageTabs}>
          <Segmented
            label="Capacity view"
            size="md"
            className={folderTabClasses.switch}
            items={[
              { id: "overview" as const, label: "Overview" },
              { id: "wards" as const, label: "Wards", count: mapModel.networkRows.length },
              { id: "planned" as const, label: "Planned", count: model.plannedBooked },
            ]}
            value={tab}
            onChange={(next) => startTransition(() => setTab(next))}
          />
          {isPhone || tab === "planned" ? null : (
            <>
              <span className={folderTabClasses.rule} aria-hidden="true" />
              <BedMapHighlights
                className={folderTabClasses.filters}
                model={mapModel}
                highlight={highlight}
                onHighlight={setHighlight}
              />
            </>
          )}
        </FolderTabs>
        {tab === "wards" ? (
          bedMap
        ) : tab === "planned" ? (
          planned
        ) : isPhone ? (
          <PhoneOverview
            model={mapModel}
            networkWide={networkWide}
            executive={executive}
            onForecast={() => setPopup({ kind: "forecast" })}
            onWard={openWard}
            onAskWard={askWard}
          />
        ) : (
          <>
            {/* Capacity issue 2 (Josh, 3 Nov 2026): the bed map first, the forecast below it. Issue 7:
                State bedflow is gone; it repeated the bed map. */}
            {bedMap}
            <BedForecast
              model={model}
              onTryScenario={() => setPopup({ kind: "scenario" })}
              siteName={model.site?.name}
              onWard={openWard}
              onAskWard={askWard}
              networkWide={networkWide}
            />
            {/* Capacity issue 6 (Josh, 3 Nov 2026): Planned moves, booked admissions and step downs in
                one card, full width. Josh's fifth notes (8 Nov 2026): the row under it is gone; the
                shift figures are in the hero and an unchanged count on its ward card. */}
            {planned}
          </>
        )}
        <WardPrototypeFooter
          testId="ward-capacity-governance"
          note="Modelled network · CAHS wards not modelled · Not approved for clinical use"
        />
      </main>

      {popup?.kind === "scenario" ? (
        <ScenarioDialog open onClose={() => setPopup(null)} model={model.forecastModel} networkWide={networkWide} />
      ) : null}
      {sheet ? <BedMeetingSheetDialog open onClose={() => setPopup(null)} sheet={sheet} now={now} /> : null}
      <PanelDrawer
        open={selectedRow !== undefined}
        onClose={() => setPopup(null)}
        title={selectedRow?.unit.name ?? "Ward capacity"}
        subtitle={selectedRow ? wardPlace(selectedRow.unit.siteCode) : undefined}
        tag={
          selectedRow ? (
            <StatusPill tone={selectedRow.ready > 0 ? "success" : "warning"}>{selectedRow.ready} ready</StatusPill>
          ) : undefined
        }
        tabs={wardTabs.tabs}
        tab={wardTabs.tab}
        onTabChange={wardTabs.onTabChange}
        tabsLabel="Ward panel view"
        testId="ward-capacity-ward-drawer"
        foot={selectedRow ? <CapacityWardFoot row={selectedRow} now={now} /> : undefined}
      >
        {selectedRow ? (
          <CapacityWardSidebar
            row={selectedRow}
            onBack={() => setPopup(null)}
            now={now}
            tab={wardTabs.tab}
            showPlace={false}
            footInDrawer
            // C3 (Josh, 4 Nov 2026): the ward's own row of the forecast's days, the "By ward" view's row.
            week={{
              days: model.days,
              row: model.week.rows.find((weekRow) => weekRow.unitId === selectedRow.unit.id),
            }}
          />
        ) : null}
      </PanelDrawer>
      <Drawer
        open={popup?.kind === "forecast"}
        onClose={() => setPopup(null)}
        title="Bed forecast"
        description={networkWide ? "Network-wide" : undefined}
        mobileSize="viewport"
        testId="ward-capacity-forecast-sheet"
      >
        <BedForecast
          model={model}
          onTryScenario={() => setPopup({ kind: "scenario" })}
          stacked
          siteName={model.site?.name}
          onWard={openWard}
          onAskWard={askWard}
        />
      </Drawer>
    </div>
  );
}

/**
 * The ward-based part of the model, narrowed to the chosen health service (null is all services):
 * the bed map, nearest ready beds, wards to check and This shift. Waiting people and the forecast
 * are not narrowed; the panels showing them say "Network-wide".
 */
function scopeToService(
  model: CapacityModel,
  service: string | null,
  bedReleases: readonly BedRelease[],
): CapacityModel {
  if (service === null || model.site) return model;
  const networkRows = model.networkRows.filter((row) => unitHealthService(row.unit) === service);
  const units = networkRows.map((row) => row.unit);
  const ids = new Set(units.map((unit) => unit.id));
  return {
    ...model,
    networkRows,
    mapGroups: model.mapGroups.filter((group) => group.service === service),
    wardsToCheck: model.wardsToCheck.filter((row) => ids.has(row.unit.id)),
    confirmations: shiftConfirmations(units, model.now),
    unchanged: unchangedConfirmations(units),
    heldUp: heldUpReleases(
      bedReleases.filter((release) => ids.has(release.unitId)),
      model.now,
    ),
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
