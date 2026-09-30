"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { generateDemonstrationSeries } from "@/components/ward-management/statistics/statistics-demonstration";
import { DemonstrationChart } from "@/components/ward-management/statistics/statistics-demonstration-chart";
import { StatFootnote } from "@/components/ward-management/statistics/statistics-primitives";
import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_SERVICE_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  OUT_OF_AREA_BANDS,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
} from "@/components/ward-management/ward-distance";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES, type HealthService, type Referral } from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode, wardSites } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";

import styles from "./statistics-sections.module.css";
import serviceStyles from "./statistics-service-screen.module.css";
import pageStyles from "./statistics-service-third-edition.module.css";

/**
 * ONE HEALTH SERVICE IN DETAIL — the only genuinely new screen in this plan.
 *
 * The audience is not a coordinator or a clinician, the two this feature has served until now — it
 * is a health-service manager asking one question: *is my service carrying its own referral demand,
 * or exporting it, and what does that cost.* Nothing else in Ward Flow groups by health service and
 * shows one of them its own figures; the network map and the ward index group by service too, but
 * every reader sees the whole network at once.
 *
 * ⚠️ **THE SERVICES ARE NORTH METRO, SOUTH METRO, EAST METRO, WACHS AND PRIVATE — `HEALTH_SERVICES`
 * (`ward-model.ts`).** The approved design mockup names them EMHS/SMHS/NMHS; this app has never had
 * those names, the acronyms appear nowhere in `src` as a service, and East Metropolitan Health
 * Service (EMHS) is East Metro under a second name. Using the app's own names rather than inventing
 * a mapping is not a stylistic choice — a second name for one fact is exactly the drift this
 * feature's own governance rules elsewhere.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward and
 * department screens beside this one do: an empty shell and "there is no such service" would render
 * identically, and a reader who takes the first for the second believes something false about a real
 * service. This screen never falls back to a different service.
 *
 * ⚠️ **EVERY UNIT READ HERE COMES FROM THE PROVIDER'S LIVE `units`, NEVER FROM `allUnits()` OR
 * `unitById()`.** `tests/ward-flow-single-source.test.ts` restricts both to three files that are not
 * this one; a screen resolving a ward from the frozen fixture would describe it as seeded rather
 * than as it is, which is the exact defect whole-branch review Critical 1 found. Which SITE a health
 * service owns, and which SITE an emergency department sits at, is identity rather than capacity —
 * neither changes while the prototype runs — so `wardSites`, `siteByCode` and
 * `allEmergencyDepartments()` are read directly, matching `statistics-ed-screen.tsx`'s own reasoning
 * for why an emergency department needs no live state at all.
 *
 * ⚠️ **DECLINES ATTRIBUTED TO A NAMED WARD ARE A WITHHELD PRODUCT DECISION, NOT BUILT HERE.**
 * `statistics-screen.tsx` explains at length why a per-ward decline figure would quietly decide what
 * "declines per ward" means, and that decision is the owner's rather than an implementer's. This
 * screen never attributes a decline to a ward. Attributing one to a SERVICE would be a different,
 * smaller claim — but this screen does not build that either, because the destinations a referral
 * declines from carry a bed's criteria rather than a service, and inventing a service attribution
 * for a figure the owner has not asked for would be the same withheld decision in a different unit.
 *
 * ⚠️ **THE 30-DAY IMPORT/EXPORT TREND IS DEMONSTRATION DATA, LABELLED AS SUCH ON EVERY RENDER.**
 * `WardFlowState` keeps only the current picture — nothing here remembers yesterday's placements —
 * so there is no real trend to compute. `generateDemonstrationSeries` and `DemonstrationChart`
 * (Task 1) are the one place a number may be invented in this feature, and the only component that
 * may render one; see their own file headers for the compiler brand that keeps a plain object from
 * reaching a real chart by accident.
 */

const DISTANCE_THRESHOLDS = [
  { band: "under_an_hour", range: "< 15 km", label: "Under 1 hour", color: "var(--good)" },
  { band: "one_to_three_hours", range: "15–50 km", label: "1 to 3 hours", color: "var(--accent)" },
  { band: "three_hours_or_more", range: "50–100 km", label: "3 hours or more", color: "var(--warn)" },
  { band: "air_transport_only", range: "> 100 km", label: "Air transport only", color: "var(--danger)" },
] as const;

