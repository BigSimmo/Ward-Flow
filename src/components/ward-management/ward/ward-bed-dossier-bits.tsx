"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import type { BedItem } from "./ward-bed-tone";
import { Button, Menu, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";

import styles from "./ward-bed-dossier-drawer.module.css";
import { useOptionalRouter } from "./ward-screen-helpers";

/** Shortens "Form 6A Involuntary inpatient" to "Form 6A" for the fact tile; the full label stays in Overview. */
export function shortLegal(label: string | undefined): string {
  if (!label) return "Not recorded";
  // WT-03: "Form 6A not recorded (Form 1A ended ...)" keeps its "not recorded" on the tile.
  if (label.includes(" not recorded (")) return label.split(" (")[0]!;
  // Redesign: the tile keeps one short line, so a community treatment order reads "CTO" (full words in Overview).
  if (label.startsWith("Community treatment order")) return "CTO";
  return label.startsWith("Form ") ? label.split(" ").slice(0, 2).join(" ") : label;
}

export function Row({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <dt className={styles.kvDt}>{label}</dt>
      <dd className={cx(styles.kvDd, wide && styles.kvWide)}>{children}</dd>
    </>
  );
}

export function FactTile({ label, value, tone }: { label: string; value: string; tone?: WfTone | null }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <b className={styles.factValue} title={value}>
        {tone ? <StatusGlyph tone={tone} /> : null}
        <span className={styles.ell}>{value}</span>
      </b>
    </div>
  );
}

/** One step the bed record offers, in the order the More list shows them. */
export type BedAction = {
  id: "leave" | "blocker" | "ed" | "move" | "referral" | "full-referral";
  label: string;
  onAction?: () => void;
  href?: string;
  disabledReason?: string;
  describedBy?: string;
  expanded?: boolean;
  testId?: string;
};

/**
 * Redesign (review notes): which step is the filled one follows the stay, as the phone sheet
 * already did (A1-13). Held up means Update blocker; away at an ED means Mark them back; due out or
 * past the ward's own date means Record that they have left. A settled stay has no filled step.
 */
export function mainActionId(bedItem: BedItem | undefined, isOccupied: boolean): BedAction["id"] | null {
  if (!isOccupied || !bedItem?.admissionId) return null;
  if (bedItem.blockReason) return "blocker";
  if (bedItem.awayAtEdHours != null) return "ed";
  const leaving = bedItem.dischargeConfirmed === true || (bedItem.expectedDays != null && bedItem.expectedDays <= 0);
  return leaving || bedItem.pastDate ? "leave" : null;
}

/**
 * Redesign: one filled step, one plain step, and the rest under More. Every step does what it does
 * today. Patient page moves up beside the name.
 */
export function BedActions({
  actions,
  mainId,
  phone = false,
}: {
  actions: BedAction[];
  mainId: BedAction["id"] | null;
  phone?: boolean;
}) {
  const router = useOptionalRouter();
  const main = actions.find((action) => action.id === mainId);
  const rest = actions.filter((action) => action !== main);
  const second = rest.find((action) => !action.href);
  const more = rest.filter((action) => action !== second);
  const draw = (action: BedAction, variant: "pri" | "sec") =>
    action.href ? (
      <Link
        key={action.id}
        className={buttonClass({ variant, size: "lg", className: styles.pill })}
        href={action.href}
        data-testid={action.testId}
      >
        {action.label}
      </Link>
    ) : (
      <Button
        key={action.id}
        variant={variant}
        size="lg"
        className={styles.pill}
        disabledReason={action.disabledReason}
        aria-describedby={action.describedBy}
        aria-expanded={action.expanded}
        data-testid={action.testId}
        onClick={action.onAction}
      >
        {action.label}
      </Button>
    );
  return (
    <div className={cx(styles.actions, phone && styles.actionsPhone)} data-testid="bed-record-actions">
      {main ? draw(main, "pri") : null}
      {second ? draw(second, "sec") : null}
      {more.length > 0 ? (
        <Menu
          label="More bed steps"
          align={phone ? "end" : "start"}
          items={more.map((action) => ({
            id: action.id,
            label: action.label,
            disabled: action.disabledReason !== undefined,
            meta: action.disabledReason,
            onSelect: () => {
              if (action.href) {
                if (router) router.push(action.href);
                else window.location.assign(action.href);
              } else action.onAction?.();
            },
          }))}
          trigger={(props) => (
            <Button {...props} variant="sec" size="lg" iconEnd={ChevronDown} className={styles.pill}>
              More
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}

/**
 * Redesign (review notes): a notice that says why the person has not left yet, from what the ward
 * has recorded. Nothing here is worked out from a legal time.
 */
export function NotLeftNotice({
  bedItem,
  expectedPlan,
  isOccupied,
}: {
  bedItem: BedItem | undefined;
  expectedPlan: string;
  isOccupied: boolean;
}) {
  if (!isOccupied || !bedItem?.admissionId) return null;
  let tone: WfTone = "neutral";
  let text: string;
  if (bedItem.blockReason) {
    tone = "danger";
    text = `Held up: ${bedItem.blockReason}.`;
  } else if (bedItem.awayAtEdHours != null) {
    tone = "warning";
    text = `Away at an ED for ${bedItem.awayAtEdHours}h. The bed is held for them.`;
  } else if (bedItem.pastDate) {
    // Redesign: the date is on the Going out tile and in Plan to leave; the notice gives the reason only.
    tone = "warning";
    text = "Nothing is recorded as holding them up.";
  } else if (bedItem.dischargeBarrier) {
    tone = "warning";
    text = `Long-stay reason: ${bedItem.dischargeBarrier}.`;
  } else if (bedItem.status === "incoming") {
    text = "Not on the ward yet.";
  } else {
    text = `Not due to leave yet. Expected: ${expectedPlan}.`;
  }
  return (
    <p className={styles.notLeft} data-tone={tone} data-testid="bed-record-not-left">
      <StatusGlyph tone={tone} />
      <span>
        <b>Why they have not left. </b>
        {text}
      </span>
    </p>
  );
}
