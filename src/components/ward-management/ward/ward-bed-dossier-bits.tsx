"use client";

import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { ChevronDown } from "lucide-react";

import type { BedItem } from "./ward-bed-tone";
import { Button, ChipGroup, FilterChip, Menu, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";

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

/**
 * WH1 (Josh, 3 Nov 2026): a pick one list drawn as kit chips in place of a browser drop-down. The
 * chosen chip is pressed; pressing it again keeps it, so there is always one answer. The group is
 * focused through `groupRef` when an editor opens on it.
 */
export function ChoiceChips<T extends string>({
  label,
  items,
  value,
  onChange,
  testId,
  groupRef,
  className,
}: {
  label: string;
  items: readonly { id: T; label: string }[];
  value: T | "";
  onChange: (id: T) => void;
  testId?: string;
  groupRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div ref={groupRef} className={cx(styles.choice, className)} data-testid={testId} data-value={value}>
      <ChipGroup label={label}>
        {items.map((item) => (
          <FilterChip
            key={item.id}
            pressed={item.id === value}
            onPressedChange={() => {
              if (item.id !== value) onChange(item.id);
            }}
          >
            {item.label}
          </FilterChip>
        ))}
      </ChipGroup>
    </div>
  );
}

/** Focuses the pressed chip in a `ChoiceChips` group, or its first chip when none is pressed. */
export function focusChoice(group: HTMLDivElement | null) {
  const target =
    group?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? group?.querySelector("button");
  target?.focus();
}

/** One stay, as the hero's step track reads it: on the ward, a date set, confirmed, left. */
export function StaySteps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className={styles.steps} aria-label="Plan to leave steps" data-testid="bed-record-steps">
      {steps.map((label, index) => (
        <li
          key={label}
          data-state={index < current ? "done" : index === current ? "now" : "next"}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={styles.stepDot} aria-hidden="true" />
          <span className={styles.stepLabel}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** One step the bed record offers, in the order the More list shows them. */
export type BedAction = {
  id: "leave" | "plan" | "blocker" | "ed" | "move" | "referral" | "full-referral";
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
  if (leaving || bedItem.pastDate) return "leave";
  // WH1 appraisal: a stay with no plan to leave has one obvious next step, setting the date.
  return hasNoLeavingDate(bedItem) ? "plan" : null;
}

/** No expected discharge recorded for this stay. */
export function hasNoLeavingDate(bedItem: BedItem): boolean {
  return bedItem.expectedDays == null && !bedItem.expectedDischargeLabel;
}

/**
 * Redesign: one filled step, one plain step, and the rest under More. Every step does what it does
 * today. Patient page moves up beside the name.
 */
export function BedActions({
  actions,
  mainId,
  phone = false,
  band = false,
}: {
  actions: BedAction[];
  mainId: BedAction["id"] | null;
  phone?: boolean;
  /** WH1: in the drawer's foot band, the filled step full width above the others (light kit foot, 6 Nov 2026). */
  band?: boolean;
}) {
  const router = useOptionalRouter();
  const main = actions.find((action) => action.id === mainId);
  const rest = actions.filter((action) => action !== main);
  const second = rest.find((action) => !action.href);
  const more = rest.filter((action) => action !== second);
  const size = band ? "md" : "lg";
  const plain = "sec";
  const draw = (action: BedAction, variant: "pri" | "sec" | "onHero", className?: string) =>
    action.href ? (
      <Link
        key={action.id}
        className={buttonClass({ variant, size, className: cx(styles.pill, className) })}
        href={action.href}
        data-testid={action.testId}
      >
        {action.label}
      </Link>
    ) : (
      <Button
        key={action.id}
        variant={variant}
        size={size}
        className={cx(styles.pill, className)}
        disabledReason={action.disabledReason}
        aria-describedby={action.describedBy}
        aria-expanded={action.expanded}
        data-testid={action.testId}
        onClick={action.onAction}
      >
        {action.label}
      </Button>
    );
  const menu =
    more.length > 0 ? (
      <Menu
        label="More bed steps"
        align={phone || band ? "end" : "start"}
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
          <Button {...props} variant={plain} size={size} iconEnd={ChevronDown} className={styles.pill}>
            More
          </Button>
        )}
      />
    ) : null;
  if (band) {
    return (
      <div className={styles.bandActions} data-testid="bed-record-actions">
        {main ? draw(main, "pri", styles.bandMain) : null}
        {second || menu ? (
          <div className={styles.bandRow}>
            {second ? draw(second, plain) : null}
            {menu}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cx(styles.actions, phone && styles.actionsPhone)} data-testid="bed-record-actions">
      {main ? draw(main, "pri") : null}
      {second ? draw(second, plain) : null}
      {menu}
    </div>
  );
}

/**
 * Redesign (review notes): why the person has not left yet, from what the ward has recorded, with
 * one short word for the hero's pill. Nothing here is worked out from a legal time.
 */
export function stayStatus(
  bedItem: BedItem | undefined,
  expectedPlan: string,
): { tone: WfTone; word: string; text: string } | null {
  if (!bedItem?.admissionId) return null;
  if (bedItem.blockReason) return { tone: "danger", word: "Held up", text: `Held up: ${bedItem.blockReason}.` };
  if (bedItem.awayAtEdHours != null)
    return {
      tone: "warning",
      word: "At an ED",
      text: `Away at an ED for ${bedItem.awayAtEdHours}h. The bed is held for them.`,
    };
  // Redesign: the date is on the Going out fact and in Leaving; the line gives the reason only.
  if (bedItem.pastDate) return { tone: "warning", word: "Past date", text: "Nothing is recorded as holding them up." };
  if (bedItem.dischargeBarrier)
    return { tone: "warning", word: "Long stay", text: `Long-stay reason: ${bedItem.dischargeBarrier}.` };
  if (bedItem.status === "incoming") return { tone: "neutral", word: "Arriving", text: "Not on the ward yet." };
  if (bedItem.dischargeConfirmed === true || (bedItem.expectedDays != null && bedItem.expectedDays <= 0))
    return { tone: "info", word: "Discharge due", text: `Due to leave. Expected: ${expectedPlan}.` };
  // A stay with no plan to leave says what to do, not that nothing is known.
  if (hasNoLeavingDate(bedItem))
    return { tone: "neutral", word: "On the ward", text: "No leaving date yet. Set one under Leaving." };
  return { tone: "neutral", word: "On the ward", text: `Not due to leave yet. Expected: ${expectedPlan}.` };
}

/** The phone sheet's notice: why the person has not left yet, as the desktop hero's line says it. */
export function NotLeftNotice({
  bedItem,
  expectedPlan,
  isOccupied,
}: {
  bedItem: BedItem | undefined;
  expectedPlan: string;
  isOccupied: boolean;
}) {
  const status = isOccupied ? stayStatus(bedItem, expectedPlan) : null;
  if (!status) return null;
  return (
    <p className={styles.notLeft} data-tone={status.tone} data-testid="bed-record-not-left">
      <StatusGlyph tone={status.tone} />
      <span>
        <b>Why they have not left. </b>
        {status.text}
      </span>
    </p>
  );
}
