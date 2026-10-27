"use client";

import { Hand, LayoutGrid, List } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { Card, CardHead, DisabledReason, StatusGlyph, buttonClass, cx, useIsPhone, durMinutes } from "@/components/wf";

import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import { boardBedFits, bedNumberLabel, BOARD_RESTING_SAY, type BoardPick } from "./ward-bed-board-logic";
import { bedGlyphTone, type BedItem } from "./ward-bed-tone";
import { CriteriaLedTag } from "./ward-criteria-led-tag";
import styles from "./ward-bed-board.module.css";

/** Shown in place of the pick control when a bed manager looks at the board. */
const BED_MANAGER_CANNOT_PLACE = "The ward or the coordinator places a patient";

/** One referral waiting for this ward's answer that the board can place in a bed. */
export type WaitingReferral = {
  /**
   * v10 pass 3: "movement" is a person the coordinator referred to this ward (placed with
   * `ACCEPT_IN_PRINCIPLE` and a bed number); absent is a referral sent straight to the ward.
   */
  kind?: "referral" | "movement";
  accepted?: boolean;
  id: string;
  name: string;
  /** For Discreet names on phone (A2-20): initials plus UMRN in place of the name. */
  umrn?: string;
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

/**
 * U1 (site review, 12 Oct 2026), D-83 (Josh, 26 Oct 2026; fresh audit FA-W-9): an occupied bed reads
 * surname first, then the given name in full. Only the surname shortens, so eight "Ferrowm…" beds in
 * move mode read "Ferrowm…, Elena" and "Ferrowm…, Iris" and stay distinguishable beside their bed
 * numbers.
 */
function occupantParts(
  name: string | undefined,
  umrn?: string | null,
  collidingPairs?: ReadonlySet<string>,
): { surname: string; given: string } | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1]!;
  const given = parts[0]!;
  if (collidingPairs?.has(`${last.toLowerCase()}|${given.toLowerCase()}`)) {
    const umrnTail = umrn ? ` · ${umrn.slice(-2)}` : "";
    return { surname: last, given: `${given}${umrnTail}` };
  }
  return { surname: last, given };
}

/**
 * The "surname|given" keys of occupants who look alike on this board: the same given name and the
 * same surname, or (Audit 1, Josh 20 Oct, CS-16) one surname the start of the other, as Kestrel and
 * Kestrelworth. Each of them then shows the UMRN's last two digits after the given name.
 */
export function lookAlikeKeys(beds: readonly BedItem[]): Set<string> {
  const occupants: { key: string; last: string; given: string }[] = [];
  for (const bed of beds) {
    if (bed.status === "ready" || bed.status === "closed" || bed.status === "incoming") continue;
    const parts = bed.patientAlias?.trim().split(/\s+/) ?? [];
    if (parts.length < 2) continue;
    const last = parts[parts.length - 1]!.toLowerCase();
    const given = parts[0]!.toLowerCase();
    occupants.push({ key: `${last}|${given}`, last, given });
  }
  const set = new Set<string>();
  occupants.forEach((one, index) => {
    for (const other of occupants.slice(index + 1)) {
      if (one.given !== other.given) continue;
      if (!one.last.startsWith(other.last) && !other.last.startsWith(one.last)) continue;
      set.add(one.key).add(other.key);
    }
  });
  return set;
}

function CellWord({ bed, collidingPairs }: { bed: BedItem; collidingPairs?: ReadonlySet<string> }) {
  const occupant =
    bed.status === "ready" || bed.status === "closed" || bed.status === "incoming"
      ? null
      : occupantParts(bed.patientAlias, bed.umrn, collidingPairs);
  if (occupant === null) return <span className={styles.cellWord}>{cellWord(bed)}</span>;
  return <CellName surname={occupant.surname} given={occupant.given} />;
}

let measureCanvas: HTMLCanvasElement | null = null;

/** Width of `text` in `font`, or null where the browser cannot measure (tests). */
function textWidth(text: string, font: string): number | null {
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return null;
  context.font = font;
  return context.measureText(text).width;
}

/**
 * The longest start of `surname` that fits `room` with an ellipsis, or the whole surname when it
 * fits. The browser's own ellipsis stops at the last whole letter and leaves the rest of its box
 * empty, which showed as a gap before the given name (13 Oct 2026). Cutting the word here ends the box at
 * the ellipsis instead.
 */
