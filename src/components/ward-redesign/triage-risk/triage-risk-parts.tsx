"use client";

/**
 * Triage and risk mock-up: the small shared parts each section is built from, all on the kit
 * (Card, Segmented, FilterChip, Button, StatusGlyph). Nothing here is pre-selected: a choice with no
 * answer shows no option chosen, and a second press on the chosen option clears it.
 */
import { BookOpen, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  FilterChip,
  Segmented,
  SrOnly,
  StatusGlyph,
} from "@/components/wf";
import { phoneRows } from "@/components/wf/phone-rows";

import type { GuideGroup, SectionId } from "./triage-risk-data";
import type { SectionStatus, TextKey, TriageState } from "./triage-risk-state";
import { headingFilled, guideHeadings } from "./triage-risk-text";
import styles from "./triage-risk-redesign.module.css";

/** What each section needs from the form: the state and the ways to change it. */
export type FormApi = {
  state: TriageState;
  update: (change: (state: TriageState) => TriageState) => void;
  set: <K extends keyof TriageState>(key: K, value: TriageState[K]) => void;
  setText: (key: TextKey, value: string) => void;
  /** A short outcome, shown as a toast and read out politely. */
  say: (message: string) => void;
  isPhone: boolean;
  openSummary: (tab?: string) => void;
};

type Option = readonly [value: string, label: string] | string;
const optionValue = (option: Option) => (typeof option === "string" ? option : option[0]);
const optionLabel = (option: Option) => (typeof option === "string" ? option : option[1]);

/** A label beside its control (stacked on a phone). */
export function Row({
  label,
  hint,
  labelId,
  htmlFor,
  top = false,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  labelId?: string;
  htmlFor?: string;
  top?: boolean;
  children: ReactNode;
}) {
  const head = (
    <>
      {label}
      {hint ? <small className={styles.rowHint}>{hint}</small> : null}
    </>
  );
  return (
    <div className={styles.row} data-top={top ? "" : undefined}>
      {htmlFor ? (
        <label className={styles.rowLabel} htmlFor={htmlFor} id={labelId}>
          {head}
        </label>
      ) : (
        <div className={styles.rowLabel} id={labelId}>
          {head}
        </div>
      )}
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

/** One of a few, nothing chosen until pressed; pressing the chosen one clears it. */
export function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Segmented
      size="md"
      label={label}
      className={styles.choice}
      items={options.map((option) => ({ id: optionValue(option), label: optionLabel(option) }))}
      value={value ?? ""}
      onChange={(id) => onChange(id === value ? null : id)}
    />
  );
}

/** Any number of a few, as kit filter chips: one row that slides sideways on a phone (the kit's). */
export function MultiChips({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly Option[];
  values: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <ChipGroup label={label} className={phoneRows.chipRow}>
      {options.map((option) => (
        <FilterChip
          key={optionValue(option)}
          className={phoneRows.chip}
          pressed={values.includes(optionValue(option))}
          onPressedChange={() => onToggle(optionValue(option))}
        >
          {optionLabel(option)}
        </FilterChip>
      ))}
    </ChipGroup>
  );
}

/** The tick or ring and its words for a section: Done, n to check, or n needed. */
export function StatusMark({ status, withText = true }: { status: SectionStatus; withText?: boolean }) {
  const text = status.needed ? `${status.needed} needed` : status.toCheck ? `${status.toCheck} to check` : "Done";
  return (
    <span className={styles.status}>
      <StatusGlyph tone={status.done ? "success" : "neutral"} size={10} />
      {withText ? <span>{text}</span> : <SrOnly>{text}</SrOnly>}
    </span>
  );
}

/** A numbered form section on the kit card. */
export function SectionCard({
  id,
  n,
  title,
  sub,
  status,
  children,
}: {
  id: SectionId;
  n: number;
  title: string;
  sub: string;
  status: SectionStatus;
  children: ReactNode;
}) {
  const headingId = `triage-h-${id}`;
  return (
    <Card
      id={`triage-${id}`}
      aria-labelledby={headingId}
      className={styles.section}
      data-section={id}
      data-done={status.done ? "" : undefined}
    >
      <CardHead
        id={headingId}
        title={
          <>
            <span className={styles.secNum} aria-hidden="true">
              {n}
            </span>
            {title}
          </>
        }
        meta={<span className={styles.secSub}>{sub}</span>}
        aside={<StatusMark status={status} />}
      />
      <CardBody className={styles.sectionBody}>{children}</CardBody>
    </Card>
  );
}

/** A quiet panel that appears when an answer needs more (an act-now panel takes the act tint). */
export function Reveal({ children, act = false }: { children: ReactNode; act?: boolean }) {
  return (
    <div className={styles.reveal} data-act={act ? "" : undefined}>
      {children}
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

/** A "Look for" or similar disclosure: the button and the text it shows. */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const id = useId();
  return {
    open,
    toggle: () => setOpen((value) => !value),
    buttonProps: { "aria-expanded": open, "aria-controls": id },
    panelId: id,
  };
}

/** "What to cover": the toggle with its count, and the panel of headings that adds one when tapped. */
export function GuideBox({
  groups,
  text,
  onHeading,
  columns = 3,
  extra,
}: {
  groups: readonly GuideGroup[];
  text: string;
  onHeading: (heading: string) => void;
  columns?: 2 | 3;
  extra?: ReactNode;
}) {
  const guide = useDisclosure(false);
  const all = guideHeadings(groups);
  const covered = all.filter((h) => headingFilled(text, h)).length;
  return (
    <>
      <div className={styles.guideBar}>
        <Button
          size="sm"
          icon={BookOpen}
          iconEnd={ChevronDown}
          className={phoneRows.chip}
          onClick={guide.toggle}
          {...guide.buttonProps}
        >
          What to cover{" "}
          <span className={styles.mono}>
            {covered} of {all.length}
          </span>
        </Button>
        {extra}
      </div>
      {guide.open ? (
        <div id={guide.panelId} className={styles.guidePanel} data-columns={columns}>
          {groups.map(([title, items]) => (
            <div key={title}>
              <h3 className={styles.guideHead}>{title}</h3>
              {items.map(([heading, cover]) => (
                <button key={heading} type="button" className={styles.guideItem} onClick={() => onHeading(heading)}>
                  <StatusGlyph tone={headingFilled(text, heading) ? "success" : "neutral"} size={10} />
                  <span>
                    <span className={styles.guideTitle}>{heading}</span>
                    <span className={styles.guideText}>{cover}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Rows for a textarea that grows with what is typed. */
export const autoRows = (text: string, min: number) => Math.max(min, text.split("\n").length + 1);
