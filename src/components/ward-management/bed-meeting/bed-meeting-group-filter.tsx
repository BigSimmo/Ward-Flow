"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { Button, ChipGroup, FilterChip, Popover, Sheet, ShowMoreRow, cx, useIsPhone } from "@/components/wf";

import {
  AGENDA_GROUP_FACETS,
  AGENDA_GROUP_FACET_LABELS,
  type AgendaGroupFacet,
  type AgendaGroupFilter,
  type AgendaGroupOption,
} from "./bed-meeting-groups";
import styles from "./bed-meeting-agenda.module.css";

const WARDS_SHOWN = 6;

/** Adds or takes away one value in one facet, leaving the rest as they were. */
export function toggleGroup(current: AgendaGroupFilter, facet: AgendaGroupFacet, value: string): AgendaGroupFilter {
  const next = new Set(current[facet] ?? []);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return { ...current, [facet]: next };
}

/**
 * B1 extended (Josh, 4 Nov 2026): one quiet Filter button beside the list chips. It opens a small
 * panel of the groups on today's agenda, each with how many people, so the chair narrows the
 * meeting to a ward, a tier, a legal status or an age group in two taps. Facets combine (Tier 1 on
 * one ward); values inside a facet add up (Tier 1 or 2). Nothing typed, nothing stored.
 */
export function AgendaGroupFilterControl({
  options,
  value,
  onChange,
  onHero = false,
}: {
  options: Record<AgendaGroupFacet, AgendaGroupOption[]>;
  value: AgendaGroupFilter;
  onChange: (next: AgendaGroupFilter) => void;
  /** Page tops (Josh, 9 Nov 2026): drawn as one of the slate's quick chips. */
  onHero?: boolean;
}) {
  const [allWards, setAllWards] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const phoneTrigger = useRef<HTMLButtonElement>(null);
  const phone = useIsPhone();
  const chosen = AGENDA_GROUP_FACETS.reduce((total, facet) => total + (value[facet]?.size ?? 0), 0);
  const facets = AGENDA_GROUP_FACETS.filter((facet) => options[facet].length > 1 || (value[facet]?.size ?? 0) > 0);
  if (facets.length === 0) return null;
  // Statewide there can be 25 wards: the busiest six show, the rest one tap away. A chosen ward
  // always shows, so it can be taken off here too.
  const shownOptions = (facet: AgendaGroupFacet) =>
    facet !== "ward" || allWards
      ? options[facet]
      : options.ward.filter((option, index) => index < WARDS_SHOWN || (value.ward?.has(option.value) ?? false));
  const panel = (done: () => void) => (
    <div className={styles.groupBody} data-testid="bed-meeting-agenda-groups-panel">
      {facets.map((facet) => (
        <div key={facet} className={styles.groupFacet}>
          <span className={styles.groupHead} aria-hidden="true">
            {AGENDA_GROUP_FACET_LABELS[facet]}
          </span>
          <ChipGroup label={AGENDA_GROUP_FACET_LABELS[facet]} className={styles.formKinds}>
            {shownOptions(facet).map((option) => (
              <FilterChip
                key={option.value}
                pressed={value[facet]?.has(option.value) ?? false}
                count={option.count}
                onPressedChange={() => onChange(toggleGroup(value, facet, option.value))}
              >
                {option.label}
              </FilterChip>
            ))}
          </ChipGroup>
          {facet === "ward" && options.ward.length > WARDS_SHOWN ? (
            <ShowMoreRow onClick={() => setAllWards((open) => !open)} expanded={allWards}>
              {allWards ? "Show fewer wards" : `Show all ${options.ward.length} wards`}
            </ShowMoreRow>
          ) : null}
        </div>
      ))}
      <div className={styles.groupFoot}>
        {chosen > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => onChange({})}>
            Clear all
          </Button>
        ) : null}
        <Button size="sm" variant="pri" onClick={done}>
          Done
        </Button>
      </div>
    </div>
  );
  const trigger = (props: Record<string, unknown>) =>
    onHero ? (
      <button {...props} type="button" className={styles.heroChip} data-testid="bed-meeting-agenda-groups">
        <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
        Filter
        {chosen > 0 ? <b className={styles.heroChipCount}>{chosen}</b> : null}
      </button>
    ) : (
      <Button
        {...props}
        size="sm"
        variant="ghost"
        icon={SlidersHorizontal}
        count={chosen > 0 ? chosen : undefined}
        className={styles.groupTrigger}
        data-testid="bed-meeting-agenda-groups"
      >
        Filter
      </Button>
    );
  // Josh (4 Nov 2026): a bottom sheet on a phone, easy with one thumb, as the kit's long-list picker.
  if (phone) {
    return (
      <span className={cx(styles.groupFilter, onHero && styles.groupFilterOnHero)}>
        {trigger({
          ref: phoneTrigger,
          "aria-haspopup": "dialog",
          "aria-expanded": sheetOpen,
          onClick: () => setSheetOpen(true),
        })}
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filter the agenda"
          mobileBreakpoint="phone"
          returnFocusRef={phoneTrigger}
        >
          {sheetOpen ? panel(() => setSheetOpen(false)) : null}
        </Sheet>
      </span>
    );
  }
  return (
    <Popover
      label="Filter the agenda by group"
      align="end"
      className={cx(styles.groupFilter, onHero && styles.groupFilterOnHero)}
      panelClassName={styles.groupPanel}
      trigger={trigger}
    >
      {(close) => panel(() => close())}
    </Popover>
  );
}
