"use client";

// The Movements screen's phone nav cards and the Arrivals ahead, ED to ward routes and Transport
// now sheets they open. Split out of movements-screen.tsx to keep that file under the line cap.
import Link from "next/link";
import { type Instant } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { startTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { edById } from "@/components/ward-management/ward-sites";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import {
  deriveMovementHorizonLanes,
  type CorridorCount,
  type RefusedCorridorCount,
  type TransportLegRow,
} from "./movements-derivations";
import { ArrowRightLeft, ChevronRight, ListFilter, Truck } from "lucide-react";
import { PhoneSheet, buttonClass } from "@/components/wf";
import { MovementHorizonGantt, rankCorridorPairs } from "./movement-horizon-gantt";
import flow from "./movement-flow.module.css";
import styles from "./movements.module.css";
import { ArrivalsAheadList } from "./arrivals-ahead-list";
import arrivalsStyles from "./arrivals-ahead-list.module.css";

/**
 * Phone (v10): the nav cards under the hero and the three sheets they open. Moved here from
 * `MovementsScreen`, which still owns every value it reads and passes them in.
 */
export function MovementsPhoneNav({
  activeCorridorCount,
  corridors,
  detailId,
  horizonLanes,
  legs,
  now,
  openDetail,
  phoneArrivalsTimeline,
  phoneCorridors,
  phoneInbound,
  phoneInboundWards,
  phoneSheet,
  refusedCorridors,
  revealMovement,
  setPhoneArrivalsTimeline,
  setPhoneSheet,
  transportFeed,
  units,
  withoutTransport,
}: {
  activeCorridorCount: number;
  corridors: CorridorCount[];
  detailId: string | null;
  horizonLanes: ReturnType<typeof deriveMovementHorizonLanes>;
  legs: TransportLegRow[];
  now: Instant;
  openDetail: (id: string) => void;
  phoneArrivalsTimeline: boolean;
  phoneCorridors: ReturnType<typeof rankCorridorPairs>;
  phoneInbound: Movement[];
  phoneInboundWards: number;
  phoneSheet: "arrivals" | "corridors" | "transport" | null;
  refusedCorridors: RefusedCorridorCount[];
  revealMovement: (id: string, byStage?: boolean) => void;
  setPhoneArrivalsTimeline: Dispatch<SetStateAction<boolean>>;
  setPhoneSheet: Dispatch<SetStateAction<"arrivals" | "corridors" | "transport" | null>>;
  transportFeed: (onPicked?: () => void) => ReactNode;
  units: Unit[];
  withoutTransport: number;
}) {
  return (
    <nav className={flow.phNav} aria-label="Movement panels">
      <button type="button" className={flow.phNavCard} onClick={() => startTransition(() => setPhoneSheet("arrivals"))}>
        <ListFilter size={16} className={flow.phNavIcon} aria-hidden="true" />
        <span className={flow.phNavText}>
          <strong>Arrivals ahead</strong>
          <span>
            <b>{phoneInbound.length}</b> incoming · {phoneInboundWards} {phoneInboundWards === 1 ? "ward" : "wards"}
          </span>
        </span>
        <ChevronRight size={16} className={flow.phNavChevron} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={flow.phNavCard}
        onClick={() => startTransition(() => setPhoneSheet("corridors"))}
      >
        <ArrowRightLeft size={16} className={flow.phNavIcon} aria-hidden="true" />
        <span className={flow.phNavText}>
          {/* F-24 (phone review, Oct 2026): plain words for a corridor, an ED to ward pairing. */}
          <strong>ED to ward routes</strong>
          <span>
            <b>{activeCorridorCount}</b> active · {refusedCorridors.length} declined today
          </span>
        </span>
        <ChevronRight size={16} className={flow.phNavChevron} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={flow.phNavCard}
        onClick={() => startTransition(() => setPhoneSheet("transport"))}
      >
        <Truck size={16} className={flow.phNavIcon} aria-hidden="true" />
        <span className={flow.phNavText}>
          <strong>Transport now</strong>
          <span>
            <b>{legs.length}</b> {legs.length === 1 ? "leg" : "legs"} · <b>{withoutTransport}</b> without
          </span>
        </span>
        <ChevronRight size={16} className={flow.phNavChevron} aria-hidden="true" />
      </button>
      <PhoneSheet
        open={phoneSheet === "arrivals"}
        onClose={() => setPhoneSheet(null)}
        title="Arrivals ahead"
        description="Incoming by receiving ward, soonest first"
        height="tall"
      >
        <ArrivalsAheadList lanes={horizonLanes} now={now} />
        <button
          type="button"
          className={arrivalsStyles.arrivalsMore}
          aria-expanded={phoneArrivalsTimeline}
          onClick={() => setPhoneArrivalsTimeline((open) => !open)}
        >
          {phoneArrivalsTimeline ? "Hide the timeline" : "Show the timeline"}
        </button>
        {phoneArrivalsTimeline ? (
          <MovementHorizonGantt
            lanes={horizonLanes}
            corridors={corridors}
            refusedCorridors={refusedCorridors}
            units={units}
            now={now}
            selectedMovementId={detailId}
            onSelectMovement={(id) => {
              setPhoneSheet(null);
              openDetail(id);
              revealMovement(id);
            }}
          />
        ) : null}
      </PhoneSheet>
      <PhoneSheet
        open={phoneSheet === "corridors"}
        onClose={() => setPhoneSheet(null)}
        title="ED to ward routes"
        description="People now, by ED and accepting ward"
        height="tall"
      >
        {phoneCorridors.length === 0 ? (
          <p className={styles.absent}>No open movement currently has an accepting ward.</p>
        ) : (
          <ol className={flow.phList}>
            {phoneCorridors.map((corridor) => {
              const ed = edById(corridor.originEdId);
              const unit = units.find((candidate) => candidate.id === corridor.acceptedUnitId);
              return (
                <li key={`${corridor.originEdId} ${corridor.acceptedUnitId}`} className={flow.phListRow}>
                  <span className={flow.phListMain}>
                    <strong>
                      {ed ? `${ed.siteCode} ED` : corridor.originEdId} to{" "}
                      {wardLabel(corridor.acceptedUnitId, unit?.name)}
                    </strong>
                    <span>
                      {corridor.stages.map((row) => `${stageCopy[row.stage].label} ${row.count}`).join(" · ")}
                    </span>
                  </span>
                  <b className={flow.phListCount}>{corridor.count}</b>
                </li>
              );
            })}
          </ol>
        )}
      </PhoneSheet>
      <PhoneSheet
        open={phoneSheet === "transport"}
        onClose={() => setPhoneSheet(null)}
        title="Transport now"
        description={`${legs.length} ${legs.length === 1 ? "leg" : "legs"} · ${withoutTransport} movements without one`}
        height="tall"
      >
        {legs.length === 0 ? (
          <p className={styles.absent}>No transport leg is booked or moving right now.</p>
        ) : (
          <div className={flow.phList}>{transportFeed(() => setPhoneSheet(null))}</div>
        )}
        <Link
          href="/ward-flow/transport/officer"
          className={buttonClass({ variant: "pri", className: flow.phSheetAction })}
        >
          <Truck size={16} aria-hidden="true" />
          Open transport dispatch
        </Link>
      </PhoneSheet>
    </nav>
  );
}
