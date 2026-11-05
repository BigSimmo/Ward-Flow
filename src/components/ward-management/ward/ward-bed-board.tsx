"use client";

import { LayoutGrid, List } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { Unit } from "@/components/ward-management/ward-model";
import { Card, CardHead, DisabledReason, StatusGlyph, buttonClass, cx, useIsPhone, durMinutes } from "@/components/wf";

import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import {
  boardReadyCounts,
  boardBedFits,
  bedNumberLabel,
  fitReason,
  placeQuestion,
  BOARD_RESTING_SAY,
  type BoardPick,
  nameParts,
} from "./ward-bed-board-logic";
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
  return nameParts(name)?.last ?? name.trim();
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
  const split = nameParts(name);
  if (split === null) return null;
  const { last, given } = split;
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
    const split = bed.patientAlias ? nameParts(bed.patientAlias) : null;
    if (split === null) continue;
    const last = split.last.toLowerCase();
    const given = split.given.toLowerCase();
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
  // An empty bed's word ("Making ready") wraps rather than cuts; only a surname is fitted.
  if (occupant === null)
    return (
      <span className={styles.cellWord} data-wrap="true">
        {cellWord(bed)}
      </span>
    );
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
      // WH8: the given name sits on its own line under the surname, so the surname has the whole width.
      const room = Math.max(0, name.clientWidth - 2);
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
        <span className={styles.srComma}>, </span>
        {given}
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
  if (bed.status === "incoming") {
    const pulled = occupantParts(bed.patientAlias);
    return pulled ? `Pulled, ${pulled.surname}, ${pulled.given}` : "Pulled";
  }
  return surname(bed.patientAlias);
}