export function fitSurname(surname: string, room: number, measure: (text: string) => number): string {
  if (measure(surname) <= room) return surname;
  for (let length = surname.length - 1; length > 1; length -= 1) {
    const candidate = `${surname.slice(0, length).trimEnd()}…`;
    if (measure(candidate) <= room) return candidate;
  }
  return `${surname.charAt(0)}…`;
}

function CellName({ surname, given }: { surname: string; given: string }) {
  const nameRef = useRef<HTMLSpanElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const initialRef = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState<{ surname: string; text: string } | null>(null);
  const shown = fitted?.surname === surname ? fitted.text : surname;
  useLayoutEffect(() => {
    const name = nameRef.current;
    const word = wordRef.current;
    const tail = initialRef.current;
    if (!name || !word || !tail || typeof ResizeObserver !== "function") return;
    const fit = () => {
      // The name box fills the free space beside the glyph, so its width does not depend on the
      // text inside it. Two pixels of slack cover canvas and page measuring apart, so the CSS
      // ellipsis never cuts a second time.
      // scrollWidth is the given name's full width even when a narrow cell is cutting it. When
      // the given name alone fills the cell, the surname drops to its first letter and the given
      // name takes its own ellipsis, so nothing spills into the next bed.
      const room = Math.max(0, name.clientWidth - tail.scrollWidth - 2);
      const font = getComputedStyle(word).font;
      if (textWidth(surname, font) === null) return;
      setFitted({ surname, text: fitSurname(surname, room, (text) => textWidth(text, font) ?? 0) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(name);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
    // The ", {given}" tail takes room too, so a new given name is measured again.
  }, [surname, given]);
  return (
    <span ref={nameRef} className={styles.cellName}>
      <span ref={wordRef} className={styles.cellWord}>
        {shown}
      </span>
      <span ref={initialRef} className={styles.cellInitial}>
        , {given}
      </span>
    </span>
  );
}

/** Audit 1, Josh 20 Oct (CS-16), D-83: a pulled bed names the surname and the given name, as an occupied bed does. */
export function cellWord(bed: BedItem): string {
  if (bed.status === "ready" && !bed.heldFor && bed.preparing) return "Making ready";
  if (bed.status === "ready") {
    if (!bed.heldFor) return "Ready";
    const held = occupantParts(bed.heldFor);
    return held ? `Pulled, ${held.surname}, ${held.given}` : `Pulled, ${surname(bed.heldFor)}`;
  }
  if (bed.status === "closed") return "Closed";
  if (bed.status === "incoming") return "Pulled";
  return surname(bed.patientAlias);
}

function cellLabel(
  bed: BedItem,
  fits: boolean,
  nameFor: (name: string, umrn: string | undefined | null) => string,
): string {
  // A2-20: the accessible name follows Discreet names, as the visible cell does. Codex on #551: it uses the
  // cell's Ready and Pulled words too, so a pulled bed is never announced as free.
  const alias = bed.patientAlias === undefined ? undefined : nameFor(bed.patientAlias, bed.umrn);
  const state =
    bed.status === "ready"
      ? bed.heldFor
        ? `pulled for ${bed.heldFor}`
        : bed.preparing
          ? "being made ready"
          : "ready"
      : bed.status === "closed"
        ? "closed"
        : bed.status === "incoming"
          ? `pulled${alias ? `, ${alias}` : ""}`
          : `${alias ?? "occupant not recorded"}${bed.status === "leave" ? ", on leave" : ""}`;
  // D-64: the cell shows the short criteria led discharge tag, and the full phrase is spoken and in the tooltip.
  const criteria = bed.criteriaLedChip ? `, ${bed.criteriaLedChip.phrase}` : "";
  return `Bed ${bedNumberLabel(bed.bedNumber)}, ${state}${criteria}${fits ? ", fits" : ""}`;
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
  const nameFor = usePatientNameDisplay();
  const pods = podsOf(beds, unit, isMixed);
  const collidingPairs = lookAlikeKeys(beds);
  // Audit 24-4 NA2-09 (Josh, 24 Oct 2026): the ward's own ready figure (beds being made ready
  // inside it), with the same "still being made ready" note as every other ready figure.
  const { admissions, bedReleases } = useWardFlowSelect("admissions", "bedReleases");
  const free = readyBedsNow(unit, admissions, bedReleases);
  const beingMadeReady = bedsPendingPreparation(unit.id, bedReleases);
  const leavingToday = beds.filter(
    (bed) =>
      bed.status !== "ready" &&
      bed.status !== "closed" &&
      (bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0)),
  );

  // #820: placing stays with the ward and the coordinator, so a bed manager sees who waits but cannot pick.
  const bedManagerReason = useEffectiveWardAccess().role === "bed_manager" ? BED_MANAGER_CANNOT_PLACE : undefined;
  const waitChips = (
    <>
      {waiting.map((waitingReferral) => {
        const referral = bedManagerReason ? { ...waitingReferral, blockedReason: bedManagerReason } : waitingReferral;
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
                          accepted: referral.accepted,
                          name: referral.name,
                          secureBedNeeded: referral.secureBedNeeded,
                        },
                );
              }}
            >
              <StatusGlyph tone={referral.waitedMinutes >= 240 ? "warning" : "neutral"} size={10} />
              <span className={styles.chipName}>{nameFor(referral.name, referral.umrn)}</span>
              <span className={styles.chipMeta}>
                {referral.accepted ? "Accepted · hold or reassign · " : ""}
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
          <span className={styles.chipName}>
            {nameFor(picked.name, beds.find((bed) => Number(bed.bedNumber) === picked.fromBed)?.umrn)}
          </span>
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
        const podFree = pod.beds.filter(
          (bed) => bed.status === "ready" && bed.heldFor === undefined && !bed.preparing,
        ).length;
        return (
          <div key={pod.id} className={styles.podSlot}>
            {index === 1 ? <div className={styles.corridor} aria-hidden="true" /> : null}
            <section className={styles.pod} aria-label={`${pod.name}, ${podFree} ready of ${pod.beds.length}`}>
              <div className={styles.podHead}>
                <b className={styles.podName}>{pod.name}</b>
                <span className={styles.podRule}>{pod.rule}</span>
                <span className={styles.podCount}>
                  <b>{podFree}</b> ready of {pod.beds.length}
                </span>
              </div>
              <div
                className={styles.cells}
                style={{ "--cols": String(isPhone ? 4 : pods.length > 1 ? 4 : 8) } as CSSProperties}
              >
                {pod.beds.map((bed) => {
                  const fits = boardBedFits(beds, bed, picked, isMixed);
                  const source = picked?.kind === "stay" && picked.fromBed === Number(bed.bedNumber);
                  const glyph = bedGlyphTone(bed);
                  const dim = picked ? !fits && !source : !matchesQuery(bed, query);
                  const label = cellLabel(bed, fits, nameFor);
                  return (
                    <button
                      key={bed.bedNumber}
                      type="button"
                      className={styles.cell}
                      data-state={bed.heldFor ? "held" : bed.preparing ? "preparing" : String(bed.status)}
                      data-fits={fits ? "true" : undefined}
                      data-act={glyph === "danger" ? "true" : undefined}
                      data-dim={dim ? "true" : undefined}
                      data-placed={placedBed === Number(bed.bedNumber) ? "true" : undefined}
                      aria-pressed={source ? true : undefined}
                      // P087: while a pick is held, a bed it cannot go to is unavailable, not only dimmed.
                      // A press still says why it does not fit.
                      aria-disabled={picked && dim ? true : undefined}
                      aria-label={label}
                      title={label}
                      data-testid={`ward-board-bed-${bed.bedNumber}`}
                      onClick={() => {
                        onBedPress(bed);
                      }}
                    >
                      <span className={styles.cellTop}>
                        <span className={styles.cellNo}>{bedNumberLabel(bed.bedNumber)}</span>
                        {bed.criteriaLedChip ? <CriteriaLedTag chip={bed.criteriaLedChip} short /> : null}
                      </span>
                      <span className={styles.cellState}>
                        {glyph ? (
                          <StatusGlyph tone={glyph} size={10} />
                        ) : (
                          <span className={styles.swatch} aria-hidden="true" />
                        )}
                        <CellWord bed={bed} collidingPairs={collidingPairs} />
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
    <span className={styles.key} role="group" aria-label="Symbol key">
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
        Ready
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
            <b>{free}</b> ready of {beds.length}
            {beingMadeReady > 0 ? `, ${beingMadeReady} still being made ready` : null}
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
