"use client";

import { Hand, LayoutGrid, List } from "lucide-react";
import type { CSSProperties } from "react";

import type { Unit } from "@/components/ward-management/ward-model";
import { Card, CardHead, DisabledReason, StatusGlyph, buttonClass, cx, useIsPhone, durMinutes } from "@/components/wf";

import { bedFits, bedNumberLabel, BOARD_RESTING_SAY, type BoardPick } from "./ward-bed-board-logic";
import { bedGlyphTone, type BedItem } from "./ward-beds-matrix";
import styles from "./ward-bed-board.module.css";

/** One referral waiting for this ward's answer that the board can place in a bed. */
export type WaitingReferral = {
  /**
   * v10 pass 3: "movement" is a person the coordinator referred to this ward (placed with
   * `ACCEPT_IN_PRINCIPLE` and a bed number); absent is a referral sent straight to the ward.
   */
  kind?: "referral" | "movement";
  id: string;
  name: string;
  /** "F", "M" or "Not recorded". */
  sex: string;
  waitedMinutes: number;
  secureBedNeeded: boolean;
  /** Set when this route cannot accept it (for example a transfer the coordinator accepts). */
  blockedReason?: string;
};

export type WardBedBoardProps = {
  unit: Unit;
  beds: readonly BedItem[];
  isMixed: boolean;
  waiting: readonly WaitingReferral[];
  picked: BoardPick | null;
  onPick: (pick: BoardPick | null) => void;
  /** The board's live sentence: what was picked, placed, refused or undone. */
  say: string;
  onBedPress: (bed: BedItem) => void;
  /** The bed placed last, which plays the place animation once. */
  placedBed: number | null;
  /** Find bed or person: matching beds stay lit, the rest dim. */
  query: string;
  onOpenList: () => void;
};

/** Mixed wards draw their locked beds and open beds as two pods across a corridor. */
function podsOf(beds: readonly BedItem[], unit: Unit, isMixed: boolean) {
  if (!isMixed) return [{ id: "all", name: "All beds", rule: unit.cohort, beds }];
  return [
    { id: "locked", name: "Locked beds", rule: "Locked", beds: beds.filter((bed) => bed.designation === "Locked") },
    { id: "open", name: "Open beds", rule: "Open", beds: beds.filter((bed) => bed.designation !== "Locked") },
  ];
}