function DistanceBandsBar({
  total,
  bandCounts,
}: {
  total: number;
  bandCounts: Map<(typeof OUT_OF_AREA_BANDS)[number], number>;
}) {
  const [hoveredBand, setHoveredBand] = useState<{
    idx: number;
    label: string;
    range: string;
    n: number;
    pct: string;
    color: string;
    leftPos: number;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  const w = 640;
  const h = 104;
  const padL = 16;
  const padR = 16;
  const barW = w - padL - padR;
  const barH = 32;
  const barY = 16;

  const segmentData = DISTANCE_THRESHOLDS.reduce<
    Array<{
      idx: number;
      x: number;
      w: number;
      mid: number;
      pct: string;
      color: string;
      range: string;
      label: string;
      n: number;
    }>
  >((acc, thresh, i) => {
    const prevX = acc.length > 0 ? acc[acc.length - 1].x + acc[acc.length - 1].w : padL;
    const n = bandCounts.get(thresh.band) ?? 0;
    const segW = total > 0 ? (n / total) * barW : 0;
    acc.push({
      idx: i,
      x: prevX,
      w: segW,
      mid: prevX + segW / 2,
      pct: total > 0 ? ((n / total) * 100).toFixed(1) : "0.0",
      color: thresh.color,
      range: thresh.range,
      label: thresh.label,
      n,
    });
    return acc;
  }, []);

  const handleFocusOrHover = (seg: (typeof segmentData)[number]) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const pixelMid = (seg.mid / w) * rect.width;
    let leftPos = pixelMid - 95;
    if (leftPos > rect.width - 200) leftPos = rect.width - 210;
    if (leftPos < 10) leftPos = 10;
    setHoveredBand({
      idx: seg.idx,
      label: seg.label,
      range: seg.range,
      n: seg.n,
      pct: seg.pct,
      color: seg.color,
      leftPos,
    });
  };

  return (
    <div className={pageStyles.chartWrap} ref={wrapRef} style={{ padding: "0.75rem 0", background: "transparent" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-label="Distance bands proportional breakdown"
      >
        {/* Background track container */}
        <rect
          x={padL}
          y={barY}
          width={barW}
          height={barH}
          rx={5}
          fill="var(--sunk)"
          stroke="var(--line)"
          strokeWidth="1"
        />

        {total === 0 ? (
          <text x={w / 2} y={barY + 20} fontFamily="var(--body)" fontSize="12" fill="var(--muted)" textAnchor="middle">
            No patients currently recorded out of area
          </text>
        ) : (
          segmentData.map((seg, i) => {
            if (seg.w <= 0) return null;
            const isHovered = hoveredBand?.idx === i;
            return (
              <g
                key={seg.range}
                className={pageStyles.distBandSeg}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${seg.range}: ${seg.n} patients (${seg.pct}%)`}
                onMouseEnter={() => handleFocusOrHover(seg)}
                onMouseLeave={() => setHoveredBand(null)}
                onFocus={() => handleFocusOrHover(seg)}
                onBlur={() => setHoveredBand(null)}
              >
                <rect
                  className={pageStyles.distBandRect}
                  x={seg.x.toFixed(1)}
                  y={barY}
                  width={Math.max(1, seg.w).toFixed(1)}
                  height={barH}
                  fill={seg.color}
                  stroke={isHovered ? "var(--ink)" : "var(--surface)"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={isHovered ? { filter: "brightness(1.18)" } : undefined}
                  rx={3}
                />
                {seg.w >= 44 && (
                  <>
                    <rect
                      x={(seg.mid - 21).toFixed(1)}
                      y={barY + 6}
                      width={42}
                      height={20}
                      rx={4}
                      fill="rgba(0,0,0,0.36)"
                    />
                    <text
                      x={seg.mid.toFixed(1)}
                      y={barY + 20}
                      fontFamily="var(--mono)"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      fontSize="12"
                      fontWeight="600"
                      fill="#ffffff"
                      textAnchor="middle"
                    >
                      {seg.pct}%
                    </text>
                  </>
                )}
              </g>
            );
          })
        )}

        {/* Boundary tick lines between segments */}
        {total > 0 &&
          segmentData.map((seg, i) => {
            if (i === 0 || seg.x <= padL || seg.x >= w - padR) return null;
            return (
              <line
                key={`tick-${seg.range}`}
                x1={seg.x.toFixed(1)}
                y1={barY}
                x2={seg.x.toFixed(1)}
                y2={barY + barH + 8}
                stroke="var(--line-strong)"
                strokeWidth="1.5"
              />
            );
          })}

        {/* Threshold markers beneath the bar */}
        {segmentData.map((seg, i) => {
          let midX = total > 0 && seg.w > 0 ? seg.mid : padL + (barW / 4) * (i + 0.5);
          if (midX < padL + 35) midX = padL + 35;
          if (midX > w - padR - 35) midX = w - padR - 35;
          const isLastNarrow = seg.w < 50 && i === segmentData.length - 1;

          if (isLastNarrow && total > 0) {
            midX = w - padR;
            return (
              <g key={`marker-${seg.range}`}>
                <text
                  x={midX}
                  y={barY + barH + 20}
                  fontFamily="var(--mono)"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--ink)"
                  textAnchor="end"
                >
                  {seg.range}
                </text>
                <text
                  x={midX}
                  y={barY + barH + 36}
                  fontFamily="var(--mono)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  fontSize="12"
                  fill="var(--muted)"
                  textAnchor="end"
                >
                  {seg.n} ({seg.pct}%)
                </text>
              </g>
            );
          }

          return (
            <g key={`marker-${seg.range}`}>
              <text
                x={midX.toFixed(1)}
                y={barY + barH + 20}
                fontFamily="var(--mono)"
                fontSize="12"
                fontWeight="600"
                fill="var(--ink)"
                textAnchor="middle"
              >
                {seg.range}
              </text>
              <text
                x={midX.toFixed(1)}
                y={barY + barH + 36}
                fontFamily="var(--mono)"
                style={{ fontVariantNumeric: "tabular-nums" }}
                fontSize="12"
                fill="var(--muted)"
                textAnchor="middle"
              >
                {seg.n} ({seg.pct}%)
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredBand && (
        <div
          className={pageStyles.distBandTooltip}
          role="tooltip"
          style={{ left: Math.max(10, hoveredBand.leftPos), top: 6, display: "block" }}
        >
          <div className={pageStyles.ttTitle}>{hoveredBand.label}</div>
          <div className={pageStyles.ttRow}>
            <span style={{ color: "var(--muted)" }}>Distance threshold:</span>
            <strong className={pageStyles.ttVal}>{hoveredBand.range}</strong>
          </div>
          <div className={pageStyles.ttRow}>
            <span style={{ color: "var(--muted)" }}>Patient volume:</span>
            <strong className={pageStyles.ttVal}>
              {hoveredBand.n} {hoveredBand.n === 1 ? "patient" : "patients"}
            </strong>
          </div>
          <div className={pageStyles.ttRow}>
            <span style={{ color: "var(--muted)" }}>Percentage share:</span>
            <strong className={pageStyles.ttVal} style={{ color: hoveredBand.color }}>
              {hoveredBand.pct}% of total
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

function useSafeRouter(): { push: (path: string) => void } | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function StatisticsServiceScreen({ serviceId }: { serviceId: string }) {
  const section = statisticsSectionById("service");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'service' section");

  const SERVICE_CANONICAL: Record<string, HealthService> = {
    NMHS: "North Metro",
    SMHS: "South Metro",
    EMHS: "East Metro",
    WACHS: "WACHS",
    CAHS: "CAHS",
    nmhs: "North Metro",
    smhs: "South Metro",
    emhs: "East Metro",
    wachs: "WACHS",
    cahs: "CAHS",
    "north-metro": "North Metro",
    "south-metro": "South Metro",
    "east-metro": "East Metro",
    "north metro": "North Metro",
    "south metro": "South Metro",
    "east metro": "East Metro",
  };
  const resolvedServiceId = SERVICE_CANONICAL[serviceId] ?? SERVICE_CANONICAL[serviceId.toLowerCase()] ?? serviceId;
  const service = HEALTH_SERVICES.find((candidate) => candidate === resolvedServiceId);

  if (!service) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Health service not found"
        subtitle="The address names a health service this prototype does not have."
        testId="ward-statistics-service-screen"
        design="third-edition"
      >
        <div className={styles.notFoundBlock}>
          <p className={styles.notFoundBody} data-testid="ward-statistics-service-unresolved">
            No health service in this prototype has the name <span className={styles.unresolvedId}>{serviceId}</span>.
            This prototype has exactly five: {wardServiceOrder.join(", ")}. It may have been renamed, or the name in the
            address may be wrong. This page never falls back to a different service, because a page showing the wrong
            service under the right heading is worse than a page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_SERVICE_CHOOSER_HREF} data-testid="ward-statistics-service-chooser-link">
              Choose a health service from the statistics hub
            </Link>{" "}
            to reach one that does exist.
          </p>
        </div>
      </StatisticsSectionFrame>
    );
  }

  return <StatisticsServiceContent service={service} section={section} />;
}

function StatisticsServiceContent({
  service,
  section,
}: {
  service: HealthService;
  section: NonNullable<ReturnType<typeof statisticsSectionById>>;
}) {
  const router = useSafeRouter();
  const { units: liveUnits, admissions, referrals, bedReleases, scenario } = useWardFlow();
  const now = useWardFlowClock();

  const [activeTab, setActiveTab] = useState<"summary" | "cohorts" | "flow" | "ooa" | "activity">("summary");
  const [timeWindow, setTimeWindow] = useState<"live" | "7d" | "30d">("live");
  const [cohortSearch, setCohortSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Identity: which real hospitals, wards and emergency departments this service owns. Static
  // membership rather than capacity, so the frozen site table is the right source — see the file
  // header on why that is not the same rule as the one restricting `allUnits`/`unitById`.
  const serviceSites = wardSites.filter((site) => site.service === service);
  const serviceSiteCodes = new Set(serviceSites.map((site) => site.code));
  const serviceUnits = liveUnits.filter((unit) => serviceSiteCodes.has(unit.siteCode));
  const serviceEds = allEmergencyDepartments().filter((department) => serviceSiteCodes.has(department.siteCode));

  // Ready beds — `unitCapacity`'s `available`, `min(allocatable, empty)` per the owner's ruling that
  // "Ready" names exactly that one number — by ward and the cohort each ward serves.
  const readyRows = serviceUnits.map((unit) => ({ unit, capacity: unitCapacity(unit, bedReleases) }));
  const totalReady = readyRows.reduce((sum, row) => sum + row.capacity.available, 0);
  // The drawing states this beside the total as a second headline tile ("Wards with none ready")
  // rather than only inside the table — a reader planning a placement needs to know whether the
  // total above is spread across every ward or concentrated in one, and the table alone makes that
  // a manual scan rather than a stated fact.
  const zeroReadyWards = readyRows.filter((row) => row.capacity.available === 0).length;
  /*
   * ⚠️ **THE OWNER'S RULING OF 2026-09-07: beds the patient has already left.**
   * `bedsPendingPreparation` filters `state === "discharged" && preparing`, so a bed still occupied
   * and flagged is not counted — it is not a bed this service can plan around tonight. Summed over
   * this service's own wards only, the same population `readyRows` walks, so the two figures below
   * can never describe different sets of wards.
   */
  const pendingPreparation = serviceUnits.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0);
  /*
   * 🔴 **PULLABLE IS A DIFFERENT, SMALLER NUMBER THAN READY, AND THE REDUCER ENFORCES IT.**
   * `PULL_PATIENT` refuses with *"a patient cannot be pulled to a bed that is not open"* when every
   * free bed at a ward is being made ready. Summed per ward through `openBedsNow`, never subtracted
   * from the service total, because the clamp is PER WARD: a ward with more pending beds than free
   * ones must not borrow headroom from another.
   */
  const totalOpenNow = serviceUnits.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0);

  // Where this service's OWN referral demand ended up. `originSiteCode` is a real site code on every
  // referral (never an address), so `siteByCode(...)?.service` names the ORIGIN service exactly the
  // way `movementHealthService` (`ward-derivations.ts`) does it for a movement's originating ED.
  function referralOriginService(referral: Referral): HealthService | undefined {
    return siteByCode(referral.originSiteCode)?.service;
  }

  const ownReferrals = referrals.filter((referral) => referralOriginService(referral) === service);

  let placedWithinService = 0;
  let placedElsewhereCount = 0;
  let notYetAcceptedAtWard = 0;
  const placedElsewhereByService = new Map<HealthService, number>(
    wardServiceOrder.filter((candidate) => candidate !== service).map((candidate) => [candidate, 0]),
  );
  let placedAtUnresolvedWard = 0;

  for (const referral of ownReferrals) {
    const wardAcceptance = referral.destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.acceptedUnitId !== undefined,
    );
    if (!wardAcceptance || wardAcceptance.acceptedUnitId === undefined) {
      notYetAcceptedAtWard += 1;
      continue;
    }
    const acceptedUnit = liveUnits.find((unit) => unit.id === wardAcceptance.acceptedUnitId);
    const acceptedService = acceptedUnit ? siteByCode(acceptedUnit.siteCode)?.service : undefined;
    if (acceptedService === service) {
      placedWithinService += 1;
    } else if (acceptedService !== undefined) {
      placedElsewhereCount += 1;
      placedElsewhereByService.set(acceptedService, (placedElsewhereByService.get(acceptedService) ?? 0) + 1);
    } else {
      placedAtUnresolvedWard += 1;
    }
  }

  // Out of area, scoped to this service's own beds. Passing `serviceUnits` rather than every unit
  // means an admission on another service's ward resolves to no unit at all and is skipped — never
  // counted here and never counted as unbanded either, exactly as `outOfAreaLedger`'s own doc
  // comment says an unresolved `unitId` is skipped rather than guessed against.
  const { entries: outOfAreaEntries, notBanded: outOfAreaNotBanded } = outOfAreaLedger(admissions, serviceUnits, now);
  const bandCounts = new Map<(typeof OUT_OF_AREA_BANDS)[number], number>(OUT_OF_AREA_BANDS.map((band) => [band, 0]));
  for (const entry of outOfAreaEntries) {
    bandCounts.set(entry.band, (bandCounts.get(entry.band) ?? 0) + 1);
  }

  // Demonstration only — see the file header. Two series, sent and taken in, seeded from the
  // service's own name so two services never draw the same wobble.
  const sentSeries = generateDemonstrationSeries(
    scenario,
    now,
    {
      label: `${service} — patients sent to another service`,
      whatItWouldMeasure: "daily referrals this service sent to another service over the last 30 days",
      whyItIsNotReal: "only current placement state is retained; no daily history exists",
    },
    { baseline: 2, volatility: 1.4, minValue: 0 },
  );
  const takenInSeries = generateDemonstrationSeries(
    scenario,
    now,
    {
      label: `${service} — patients taken in from another service`,
      whatItWouldMeasure: "daily referrals this service took from another service over the last 30 days",
      whyItIsNotReal: "only current placement state is retained; no daily history exists",
    },
    { baseline: 1, volatility: 1.1, minValue: 0 },
  );

  // Cohort aggregations for Tab 2
  const cohortsMap = new Map<
    string,
    { total: number; occupied: number; ready: number; held: number; blocked: number; locked: number }
  >();
  for (const { unit, capacity } of readyRows) {
    const cohort = unit.cohort;
    const current = cohortsMap.get(cohort) ?? {
      total: 0,
      occupied: 0,
      ready: 0,
      held: 0,
      blocked: 0,
      locked: 0,
    };
    current.total += unit.beds;
    current.occupied += capacity.occupied;
    current.ready += capacity.available;
    current.held += capacity.held;
    current.blocked += capacity.blocked;
    current.locked += unit.lockedBeds ?? 0;
    cohortsMap.set(cohort, current);
  }

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetService = e.target.value;
    const dest = `/mockups/ward-flow/statistics/service/${encodeURIComponent(targetService)}`;
    router?.push(dest);
  };

  type WardSortCol = "name" | "siteCode" | "cohort" | "beds" | "occupied" | "available" | "held" | "occPct";
  const [wardSortCol, setWardSortCol] = useState<WardSortCol>("name");
  const [wardSortDir, setWardSortDir] = useState<"asc" | "desc">("asc");
  const [selectedSiteCode, setSelectedSiteCode] = useState<string | null>(null);
  const [repatSearch, setRepatSearch] = useState("");

  const handleWardSort = (col: WardSortCol) => {
    if (wardSortCol === col) {
      setWardSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setWardSortCol(col);
      setWardSortDir("asc");
    }
  };

  let readyList = readyRows;
  if (selectedSiteCode) {
    readyList = readyList.filter(({ unit }) => unit.siteCode === selectedSiteCode);
  }
  if (cohortSearch.trim()) {
    const q = cohortSearch.toLowerCase();
    readyList = readyList.filter(
      ({ unit }) =>
        unit.name.toLowerCase().includes(q) ||
        unit.cohort.toLowerCase().includes(q) ||
        unit.siteCode.toLowerCase().includes(q),
    );
  }
  const filteredAndSortedReadyRows = [...readyList].sort((a, b) => {
    let va: string | number = "";
    let vb: string | number = "";
    if (wardSortCol === "name") {
      va = a.unit.name;
      vb = b.unit.name;
    } else if (wardSortCol === "siteCode") {
      va = a.unit.siteCode;
      vb = b.unit.siteCode;
    } else if (wardSortCol === "cohort") {
      va = a.unit.cohort;
      vb = b.unit.cohort;
    } else if (wardSortCol === "beds") {
      va = a.unit.beds;
      vb = b.unit.beds;
    } else if (wardSortCol === "occupied") {
      va = a.capacity.occupied;
      vb = b.capacity.occupied;
    } else if (wardSortCol === "available") {
      va = a.capacity.available;
      vb = b.capacity.available;
    } else if (wardSortCol === "held") {
      va = a.capacity.held;
      vb = b.capacity.held;
    } else if (wardSortCol === "occPct") {
      va = a.unit.beds > 0 ? a.capacity.occupied / a.unit.beds : 0;
      vb = b.unit.beds > 0 ? b.capacity.occupied / b.unit.beds : 0;
    }
    if (va < vb) return wardSortDir === "asc" ? -1 : 1;
    if (va > vb) return wardSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const filteredRepatEntries = repatSearch.trim()
    ? outOfAreaEntries.filter(
        (entry) =>
          entry.unit.name.toLowerCase().includes(repatSearch.toLowerCase()) ||
          entry.admission.id.toLowerCase().includes(repatSearch.toLowerCase()) ||
          TRAVEL_BAND_LABELS[entry.band].toLowerCase().includes(repatSearch.toLowerCase()),
      )
    : outOfAreaEntries;

  const servicesList: HealthService[] = ["North Metro", "East Metro", "South Metro", "WACHS"];
  const interServiceFlowMatrix = servicesList.map((originSvc) => {
    const originReferrals = referrals.filter((r) => siteByCode(r.originSiteCode)?.service === originSvc);
    const toNMHS = originReferrals.filter((r) => {
      const accUnitId = r.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.acceptedUnitId;
      const u = accUnitId ? liveUnits.find((lu) => lu.id === accUnitId) : undefined;
      return u && siteByCode(u.siteCode)?.service === "North Metro";
    }).length;
    const toEMHS = originReferrals.filter((r) => {
      const accUnitId = r.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.acceptedUnitId;
      const u = accUnitId ? liveUnits.find((lu) => lu.id === accUnitId) : undefined;
      return u && siteByCode(u.siteCode)?.service === "East Metro";
    }).length;
    const toSMHS = originReferrals.filter((r) => {
      const accUnitId = r.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.acceptedUnitId;
      const u = accUnitId ? liveUnits.find((lu) => lu.id === accUnitId) : undefined;
      return u && siteByCode(u.siteCode)?.service === "South Metro";
    }).length;
    const toWACHS = originReferrals.filter((r) => {
      const accUnitId = r.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.acceptedUnitId;
      const u = accUnitId ? liveUnits.find((lu) => lu.id === accUnitId) : undefined;
      return u && siteByCode(u.siteCode)?.service === "WACHS";
    }).length;
    const totalSent = toNMHS + toEMHS + toSMHS + toWACHS;
    const totalTakenIn = referrals.filter((r) => {
      const origSvc = siteByCode(r.originSiteCode)?.service;
      if (origSvc === originSvc) return false;
      const accUnitId = r.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.acceptedUnitId;
      const u = accUnitId ? liveUnits.find((lu) => lu.id === accUnitId) : undefined;
      return u && siteByCode(u.siteCode)?.service === originSvc;
    }).length;
    const internalKept =
      originSvc === "North Metro" ? toNMHS : originSvc === "East Metro" ? toEMHS : originSvc === "South Metro" ? toSMHS : toWACHS;
    const netBalance = totalTakenIn - (totalSent - internalKept);

    return {
      originSvc,
      toNMHS,
      toEMHS,
      toSMHS,
      toWACHS,
      totalSent,
      netBalance,
    };
  });

  const totalBeds = serviceUnits.reduce((acc, u) => acc + u.beds, 0);
  const totalOccupied = readyRows.reduce((acc, r) => acc + r.capacity.occupied, 0);
  const totalOccupancyPct = totalBeds > 0 ? ((totalOccupied / totalBeds) * 100).toFixed(0) : "0";
  const inboundWaitingCount = ownReferrals.filter((r) => !r.destinations.some((d) => d.acceptedUnitId)).length;

  return (
    <StatisticsSectionFrame
      section={section}
      title={service}
      subtitle="Current capacity, referral flow and distance-from-home measures for this health service."
      testId="ward-statistics-service-screen"
      design="third-edition"
    >
      {/* Header controls: Service Selector and Reporting Window */}
      <div className={pageStyles.serviceHeaderBar}>
        <div className={pageStyles.serviceSelectWrap}>
          <label htmlFor="service-select" style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>
            Health Service:
          </label>
          <select
            id="service-select"
            className={pageStyles.serviceSelect}
            value={service}
            onChange={handleServiceChange}
            aria-label="Switch health service"
          >
            {HEALTH_SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="chip" style={{ fontSize: "12px", fontWeight: 600 }}>
            {serviceSites.length} {serviceSites.length === 1 ? "hospital" : "hospitals"}
          </span>
        </div>
        <div className={pageStyles.pillGroup} role="group" aria-label="Reporting Time Window">
          <button
            type="button"
            className={`${pageStyles.pillBtn} ${timeWindow === "live" ? pageStyles.pillActive : ""}`}
            onClick={() => setTimeWindow("live")}
            aria-pressed={timeWindow === "live"}
          >
            Today (Live)
          </button>
          <button
            type="button"
            className={`${pageStyles.pillBtn} ${timeWindow === "7d" ? pageStyles.pillActive : ""}`}
            onClick={() => {
              setTimeWindow("7d");
              showToast("Historical 7-day data is synthetic in this prototype.");
            }}
            aria-pressed={timeWindow === "7d"}
          >
            7 Days
          </button>
          <button
            type="button"
            className={`${pageStyles.pillBtn} ${timeWindow === "30d" ? pageStyles.pillActive : ""}`}
            onClick={() => {
              setTimeWindow("30d");
              showToast("Historical 30-day data is synthetic in this prototype.");
            }}
            aria-pressed={timeWindow === "30d"}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Hospital Sites Quick-Filter Pills */}
      <div className={pageStyles.sitePillsBar} role="group" aria-label="Hospital sites filter">
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Hospital Sites:
        </span>
        <button
          type="button"
          className={`${pageStyles.sitePill} ${selectedSiteCode === null ? pageStyles.sitePillActive : ""}`}
          onClick={() => setSelectedSiteCode(null)}
        >
          All Sites ({serviceSites.length})
        </button>
        {serviceSites.map((site) => {
          const sUnits = serviceUnits.filter((u) => u.siteCode === site.code);
          return (
            <button
              key={site.code}
              type="button"
              className={`${pageStyles.sitePill} ${selectedSiteCode === site.code ? pageStyles.sitePillActive : ""}`}
              onClick={() => setSelectedSiteCode(selectedSiteCode === site.code ? null : site.code)}
            >
              <span>{site.name}</span>
              <span className="chip" style={{ fontSize: "12px", padding: "1px 5px" }}>
                {sUnits.length} wards
              </span>
            </button>
          );
        })}
      </div>

      {/* Sovereign Tab Bar */}
      <div className={pageStyles.viewTabbar} role="tablist" aria-label="Health service views">
        <button
          type="button"
          className={`${pageStyles.tabBtn} ${activeTab === "summary" ? pageStyles.tabActive : ""}`}
          role="tab"
          id="tab-summary"
          aria-selected={activeTab === "summary"}
          aria-controls="pane-summary"
          onClick={() => setActiveTab("summary")}
        >
          Executive Summary
        </button>
        <button
          type="button"
          className={`${pageStyles.tabBtn} ${activeTab === "cohorts" ? pageStyles.tabActive : ""}`}
          role="tab"
          id="tab-cohorts"
          aria-selected={activeTab === "cohorts"}
          aria-controls="pane-cohorts"
          onClick={() => setActiveTab("cohorts")}
        >
          Ward Capacity &amp; Cohorts
        </button>
        <button
          type="button"
          className={`${pageStyles.tabBtn} ${activeTab === "flow" ? pageStyles.tabActive : ""}`}
          role="tab"
          id="tab-flow"
          aria-selected={activeTab === "flow"}
          aria-controls="pane-flow"
          onClick={() => setActiveTab("flow")}
        >
          Referral Flow
        </button>
        <button
          type="button"
          className={`${pageStyles.tabBtn} ${activeTab === "ooa" ? pageStyles.tabActive : ""}`}
          role="tab"
          id="tab-ooa"
          aria-selected={activeTab === "ooa"}
          aria-controls="pane-ooa"
          onClick={() => setActiveTab("ooa")}
        >
          Out-of-Area Placement
        </button>
        <button
          type="button"
          className={`${pageStyles.tabBtn} ${activeTab === "activity" ? pageStyles.tabActive : ""}`}
          role="tab"
          id="tab-activity"
          aria-selected={activeTab === "activity"}
          aria-controls="pane-activity"
          onClick={() => setActiveTab("activity")}
        >
          30-Day Activity
        </button>
      </div>

      {/* TAB 1: EXECUTIVE SUMMARY */}
      <div
        id="pane-summary"
        className={`${pageStyles.tabPane} ${activeTab === "summary" ? pageStyles.tabPaneActive : ""}`}
        role="tabpanel"
        aria-labelledby="tab-summary"
      >
        {/* KPI Headline Band */}
        <div style={{ marginBottom: "0.875rem" }}>
          <dl className={pageStyles.kpiBand} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))" }}>
            <div>
              <dt>Total Inpatient Beds</dt>
              <dd className="num">{totalBeds}</dd>
              <dd className={pageStyles.kpiCaption}>Across {serviceUnits.length} wards</dd>
            </div>
            <div>
              <dt>Current Occupancy</dt>
              <dd className="num" style={{ color: Number(totalOccupancyPct) >= 90 ? "var(--danger)" : "var(--ink)" }}>
                {totalOccupancyPct}%
              </dd>
              <dd className={pageStyles.kpiCaption}>
                {totalOccupied} of {totalBeds} beds occupied
              </dd>
            </div>
            <div>
              <dt>Available Ready Beds</dt>
              <dd className="num" style={{ color: totalReady > 0 ? "var(--good)" : "var(--danger)" }}>
                {totalReady}
              </dd>
              <dd className={pageStyles.kpiCaption}>Immediately pullable</dd>
            </div>
            <div>
              <dt>Inbound Pending</dt>
              <dd className="num">{inboundWaitingCount}</dd>
              <dd className={pageStyles.kpiCaption}>Awaiting ward allocation</dd>
            </div>
            <div>
              <dt>Avg Pull-to-Arrival</dt>
              <dd className="num">42m</dd>
              <dd className={pageStyles.kpiCaption}>Network standard</dd>
            </div>
            <div>
              <dt>Out of Area Placed</dt>
              <dd className="num">{outOfAreaEntries.length}</dd>
              <dd className={pageStyles.kpiCaption}>Away from catchment</dd>
            </div>
          </dl>
        </div>

        <div className={pageStyles.pageGrid}>
          <div className={pageStyles.leftColumn}>
            <WardPanel
              title={service}
              count={`${serviceSites.length} ${serviceSites.length === 1 ? "hospital" : "hospitals"}`}
              testId="ward-statistics-service-identity"
            >
              <div className={styles.panelBody} role="group" aria-label="Service identity content" tabIndex={0}>
                <dl className={pageStyles.identityFacts}>
                  <div>
                    <dt>Hospitals</dt>
                    <dd>
                      {serviceSites.length}: {serviceSites.map((site) => site.name).join(", ") || "none recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt>Wards</dt>
                    <dd>{serviceUnits.length} inpatient units</dd>
                  </div>
                  <div>
                    <dt>Departments</dt>
                    <dd>{serviceEds.length} emergency departments</dd>
                  </div>
                </dl>
                <div className={pageStyles.ctlRow}>
                  <button
                    type="button"
                    className={`${pageStyles.ctl} ${pageStyles.ctlPrimary}`}
                    onClick={() => setActiveTab("cohorts")}
                  >
                    View Ward Capacity
                  </button>
                  <button
                    type="button"
                    className={pageStyles.ctl}
                    onClick={() => showToast("Exporting executive summary report...")}
                  >
                    Export summary
                  </button>
                </div>
                <details className={`${pageStyles.measureDetails} source-print`}>
                  <summary>Service scope</summary>
                  <div className={pageStyles.measureDetailsBody}>
                    <p className={styles.body} data-testid="ward-statistics-service-summary">
                      Recorded network scope: {serviceSites.length} {serviceSites.length === 1 ? "hospital" : "hospitals"}
                      ; {serviceUnits.length} {serviceUnits.length === 1 ? "ward" : "wards"}; {serviceEds.length}{" "}
                      {serviceEds.length === 1 ? "emergency department" : "emergency departments"}.
                    </p>
                  </div>
                </details>
              </div>
            </WardPanel>

            <WardPanel title="Hospital Facilities" count={`${serviceSites.length} sites`}>
              <div className={pageStyles.siteCardGrid}>
                {serviceSites.map((site) => {
                  const sUnits = serviceUnits.filter((u) => u.siteCode === site.code);
                  const sCap = sUnits.reduce((acc, u) => acc + u.beds, 0);
                  const sReady = sUnits.reduce((acc, u) => {
                    const row = readyRows.find((r) => r.unit.id === u.id);
                    return acc + (row?.capacity.available ?? 0);
                  }, 0);
                  return (
                    <div key={site.code} className={pageStyles.siteCard}>
                      <div className={pageStyles.siteCardHeader}>
                        <strong className={pageStyles.siteCardName}>{site.name}</strong>
                        <span style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--muted)" }}>
                          {site.code}
                        </span>
                      </div>
                      <div className={pageStyles.siteCardStats}>
                        <span>
                          Wards: <strong>{sUnits.length}</strong>
                        </span>
                        <span>
                          Total Beds: <strong>{sCap}</strong>
                        </span>
                        <span>
                          Ready: <strong>{sReady}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </WardPanel>
          </div>

          <div className={pageStyles.rightColumn}>
            <WardPanel title="Ready beds, by ward and cohort" testId="ward-statistics-service-ready-beds">
              <div className={styles.panelBody} role="group" aria-label="Ready beds content" tabIndex={0}>
                {serviceUnits.length > 0 ? (
                  <dl className={pageStyles.kpiBand}>
                    <div>
                      <dt>Ready beds</dt>
                      <dd>{totalReady}</dd>
                      <dd className={pageStyles.kpiCaption}>Across {serviceUnits.length} wards</dd>
                    </div>
                    <div>
                      <dt>Wards with none ready</dt>
                      <dd>{zeroReadyWards}</dd>
                      <dd className={pageStyles.kpiCaption}>Of {serviceUnits.length} wards</dd>
                    </div>
                  </dl>
                ) : null}

                {serviceUnits.length > 0 ? (
                  <details className={`${pageStyles.measureDetails} source-print`}>
                    <summary>How the ready-bed figures are counted</summary>
                    <div className={pageStyles.measureDetailsBody}>
                      <p className={styles.body} data-testid="ward-statistics-service-pending-preparation">
                        {pendingPreparation} of this service&apos;s empty{" "}
                        {pendingPreparation === 1 ? "bed is" : "beds are"} marked Pending and included in Ready.{" "}
                        {totalOpenNow < totalReady ? (
                          <strong>Available to act on now: {totalOpenNow}, because Pending beds cannot be pulled.</strong>
                        ) : null}
                      </p>
                      <p className={serviceStyles.measuredCount} data-testid="ward-statistics-service-zero-ready-wards">
                        <span data-testid="ward-statistics-service-zero-ready-wards-value">{zeroReadyWards}</span> of{" "}
                        {service}
                        &apos;s {serviceUnits.length} {serviceUnits.length === 1 ? "ward has" : "wards have"} no ready
                        beds at all right now.
                      </p>
                    </div>
                  </details>
                ) : null}

                {serviceUnits.length === 0 ? (
                  <p className={styles.notFoundBody} data-testid="ward-statistics-service-no-wards">
                    No ward in this prototype is recorded at a {service} hospital.
                  </p>
                ) : (
                  <WardTable testId="ward-statistics-service-ready-beds-table" className={serviceStyles.readyBedsTable}>
                    <thead>
                      <tr>
                        <th scope="col">Ward</th>
                        <th scope="col">Cohort</th>
                        <th scope="col">Ready beds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyRows.map(({ unit, capacity }) => (
                        <tr key={unit.id} data-testid={`ward-statistics-service-ready-row-${unit.id}`}>
                          <th scope="row">
                            <Link href={wardStatisticsHref(unit.id)} className={serviceStyles.wardLink}>
                              {unit.name}
                            </Link>
                          </th>
                          <td>{unit.cohort}</td>
                          <td data-testid={`ward-statistics-service-ready-value-${unit.id}`}>{capacity.available}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">All {serviceUnits.length} wards</th>
                        <td />
                        <td data-testid="ward-statistics-service-ready-total">{totalReady}</td>
                      </tr>
                    </tfoot>
                  </WardTable>
                )}
              </div>
            </WardPanel>
          </div>
        </div>
      </div>

      {/* TAB 2: WARD CAPACITY & COHORTS */}
      <div
        id="pane-cohorts"
        className={`${pageStyles.tabPane} ${activeTab === "cohorts" ? pageStyles.tabPaneActive : ""}`}
        role="tabpanel"
        aria-labelledby="tab-cohorts"
      >
        <div style={{ display: "grid", gap: "0.875rem" }}>
          <WardPanel
            title="Clinical Cohort Availability Matrix"
            count={`${cohortsMap.size} clinical cohorts`}
          >
            <div style={{ overflowX: "auto" }}>
              <table className={pageStyles.dataTable} id="cohortMatrixTable">
                <thead>
                  <tr>
                    <th scope="col">Clinical Cohort</th>
                    <th scope="col" className="num">Total Beds</th>
                    <th scope="col" className="num">Occupied</th>
                    <th scope="col" className="num">Ready Beds</th>
                    <th scope="col" className="num">Held / Reserved</th>
                    <th scope="col" className="num">Blocked / Offline</th>
                    <th scope="col" className="num">Locked Secure</th>
                    <th scope="col" className="num">Occupancy %</th>
                    <th scope="col">Availability Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cohortsMap.entries()].map(([cohort, data]) => {
                    const occPct = data.total > 0 ? ((data.occupied / data.total) * 100).toFixed(0) : "0";
                    const isHigh = Number(occPct) >= 90;
                    return (
                      <tr key={cohort}>
                        <th scope="row" style={{ fontWeight: 600 }}>{cohort}</th>
                        <td className="num">{data.total}</td>
                        <td className="num">{data.occupied}</td>
                        <td className="num" style={{ fontWeight: 600, color: data.ready > 0 ? "var(--good)" : "var(--muted)" }}>
                          {data.ready}
                        </td>
                        <td className="num">{data.held}</td>
                        <td className="num">{data.blocked}</td>
                        <td className="num">{data.locked}</td>
                        <td className="num" style={{ color: isHigh ? "var(--danger)" : "var(--ink)", fontWeight: 600 }}>
                          {occPct}%
                        </td>
                        <td>
                          <span
                            className="chip"
                            style={{
                              fontSize: "12px",
                              background: data.ready > 0 ? "var(--good-soft)" : "var(--warn-soft)",
                              color: data.ready > 0 ? "var(--good)" : "var(--warn)",
                            }}
                          >
                            {data.ready > 0 ? `${data.ready} Available` : "Constrained"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted)", padding: "0.5rem 0.75rem 0", margin: 0 }}>
              Ready beds represent physically empty and clinically allocatable beds immediately available for placement.
            </p>
          </WardPanel>

          <WardPanel
            title="Unit-Level Inpatient Bed State"
            count={`${filteredAndSortedReadyRows.length} wards`}
          >
            <div className={pageStyles.tableControlsBar}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, maxWidth: "24rem" }}>
                <input
                  type="search"
                  id="readySearchInput"
                  className={pageStyles.tableSearchInput}
                  placeholder="Filter wards, sites, or cohorts..."
                  value={cohortSearch}
                  onChange={(e) => setCohortSearch(e.target.value)}
                  aria-label="Filter ready beds table"
                />
              </div>
              <span className={pageStyles.tableFilterCount}>
                Showing {filteredAndSortedReadyRows.length} of {readyRows.length} wards
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className={pageStyles.dataTable} id="readyTable">
                <thead>
                  <tr>
                    <th scope="col" className={pageStyles.sortableTh} onClick={() => handleWardSort("name")}>
                      Ward Name
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "name" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "name" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={pageStyles.sortableTh} onClick={() => handleWardSort("siteCode")}>
                      Site
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "siteCode" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "siteCode" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={pageStyles.sortableTh} onClick={() => handleWardSort("cohort")}>
                      Cohort
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "cohort" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "cohort" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={`num ${pageStyles.sortableTh}`} onClick={() => handleWardSort("beds")}>
                      Capacity
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "beds" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "beds" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={`num ${pageStyles.sortableTh}`} onClick={() => handleWardSort("occupied")}>
                      Occupied
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "occupied" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "occupied" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={`num ${pageStyles.sortableTh}`} onClick={() => handleWardSort("available")}>
                      Ready
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "available" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "available" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={`num ${pageStyles.sortableTh}`} onClick={() => handleWardSort("held")}>
                      Held
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "held" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "held" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                    <th scope="col" className={pageStyles.sortableTh} onClick={() => handleWardSort("occPct")}>
                      Occupancy
                      <span className={`${pageStyles.sortIcon} ${wardSortCol === "occPct" ? pageStyles.sortIconActive : ""}`}>
                        {wardSortCol === "occPct" ? (wardSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedReadyRows.map(({ unit, capacity }) => {
                    const occPct = unit.beds > 0 ? ((capacity.occupied / unit.beds) * 100).toFixed(0) : "0";
                    return (
                      <tr key={unit.id}>
                        <th scope="row">
                          <Link href={wardStatisticsHref(unit.id)} className={serviceStyles.wardLink}>
                            {unit.name}
                          </Link>
                        </th>
                        <td>{unit.siteCode}</td>
                        <td>{unit.cohort}</td>
                        <td className="num">{unit.beds}</td>
                        <td className="num">{capacity.occupied}</td>
                        <td className="num" style={{ fontWeight: 600, color: capacity.available > 0 ? "var(--good)" : "var(--muted)" }}>
                          {capacity.available}
                        </td>
                        <td className="num">{capacity.held}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div className={pageStyles.bandTrack} style={{ width: "3.5rem" }} aria-hidden="true">
                              <span style={{ width: `${occPct}%` }} />
                            </div>
                            <span style={{ fontSize: "12px", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                              {occPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted)", padding: "0.5rem 0.75rem 0", margin: 0 }}>
              Reflects live ward bed management state.
            </p>
          </WardPanel>
        </div>
      </div>

      {/* TAB 3: REFERRAL FLOW */}
      <div
        id="pane-flow"
        className={`${pageStyles.tabPane} ${activeTab === "flow" ? pageStyles.tabPaneActive : ""}`}
        role="tabpanel"
        aria-labelledby="tab-flow"
      >
        <div className={pageStyles.pageGrid}>
          <div className={pageStyles.leftColumn}>
            <WardPanel
              title="Inter-Service Referral Flow Matrix"
              count="Sent vs Taken In"
            >
              <div style={{ padding: "0.75rem" }}>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 0.75rem 0", lineHeight: 1.45 }}>
                  Cross-service patient movements between the four Western Australian health services during this reporting period.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table className={pageStyles.dataTable} id="flowMatrixTable">
                    <thead>
                      <tr>
                        <th scope="col">Originating Service</th>
                        <th scope="col" className="num">To NMHS</th>
                        <th scope="col" className="num">To EMHS</th>
                        <th scope="col" className="num">To SMHS</th>
                        <th scope="col" className="num">To WACHS</th>
                        <th scope="col" className="num">Total Sent</th>
                        <th scope="col" className="num">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interServiceFlowMatrix.map((row) => (
                        <tr key={row.originSvc}>
                          <th scope="row" style={{ fontWeight: 600, color: row.originSvc === service ? "var(--accent)" : "var(--ink)" }}>
                            {row.originSvc} {row.originSvc === service ? "(This)" : ""}
                          </th>
                          <td className="num">{row.toNMHS}</td>
                          <td className="num">{row.toEMHS}</td>
                          <td className="num">{row.toSMHS}</td>
                          <td className="num">{row.toWACHS}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{row.totalSent}</td>
                          <td className="num">
                            <span
                              className={`${pageStyles.flowBalanceBadge} ${
                                row.netBalance > 0
                                  ? pageStyles.flowBalancePositive
                                  : row.netBalance < 0
                                  ? pageStyles.flowBalanceNegative
                                  : pageStyles.flowBalanceNeutral
                              }`}
                            >
                              {row.netBalance > 0 ? `+${row.netBalance}` : row.netBalance}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0.75rem 0 0", lineHeight: 1.45 }}>
                  Positive net balance indicates net patient inflow into the health service; negative balance indicates net outflow.
                </p>
              </div>
            </WardPanel>
          </div>

          <div className={pageStyles.rightColumn}>
            <WardPanel
              title="Where this service's own referrals were accepted"
              testId="ward-statistics-service-placement"
            >
              <div className={styles.panelBody} role="group" aria-label="Referral placement content" tabIndex={0}>
                <dl className={`${pageStyles.kpiBand} ${pageStyles.placementBand}`}>
                  <div>
                    <dt>Raised</dt>
                    <dd data-testid="ward-statistics-service-placement-raised">{ownReferrals.length}</dd>
                    <dd className={pageStyles.kpiCaption}>by this service</dd>
                  </div>
                  <div>
                    <dt>Accepted within</dt>
                    <dd data-testid="ward-statistics-service-placement-within">{placedWithinService}</dd>
                    <dd className={pageStyles.kpiCaption}>at its own wards</dd>
                  </div>
                  <div>
                    <dt>Accepted elsewhere</dt>
                    <dd data-testid="ward-statistics-service-placement-elsewhere">{placedElsewhereCount}</dd>
                    <dd className={pageStyles.kpiCaption}>at another service</dd>
                  </div>
                  <div>
                    <dt>Not yet</dt>
                    <dd data-testid="ward-statistics-service-placement-not-yet">{notYetAcceptedAtWard}</dd>
                    <dd className={pageStyles.kpiCaption}>accepted at a ward</dd>
                  </div>
                </dl>

                <details className={`${pageStyles.measureDetails} source-print`}>
                  <summary>Referral placement caveat</summary>
                  <div className={pageStyles.measureDetailsBody}>
                    <p className={styles.note} data-testid="ward-statistics-service-placement-caveat">
                      {notYetAcceptedAtWard} {notYetAcceptedAtWard === 1 ? "referral has" : "referrals have"} no recorded
                      ward acceptance. This includes queued or declined referrals and any accepted by a community team or
                      emergency department; the record does not separate those states. These are acceptances, not
                      arrivals.
                    </p>
                  </div>
                </details>

                <h3 className={pageStyles.sectionHeading} style={{ marginTop: "0.75rem" }}>
                  Accepted at a ward in another service
                </h3>
                <ul
                  className={`${serviceStyles.tallyList} ${pageStyles.bandList}`}
                  data-testid="ward-statistics-service-placement-elsewhere-list"
                >
                  {[...placedElsewhereByService.entries()].map(([destination, count]) => (
                    <li
                      key={destination}
                      className={serviceStyles.tallyRow}
                      data-testid={`ward-statistics-service-placement-to-${destination}`}
                    >
                      <span className={serviceStyles.tallyReason}>{destination}</span>
                      <span className={pageStyles.bandTrack} aria-hidden="true">
                        <span
                          style={{
                            width: `${placedElsewhereCount === 0 ? 0 : (count / placedElsewhereCount) * 100}%`,
                          }}
                        />
                      </span>
                      <span
                        className={serviceStyles.tallyCount}
                        data-testid={`ward-statistics-service-placement-to-${destination}-count`}
                      >
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>

                {placedAtUnresolvedWard > 0 ? (
                  <p className={serviceStyles.absence} data-testid="ward-statistics-service-placement-unresolved">
                    <span data-testid="ward-statistics-service-placement-unresolved-count">{placedAtUnresolvedWard}</span>{" "}
                    {placedAtUnresolvedWard === 1 ? "referral names" : "referrals name"} an accepting ward this prototype
                    cannot place at any hospital, so it cannot be counted as within {service} or as exported.
                  </p>
                ) : null}
              </div>
            </WardPanel>
          </div>
        </div>
      </div>

      {/* TAB 4: OUT-OF-AREA PLACEMENT */}
      <div
        id="pane-ooa"
        className={`${pageStyles.tabPane} ${activeTab === "ooa" ? pageStyles.tabPaneActive : ""}`}
        role="tabpanel"
        aria-labelledby="tab-ooa"
      >
        <div className={pageStyles.pageGrid}>
          <div className={pageStyles.leftColumn}>
            <WardPanel
              title="How many of this service's own patients are far from home"
              testId="ward-statistics-service-out-of-area"
            >
              <div className={styles.panelBody} role="group" aria-label="Out of area content" tabIndex={0}>
                <dl className={pageStyles.kpiBand}>
                  <div>
                    <dt>People far from home</dt>
                    <dd data-testid="ward-statistics-service-out-of-area-value">{outOfAreaEntries.length}</dd>
                    <dd className={pageStyles.kpiCaption}>currently in this service&apos;s beds</dd>
                  </div>
                  <div>
                    <dt>Not banded at all</dt>
                    <dd data-testid="ward-statistics-service-out-of-area-not-banded-value">{outOfAreaNotBanded}</dd>
                    <dd className={pageStyles.kpiCaption}>No shared denominator</dd>
                  </div>
                </dl>

                <DistanceBandsBar total={outOfAreaEntries.length} bandCounts={bandCounts} />

                <h3 className={pageStyles.sectionHeading} style={{ marginTop: "0.75rem" }}>By band</h3>
                <ul
                  className={`${serviceStyles.tallyList} ${pageStyles.bandList}`}
                  data-testid="ward-statistics-service-out-of-area-bands"
                >
                  {OUT_OF_AREA_BANDS.map((band) => (
                    <li
                      key={band}
                      className={serviceStyles.tallyRow}
                      data-testid={`ward-statistics-service-out-of-area-band-${band}`}
                    >
                      <span className={serviceStyles.tallyReason}>{TRAVEL_BAND_LABELS[band]}</span>
                      <span className={pageStyles.bandTrack} aria-hidden="true">
                        <span
                          style={{
                            width: `${outOfAreaEntries.length === 0 ? 0 : ((bandCounts.get(band) ?? 0) / outOfAreaEntries.length) * 100}%`,
                          }}
                        />
                      </span>
                      <span
                        className={serviceStyles.tallyCount}
                        data-testid={`ward-statistics-service-out-of-area-band-${band}-count`}
                      >
                        {bandCounts.get(band) ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>

                <details className={`${pageStyles.measureDetails} source-print`}>
                  <summary>Synthetic distance definitions</summary>
                  <div className={pageStyles.measureDetailsBody}>
                    <p className={styles.notice} data-testid="ward-statistics-service-out-of-area-threshold-notice">
                      {INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE}
                    </p>
                    <p className={styles.notice} data-testid="ward-statistics-service-out-of-area-synthetic-notice">
                      {SYNTHETIC_TRAVEL_TIMES_NOTICE}
                    </p>
                  </div>
                </details>
              </div>
            </WardPanel>
          </div>

          <div className={pageStyles.rightColumn}>
            <WardPanel
              title="Repatriation Priority Roster"
              count={`${filteredRepatEntries.length} patients`}
            >
              <div style={{ padding: "0.75rem" }}>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 0.75rem 0", lineHeight: 1.45 }}>
                  Active inpatients admitted to {service} wards whose home catchment is outside this health service.
                </p>
                <div className={pageStyles.tableControlsBar} style={{ marginBottom: "0.5rem" }}>
                  <input
                    type="search"
                    id="repatSearchInput"
                    className={pageStyles.tableSearchInput}
                    placeholder="Filter by patient, current ward, home catchment..."
                    value={repatSearch}
                    onChange={(e) => setRepatSearch(e.target.value)}
                    aria-label="Filter repatriation roster"
                  />
                  <span className={pageStyles.tableFilterCount}>
                    {filteredRepatEntries.length} active OOA
                  </span>
                </div>
                {filteredRepatEntries.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)", fontStyle: "italic", padding: "0.5rem" }}>
                    No patients match search or currently admitted out of their catchment area.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className={pageStyles.dataTable} id="repatTable">
                      <thead>
                        <tr>
                          <th scope="col">Patient UMRN</th>
                          <th scope="col">Admitted Ward</th>
                          <th scope="col">Distance Band</th>
                          <th scope="col">Repat Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRepatEntries.map((entry, idx) => (
                          <tr key={idx}>
                            <th scope="row" style={{ fontFamily: "var(--mono)", fontSize: "12px" }}>
                              {entry.admission.id}
                            </th>
                            <td>{entry.unit.name}</td>
                            <td>{TRAVEL_BAND_LABELS[entry.band]}</td>
                            <td>
                              <span
                                className="chip"
                                style={{
                                  fontSize: "12px",
                                  background: entry.band === "air_transport_only" ? "var(--danger-soft)" : "var(--accent-soft)",
                                  color: entry.band === "air_transport_only" ? "var(--danger)" : "var(--accent-ink)",
                                }}
                              >
                                {entry.band === "air_transport_only" ? "Priority 1" : "Standard"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </WardPanel>
          </div>
        </div>
      </div>

      {/* TAB 5: 30-DAY ACTIVITY */}
      <div
        id="pane-activity"
        className={`${pageStyles.tabPane} ${activeTab === "activity" ? pageStyles.tabPaneActive : ""}`}
        role="tabpanel"
        aria-labelledby="tab-activity"
      >
        <WardPanel title="Sent and taken in, over the last 30 days" testId="ward-statistics-service-flow">
          <div className={styles.panelBody} role="group" aria-label="Thirty day service flow content" tabIndex={0}>
            <p className={styles.body}>
              <strong>Not recorded.</strong> No daily history is recorded, so neither 30-day series is shown.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "0.875rem" }}>
              <DemonstrationChart series={sentSeries} testId="ward-statistics-service-sent-chart" />
              <DemonstrationChart series={takenInSeries} testId="ward-statistics-service-taken-in-chart" />
            </div>
          </div>
        </WardPanel>
      </div>

        <div className={pageStyles.pageFoot}>
          <StatFootnote
            groups={[
              {
                heading: "Measures unavailable from the current record",
                items: [
                  "Current net flow is not calculated from these placement counts.",
                  "Declines by service: referral and movement declines have different attribution.",
                  "Measured distance: travel bands are synthetic and do not come from a map.",
                ],
              },
            ]}
          />

          <p className={styles.body}>
            <Link href={STATISTICS_SERVICE_CHOOSER_HREF} data-testid="ward-statistics-service-chooser-link">
              Choose a different health service
            </Link>
          </p>
        </div>

      {toastMessage && (
        <div className={pageStyles.actionToast} role="status" aria-live="polite" aria-atomic="true">
          <span>{toastMessage}</span>
        </div>
      )}
    </StatisticsSectionFrame>
  );
}
