"use client";

// Ward home's bed tile words (WH5, 3 Nov 2026). Wave 4 (D-191) retired the This shift and today's bed
// flow strip that lived here: Coming and going and the hero's "Open this shift" replace it.

import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import type { MovementStage } from "@/components/ward-management/ward-model";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { nameParts } from "./ward-bed-board-logic";
import styles from "./ward-home-tab.module.css";
import outageTag from "./ward-outage-bed-tag.module.css";
import { NOT_CONFIRMED_SINCE_OUTAGE } from "@/components/ward-management/use-outage-catch-up";

/**
 * WH5 (3 Nov 2026): a bed tile's words, as the bed board draws a bed. Surname, then the given name on
 * its own line, then one short state line ("210d", "On leave · 12d"). `name` is null for a free bed.
 * Audit B16 (5 Nov 2026): the formal name reads in full, with its comma ("Ferrowmoor," then
 * "Gareth"), as the phone round list and the board show it; every given name is kept.
 */
/** "Surname, Given Names" as its two parts, every given name kept; a plain "Given Surname" is read too. */
function formalParts(name: string): { last: string; given: string } | null {
  const comma = name.indexOf(",");
  if (comma > 0) {
    const last = name.slice(0, comma).trim();
    const given = name.slice(comma + 1).trim();
    return last && given ? { last, given } : null;
  }
  return nameParts(name);
}

/**
 * FM-11 (Ward notes item 9): a pulled bed's state line, "Pulled · moving" or "Pulled · handover ready",
 * then its hold time (Audit A1-3). The stage word is the journey's own short label (`stageCopy`), in
 * lower case after "Pulled"; a journey still at the pulled stage adds nothing to "Pulled".
 */
export function pulledTileNote(stage: MovementStage | undefined, holdShort: string | undefined): string {
  const stageWord = stage === undefined || stage === "pulled" ? "" : stageCopy[stage].shortLabel.toLowerCase();
  return [BED_STATE_LABELS.pulled, stageWord, holdShort ?? ""].filter(Boolean).join(" · ");
}

/** The tile's state line as drawn ("Held up · 210d"); an occupied bed's plain state is left out. */
export function tileStateLine(note: string, days: string): string {
  return [note === BED_STATE_LABELS.occupied ? "" : note, days].filter(Boolean).join(" · ");
}

export function WardHomeTileText({
  name,
  label,
  note,
  days,
  outage = false,
  pulledFor = false,
}: {
  name: string | null;
  label: string;
  note: string;
  days: string;
  /** Batch 4 item 25 (D-142): the bed is not confirmed since the recorded outage. */
  outage?: boolean;
  /** FM-11: a pulled bed is held for the person named, so "For" sits above the name. */
  pulledFor?: boolean;
}) {
  const parts = name === null ? null : formalParts(name);
  const stateLine = tileStateLine(note, days);
  return (
    <>
      {pulledFor && parts ? (
        <span className={styles.bedTileFor} aria-hidden="true">
          For
        </span>
      ) : null}{" "}
      <span className={styles.bedTileName} data-wrap={parts ? undefined : "true"} aria-hidden="true">
        {parts ? `${parts.last},` : label}
      </span>{" "}
      {parts ? (
        <span className={styles.bedTileGiven} aria-hidden="true">
          {` ${parts.given}`}
        </span>
      ) : null}{" "}
      <span className={styles.bedTileState} aria-hidden="true">
        <span className={styles.bedTileNote}>{stateLine}</span>
      </span>
      {outage ? (
        <span className={outageTag.tile} aria-hidden="true">
          {NOT_CONFIRMED_SINCE_OUTAGE}
        </span>
      ) : null}
    </>
  );
}