function surname(name: string | undefined): string {
  if (!name) return "Not recorded";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function cellWord(bed: BedItem): string {
  if (bed.status === "ready") return bed.heldFor ? `Held, ${surname(bed.heldFor)}` : "Free";
  if (bed.status === "closed") return "Closed";
  if (bed.status === "incoming") return "Pulled";
  return surname(bed.patientAlias);
}

function cellLabel(bed: BedItem, fits: boolean): string {
  const state =
    bed.status === "ready"
      ? bed.heldFor
        ? `free, held for ${bed.heldFor}`
        : "free"
      : bed.status === "closed"
        ? "closed"
        : bed.status === "incoming"
          ? `pulled${bed.patientAlias ? `, ${bed.patientAlias}` : ""}`
          : `${bed.patientAlias ?? "occupant not recorded"}${bed.status === "leave" ? ", on leave" : ""}`;
  return `Bed ${bedNumberLabel(bed.bedNumber)}, ${state}${fits ? ", fits" : ""}`;
}

function matchesQuery(bed: BedItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [bedNumberLabel(bed.bedNumber), bed.bedLabel, bed.patientAlias ?? "", bed.umrn ?? "", bed.statusText]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * Ward page, Bed board tab (v10 build guide "Bed board tab: pods, corridor and one cell per bed,
 * with pick up and place"). Controlled: the ward screen holds what is picked up and dispatches the
 * placement, so the bed panel's "Move to another bed" can pick up from outside the board.
 */
export function WardBedBoard({
  unit,
  beds,
  isMixed,
  waiting,
  picked,
  onPick,
  say,
  onBedPress,
  placedBed,
  query,
  onOpenList,
}: WardBedBoardProps) {
  const isPhone = useIsPhone();
  const pods = podsOf(beds, unit, isMixed);
  const free = beds.filter((bed) => bed.status === "ready" && bed.heldFor === undefined).length;
  const leavingToday = beds.filter(
    (bed) =>
      bed.status !== "ready" &&
      bed.status !== "closed" &&
      (bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0)),
  );

  const waitChips = (
    <>
      {waiting.map((referral) => {
        const isMovement = referral.kind === "movement";
        const on =
          (picked?.kind === "referral" && !isMovement && picked.referralId === referral.id) ||
          (picked?.kind === "movement" && isMovement && picked.movementId === referral.id);
        const reasonId = `ward-board-wait-${referral.id}-reason`;
        return (
          <span key={referral.id} className={styles.chipWrap}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={on}
              aria-disabled={referral.blockedReason ? true : undefined}
              aria-describedby={referral.blockedReason ? reasonId : undefined}
              data-testid={`ward-board-pick-${referral.id}`}
              onClick={() => {
                if (referral.blockedReason) return;
                onPick(
                  on
                    ? null
                    : isMovement
                      ? {
                          kind: "movement",
                          movementId: referral.id,
                          name: referral.name,
                          secureBedNeeded: referral.secureBedNeeded,
                        }
                      : {
                          kind: "referral",
                          referralId: referral.id,
                          name: referral.name,
                          secureBedNeeded: referral.secureBedNeeded,
                        },
                );
              }}
            >
              <StatusGlyph tone={referral.waitedMinutes >= 240 ? "warning" : "neutral"} size={10} />
              <span className={styles.chipName}>{referral.name}</span>
              <span className={styles.chipMeta}>
                {referral.sex} · {durMinutes(referral.waitedMinutes)}
              </span>
            </button>
            {referral.blockedReason ? <DisabledReason id={reasonId}>{referral.blockedReason}</DisabledReason> : null}
          </span>
        );
      })}
      {picked?.kind === "stay" ? (
        <button
          type="button"
          className={styles.chip}
          aria-pressed="true"
          onClick={() => {
            onPick(null);
          }}
        >
          <StatusGlyph tone="info" size={10} />
          <span className={styles.chipName}>{picked.name}</span>
          <span className={styles.chipMeta}>from bed {bedNumberLabel(picked.fromBed)}</span>
        </button>
      ) : null}
      {waiting.length === 0 && picked?.kind !== "stay" ? (
        <span className={styles.none}>Nobody waiting to be placed</span>
      ) : null}
    </>
  );

  const sayRow = (
    <div className={styles.say}>
      <span className={styles.sayText} aria-live="polite" data-testid="ward-board-say">
        {say || BOARD_RESTING_SAY}
      </span>
      {picked ? (
        <button
          type="button"
          className={buttonClass({ variant: "sec", size: "sm" })}
          onClick={() => {
            onPick(null);
          }}
        >
          Put down
        </button>
      ) : null}
    </div>
  );

  const plan = (
    <div
      className={cx(styles.plan, pods.length > 1 && styles.planTwo)}
      data-picking={picked ? "true" : undefined}
      data-testid="ward-bed-board-plan"
    >
      {pods.map((pod, index) => {
        const podFree = pod.beds.filter((bed) => bed.status === "ready" && bed.heldFor === undefined).length;
        return (
          <div key={pod.id} className={styles.podSlot}>
            {index === 1 ? <div className={styles.corridor} aria-hidden="true" /> : null}
            <section className={styles.pod} aria-label={`${pod.name}, ${podFree} free of ${pod.beds.length}`}>
              <div className={styles.podHead}>
                <b className={styles.podName}>{pod.name}</b>
                <span className={styles.podRule}>{pod.rule}</span>
                <span className={styles.podCount}>
                  <b>{podFree}</b> free of {pod.beds.length}
                </span>
              </div>
              <div
                className={styles.cells}
                style={{ "--cols": String(isPhone ? 4 : pods.length > 1 ? 4 : 8) } as CSSProperties}
              >
                {pod.beds.map((bed) => {
                  const fits = bedFits(bed, picked, isMixed);
                  const source = picked?.kind === "stay" && picked.fromBed === Number(bed.bedNumber);
                  const glyph = bedGlyphTone(bed);
                  const dim = picked ? !fits && !source : !matchesQuery(bed, query);
                  return (
                    <button
                      key={bed.bedNumber}
                      type="button"
                      className={styles.cell}
                      data-state={bed.heldFor ? "held" : String(bed.status)}
                      data-fits={fits ? "true" : undefined}
                      data-act={glyph === "danger" ? "true" : undefined}
                      data-dim={dim ? "true" : undefined}
                      data-placed={placedBed === Number(bed.bedNumber) ? "true" : undefined}
                      aria-pressed={source ? true : undefined}
                      aria-label={cellLabel(bed, fits)}
                      data-testid={`ward-board-bed-${bed.bedNumber}`}
                      onClick={() => {
                        onBedPress(bed);
                      }}
                    >
                      <span className={styles.cellNo}>{bedNumberLabel(bed.bedNumber)}</span>
                      <span className={styles.cellState}>
                        {glyph ? (
                          <StatusGlyph tone={glyph} size={10} />
                        ) : (
                          <span className={styles.swatch} aria-hidden="true" />
                        )}
                        <span className={styles.cellWord}>{cellWord(bed)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );

  const soon = (
    <div className={styles.soon}>
      <span className={styles.soonLabel}>Coming free today</span>
      {leavingToday.length === 0 ? (
        <span className={styles.none}>Nothing else today</span>
      ) : (
        leavingToday.map((bed) => (
          <button
            key={bed.bedNumber}
            type="button"
            className={styles.soonChip}
            onClick={() => {
              onBedPress(bed);
            }}
          >
            <StatusGlyph tone="info" size={9} />
            <span className={styles.mono}>{bedNumberLabel(bed.bedNumber)}</span>
            {bed.dischargeConfirmed ? "confirmed" : "expected"}
          </button>
        ))
      )}
    </div>
  );

  const legend = (
    <span className={styles.key} aria-label="Symbol key">
      <span>
        <StatusGlyph tone="danger" size={9} />
        Act now
      </span>
      <span>
        <StatusGlyph tone="warning" size={9} />
        At risk
      </span>
      <span>
        <StatusGlyph tone="info" size={9} />
        Moving
      </span>
      <span>
        <StatusGlyph tone="neutral" size={9} />
        Waiting
      </span>
      <span>
        <StatusGlyph tone="success" size={9} />
        Free
      </span>
    </span>
  );

  return (
    <Card className={cx(styles.board, isPhone && styles.boardPhone)} aria-labelledby="ward-bed-board-title">
      <CardHead
        id="ward-bed-board-title"
        icon={isPhone ? undefined : LayoutGrid}
        title={isPhone ? "Waiting for this ward" : "Bed board"}
        meta={isPhone ? undefined : isMixed ? "Locked and open beds" : unit.name}
        aside={
          <span className={styles.headCount}>
            <b>{free}</b> free of {beds.length}
          </span>
        }
        action={
          <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })} onClick={onOpenList}>
            <List size={14} aria-hidden="true" />
            {isPhone ? "List" : "Every bed list"}
          </button>
        }
      />
      <div className={styles.body}>
        <div className={styles.waitlist} role="group" aria-label="Waiting for this ward">
          {isPhone ? null : (
            <span className={styles.waitLabel}>
              <Hand size={14} aria-hidden="true" />
              Waiting
            </span>
          )}
          {waitChips}
        </div>
        {isPhone ? sayRow : null}
        {plan}
        {soon}
        {isPhone ? null : sayRow}
      </div>
      <div className={styles.foot}>
        {legend}
        <span className={styles.footHint}>Keyboard: Enter picks up, Tab to a bed, Enter places, Escape puts down</span>
      </div>
    </Card>
  );
}