/** The quiet line under a bed's name: its state in a word, and days in bed for a stay. */
function cellSub(bed: BedItem): string {
  if (bed.status === "ready")
    return bed.heldFor ? "Not yet arrived" : bed.preparing ? "Not offered yet" : "Free to place";
  if (bed.status === "closed") return "Not offered";
  if (bed.status === "incoming") return "Not yet arrived";
  const days = typeof bed.stayDays === "number" ? `${bed.stayDays}d` : null;
  if (bed.status === "leave") return days ? `On leave · ${days}` : "On leave";
  return days ?? "In bed";
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

/** Which pick a confirm belongs to, so a new pick never inherits the last one's question. */
function pickKey(pick: BoardPick): string {
  return pick.kind === "stay"
    ? `stay:${pick.admissionId}`
    : `${pick.kind}:${pick.kind === "movement" ? pick.movementId : pick.referralId}`;
}

/**
 * Ward page, Bed board (v10 build guide "Bed board tab: pods, corridor and one cell per bed, with
 * pick up and place"). Controlled: the ward screen holds what is picked up and dispatches the
 * placement, so the bed panel's "Move to another bed" can pick up from outside the board.
 *
 * WH8 (Josh, 3 Nov 2026): choose the person, the beds that fit light up with a short reason, choose a
 * bed, then one confirm sends it. On a desktop a waiting person can also
 * be dragged onto a lit bed, which asks the same confirm.
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
  // inside it), with the same "still being made ready" note as every other ready figure. One rule
  // for the header and every pod (`boardReadyCounts`), read from the tiles so a placement shows.
  // Read by property, so the ready-figure guard sees the qualifier is stated (beside Ready below).
  const readyCounts = boardReadyCounts(beds);
  const free = readyCounts.ready;
  const beingMadeReady = readyCounts.beingMadeReady;
  const leavingToday = beds.filter(
    (bed) =>
      bed.status !== "ready" &&
      bed.status !== "closed" &&
      (bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0)),
  );

  // The one confirm (WH8): the bed chosen for the current pick, asked before anything is sent.
  const [confirm, setConfirm] = useState<{ key: string; bed: BedItem } | null>(null);
  const confirming = picked && confirm?.key === pickKey(picked) ? confirm.bed : null;
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirming) return;
    sendRef.current?.focus({ preventScroll: true });
    // On a phone the question sits under the beds, so bring it into view.
    sendRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [confirming]);

  function chooseBed(bed: BedItem) {
    const fromHere = picked?.kind === "stay" && picked.fromBed === Number(bed.bedNumber);
    if (picked && !fromHere && boardBedFits(beds, bed, picked, isMixed)) {
      setConfirm({ key: pickKey(picked), bed });
      return;
    }
    setConfirm(null);
    onBedPress(bed);
  }

  // #820: placing stays with the ward and the coordinator, so a bed manager sees who waits but cannot pick.
  const bedManagerReason = useEffectiveWardAccess().role === "bed_manager" ? BED_MANAGER_CANNOT_PLACE : undefined;
  const pickFor = (referral: WaitingReferral): BoardPick =>
    referral.kind === "movement"
      ? { kind: "movement", movementId: referral.id, name: referral.name, secureBedNeeded: referral.secureBedNeeded }
      : {
          kind: "referral",
          referralId: referral.id,
          accepted: referral.accepted,
          name: referral.name,
          secureBedNeeded: referral.secureBedNeeded,
        };
  const waitChips = (
    <>
      {waiting.map((waitingReferral) => {
        const referral = bedManagerReason ? { ...waitingReferral, blockedReason: bedManagerReason } : waitingReferral;
        const isMovement = referral.kind === "movement";
        const on =
          (picked?.kind === "referral" && !isMovement && picked.referralId === referral.id) ||
          (picked?.kind === "movement" && isMovement && picked.movementId === referral.id);
        const reasonId = `ward-board-wait-${referral.id}-reason`;
        const canDrag = !isPhone && !referral.blockedReason;
        return (
          <li key={referral.id} className={styles.chipWrap}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={on}
              aria-disabled={referral.blockedReason ? true : undefined}
              aria-describedby={referral.blockedReason ? reasonId : undefined}
              data-testid={`ward-board-pick-${referral.id}`}
              draggable={canDrag ? true : undefined}
              onDragStart={
                canDrag
                  ? (event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", referral.id);
                      if (!on) onPick(pickFor(referral));
                    }
                  : undefined
              }
              onClick={() => {
                if (referral.blockedReason) return;
                setConfirm(null);
                onPick(on ? null : pickFor(referral));
              }}
            >
              <span className={styles.chipTop}>
                <StatusGlyph tone={referral.waitedMinutes >= 240 ? "warning" : "neutral"} size={10} />
                <span className={styles.chipName}>{nameFor(referral.name, referral.umrn)}</span>
              </span>
              <span className={styles.chipMeta}>
                {referral.sex} · waited <span className={styles.mono}>{durMinutes(referral.waitedMinutes)}</span>
              </span>
              {referral.accepted || referral.secureBedNeeded ? (
                <span className={styles.chipTags}>
                  {referral.accepted ? <span className={styles.pill}>Accepted</span> : null}
                  {referral.secureBedNeeded ? <span className={styles.pill}>Needs a locked bed</span> : null}
                </span>
              ) : null}
            </button>
            {referral.blockedReason ? <DisabledReason id={reasonId}>{referral.blockedReason}</DisabledReason> : null}
          </li>
        );
      })}
      {picked?.kind === "stay" ? (
        <li className={styles.chipWrap}>
          <button
            type="button"
            className={styles.chip}
            aria-pressed="true"
            onClick={() => {
              setConfirm(null);
              onPick(null);
            }}
          >
            <span className={styles.chipTop}>
              <StatusGlyph tone="info" size={10} />
              <span className={styles.chipName}>
                {nameFor(picked.name, beds.find((bed) => Number(bed.bedNumber) === picked.fromBed)?.umrn)}
              </span>
            </span>
            <span className={styles.chipMeta}>
              Moving from bed <span className={styles.mono}>{bedNumberLabel(picked.fromBed)}</span>
            </span>
          </button>
        </li>
      ) : null}
      {waiting.length === 0 && picked?.kind !== "stay" ? (
        <li className={styles.none}>Nobody waiting for a bed. To move someone, open their bed.</li>
      ) : null}
    </>
  );

  // Escape inside the confirm closes only the question; the pick stays up (the screen's own Escape
  // puts it down, and skips an event already handled here).
  const planRef = useRef<HTMLDivElement>(null);
  const closeConfirm = () => {
    const bedNumber = confirming === null ? null : String(confirming.bedNumber);
    setConfirm(null);
    if (bedNumber !== null) {
      planRef.current?.querySelector<HTMLElement>(`[data-testid="ward-board-bed-${bedNumber}"]`)?.focus();
    }
  };
  const cancelOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeConfirm();
  };

  const question = picked && confirming ? placeQuestion(picked, Number(confirming.bedNumber)) : null;
  const confirmBar =
    question && confirming ? (
      <div className={styles.confirm} role="group" aria-label="Confirm the bed" data-testid="ward-board-confirm">
        <span className={styles.confirmText}>
          <b>{question.ask}</b>
          <span>{fitReason(confirming, picked!, isMixed)}</span>
        </span>
        <span className={styles.confirmActions}>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            onKeyDown={cancelOnEscape}
            onClick={closeConfirm}
          >
            Choose another bed
          </button>
          <button
            ref={sendRef}
            type="button"
            className={buttonClass({ variant: "pri", size: "sm" })}
            data-testid="ward-board-confirm-send"
            onKeyDown={cancelOnEscape}
            onClick={() => {
              closeConfirm();
              onBedPress(confirming);
            }}
          >
            {question.send}
          </button>
        </span>
      </div>
    ) : null;

  const sayRow = (
    <div className={styles.say} hidden={confirmBar !== null ? true : undefined}>
      <span className={styles.sayText} aria-live="polite" data-testid="ward-board-say">
        {say || BOARD_RESTING_SAY}
      </span>
      {picked ? (
        <button
          type="button"
          className={buttonClass({ variant: "sec", size: "sm" })}
          onClick={() => {
            setConfirm(null);
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
      ref={planRef}
      className={cx(styles.plan, pods.length > 1 && styles.planTwo)}
      data-picking={picked ? "true" : undefined}
      data-testid="ward-bed-board-plan"
    >
      {pods.map((pod, index) => {
        const podFree = boardReadyCounts(pod.beds).ready;
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
                style={{ "--cols": String(isPhone ? 3 : pods.length > 1 ? 4 : 6) } as CSSProperties}
              >
                {pod.beds.map((bed) => {
                  const fits = boardBedFits(beds, bed, picked, isMixed);
                  const source = picked?.kind === "stay" && picked.fromBed === Number(bed.bedNumber);
                  const glyph = bedGlyphTone(bed);
                  const dim = picked ? !fits && !source : !matchesQuery(bed, query);
                  const label = cellLabel(bed, fits, nameFor);
                  const chosen = confirming !== null && Number(confirming.bedNumber) === Number(bed.bedNumber);
                  return (
                    <button
                      key={bed.bedNumber}
                      type="button"
                      className={styles.cell}
                      data-state={bed.heldFor ? "held" : bed.preparing ? "preparing" : String(bed.status)}
                      data-fits={fits ? "true" : undefined}
                      data-chosen={chosen ? "true" : undefined}
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
                        chooseBed(bed);
                      }}
                      onDragOver={
                        fits
                          ? (event) => {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                            }
                          : undefined
                      }
                      onDrop={
                        fits
                          ? (event) => {
                              event.preventDefault();
                              chooseBed(bed);
                            }
                          : undefined
                      }
                    >
                      <span className={styles.cellTop}>
                        <span className={styles.cellNo}>{bedNumberLabel(bed.bedNumber)}</span>
                        {bed.criteriaLedChip ? (
                          <CriteriaLedTag chip={bed.criteriaLedChip} short />
                        ) : glyph ? (
                          <StatusGlyph tone={glyph} size={10} />
                        ) : null}
                      </span>
                      <span className={styles.cellState}>
                        <CellWord bed={bed} collidingPairs={collidingPairs} />
                      </span>
                      {fits && picked ? (
                        <span className={styles.cellReason} aria-hidden="true">
                          {fitReason(bed, picked, isMixed)}
                        </span>
                      ) : (
                        <span className={styles.cellSub} aria-hidden="true">
                          {cellSub(bed)}
                        </span>
                      )}
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
      <span className={styles.stepLabel}>Coming free today</span>
      {leavingToday.length === 0 ? (
        <span className={styles.none}>Nothing else today</span>
      ) : (
        leavingToday.map((bed) => (
          <button
            key={bed.bedNumber}
            type="button"
            className={styles.soonChip}
            onClick={() => {
              chooseBed(bed);
            }}
          >
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
            <List strokeWidth={1.75} size={14} aria-hidden="true" />
            {isPhone ? "List" : "Every bed list"}
          </button>
        }
      />
      <div className={styles.waitStrip}>
        <span className={styles.stepLabel} id="ward-board-step-who">
          Who needs a bed
        </span>
        <ul className={styles.waitlist} aria-labelledby="ward-board-step-who" data-testid="ward-board-waitlist">
          {waitChips}
        </ul>
      </div>
      <div className={styles.body}>
        <span className={styles.stepLabel}>
          {picked ? "Choose a lit bed" : "Choose a bed"}
          {picked && !isPhone && waiting.length > 0 ? (
            <span className={styles.stepHint}>or drag the person onto it</span>
          ) : null}
        </span>
        {plan}
        {confirmBar}
        {sayRow}
        {soon}
      </div>
      <div className={styles.foot}>
        {legend}
        <span className={styles.footHint}>Keyboard: Enter chooses, Enter again confirms, Escape puts down</span>
      </div>
    </Card>
  );
}
