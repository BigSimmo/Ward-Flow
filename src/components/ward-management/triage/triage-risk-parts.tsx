"use client";

/**
 * Triage and risk: the small shared parts each section is built from, all on the kit
 * (Card, Segmented, FilterChip, Button, StatusGlyph). Nothing here is pre-selected: a choice with no
 * answer shows no option chosen, and a second press on the chosen option clears it.
 */
import { BookOpen, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode, type RefObject } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  FilterChip,
  ListPicker,
  Segmented,
  Sheet,
  SrOnly,
  StatusGlyph,
  TextInput,
  phoneRows,
  useIsPhone,
  type ListPickerOption,
} from "@/components/wf";

import type { GuideGroup, SectionId } from "./triage-risk-data";
import type { SectionStatus, Target, TextKey, TriageState } from "./triage-risk-state";
import { headingFilled, guideHeadings } from "./triage-risk-text";
import styles from "./triage-risk-form.module.css";

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
  /** The real moment now (board clock), refreshed each minute: a reviewed time may not pass it. */
  now: number;
  /** Closes any slide-out and goes to a section, or to the field a target names. */
  jump: (section: SectionId, target?: Target) => void;
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

/**
 * One of a few, nothing chosen until pressed; pressing the chosen one clears it. `id` names a
 * wrapper (no box of its own) so "Go to" can land on the group.
 */
export function Choice({
  label,
  options,
  value,
  onChange,
  id,
}: {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
}) {
  const group = (
    <Segmented
      size="md"
      label={label}
      className={styles.choice}
      items={options.map((option) => ({ id: optionValue(option), label: optionLabel(option) }))}
      value={value ?? ""}
      onChange={(next) => onChange(next === value ? null : next)}
    />
  );
  return id ? (
    <span id={id} className={styles.contents}>
      {group}
    </span>
  ) : (
    group
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

/** A webPSOLIS pick-list (`triage-psolis-lists.ts`): `[code, label, ...]`. Only the label is shown. */
type PickList = readonly (readonly [code: string, label: string, ...rest: unknown[]])[];

/** The detail an "Other" pick needs: a short typed box, kept in React state only. */
export type OtherDetail = { code: string; label: string; value: string; onChange: (value: string) => void };

/** The full list for More, each chosen one marked, grouped when `groupOf` names a group. */
function moreOptions(
  list: PickList,
  chosen: readonly string[],
  groupOf?: (code: string) => string | undefined,
): ListPickerOption[] {
  return list.map(([code, label]) => ({
    value: code,
    label,
    group: groupOf?.(code),
    hint: chosen.includes(code) ? "Chosen" : undefined,
  }));
}

/** The common codes, then any chosen one that is not common, so every choice shows and can be cleared. */
function shownCodes(list: PickList, common: readonly string[], chosen: readonly string[]) {
  const known = new Set(list.map(([code]) => code));
  return [
    ...common.filter((code) => known.has(code)),
    ...chosen.filter((code) => known.has(code) && !common.includes(code)),
  ];
}

const labelIn = (list: PickList, code: string) => list.find(([value]) => value === code)?.[1] ?? code;

/** "More": the kit's searchable long-list picker, opened from one field button. */
function MoreList({
  label,
  options,
  onChoose,
  testId,
}: {
  label: string;
  options: ListPickerOption[];
  onChoose: (code: string) => void;
  testId?: string;
}) {
  return (
    <div className={styles.pickMore}>
      <ListPicker
        label={label}
        placeholder="More"
        value={null}
        options={options}
        testId={testId}
        onChange={(code) => {
          if (code) onChoose(code);
        }}
      />
    </div>
  );
}

function OtherBox({ other, shown }: { other?: OtherDetail; shown: boolean }) {
  if (!other || !shown) return null;
  return (
    <TextInput
      aria-label={other.label}
      placeholder={other.label}
      autoComplete="off"
      boxClassName={styles.otherInput}
      value={other.value}
      onChange={(event) => other.onChange(event.target.value)}
    />
  );
}

/**
 * One from a long webPSOLIS list: the common options as tiles, then More for the full searchable
 * list. Nothing is chosen until pressed; a second press on the chosen tile clears it. A choice from
 * More that is not common shows as a tile too, so it can be cleared the same way.
 */
export function PickOne({
  label,
  noun,
  list,
  common,
  value,
  onChange,
  other,
  id,
}: {
  label: string;
  /** Plural, lower case, for "More venues". */
  noun: string;
  list: PickList;
  common: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  other?: OtherDetail;
  id?: string;
}) {
  const chosen = value ? [value] : [];
  const tiles = shownCodes(list, common, chosen).map((code) => [code, labelIn(list, code)] as const);
  return (
    <div className={styles.pick}>
      <Choice id={id} label={label} options={tiles} value={value} onChange={onChange} />
      <MoreList
        label={`More ${noun}`}
        options={moreOptions(list, chosen)}
        onChoose={(code) => onChange(code)}
        testId={id ? `${id}-more` : undefined}
      />
      <OtherBox other={other} shown={value === other?.code} />
    </div>
  );
}

/**
 * Any number from a long webPSOLIS list: the common options as chips, then More for the full
 * searchable list. Choices keep the order they were made (each new one is added at the end); a
 * second press, or choosing it again from More, removes it.
 */
export function PickMany({
  label,
  noun,
  list,
  common,
  values,
  onChange,
  groupOf,
  other,
  id,
}: {
  label: string;
  noun: string;
  list: PickList;
  common: readonly string[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** Puts the More list under group headings. */
  groupOf?: (code: string) => string | undefined;
  other?: OtherDetail;
  id?: string;
}) {
  const toggle = (code: string) =>
    onChange(values.includes(code) ? values.filter((v) => v !== code) : [...values, code]);
  const chips = shownCodes(list, common, values).map((code) => [code, labelIn(list, code)] as const);
  return (
    <div className={styles.pick} id={id}>
      <MultiChips label={label} options={chips} values={values} onToggle={toggle} />
      <MoreList
        label={`More ${noun}`}
        options={moreOptions(list, values, groupOf)}
        onChoose={toggle}
        testId={id ? `${id}-more` : undefined}
      />
      <OtherBox other={other} shown={Boolean(other && values.includes(other.code))} />
    </div>
  );
}

/** The tick or ring and its words for a section: Done, n to check, n needed (Mental state: n of 8). */
export function StatusMark({ status, withText = true }: { status: SectionStatus; withText?: boolean }) {
  return (
    <span className={styles.status}>
      <StatusGlyph tone={status.done ? "success" : "neutral"} size={10} />
      {withText ? <span>{status.text}</span> : <SrOnly>, {status.text}</SrOnly>}
    </span>
  );
}

/**
 * A finished section folded to one line (7 Nov 2026): the facts it holds and Change. Change, or
 * tabbing onto it, opens the section and puts focus on its first control.
 */
export type SectionFold = { folded: boolean; line: readonly string[]; onOpen: () => void };

/** A numbered form section on the kit card; with `fold`, it can fold to one line once finished. */
export function SectionCard({
  id,
  n,
  title,
  sub,
  status,
  fold,
  children,
}: {
  id: SectionId;
  n: number;
  title: string;
  sub: string;
  status: SectionStatus;
  fold?: SectionFold;
  children: ReactNode;
}) {
  const headingId = `triage-h-${id}`;
  const bodyId = `triage-body-${id}`;
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
      <CardBody className={styles.sectionBody}>
        {fold?.folded ? (
          <div className={styles.oneLine} data-testid={`triage-fold-${id}`}>
            {fold.line.map((bit) => (
              <span key={bit}>{bit}</span>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className={styles.pushEnd}
              data-fold-change=""
              aria-expanded={false}
              aria-controls={bodyId}
              aria-label={`Change ${title}`}
              onClick={fold.onOpen}
              onFocus={(event) => {
                // Tabbing in opens it; a press is handled by the click.
                if (event.currentTarget.matches(":focus-visible")) fold.onOpen();
              }}
            >
              Change
            </Button>
          </div>
        ) : null}
        {fold ? (
          <div id={bodyId} className={styles.foldBody} hidden={fold.folded} data-fold-body="">
            {children}
          </div>
        ) : (
          children
        )}
      </CardBody>
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
    close: () => setOpen(false),
    buttonProps: { "aria-expanded": open, "aria-controls": id },
    panelId: id,
  };
}

/**
 * "What to cover": the toggle with its count, and the headings that add one when tapped. On a
 * tablet or desktop the headings open in place under the toggle; on a phone (Josh, 8 Nov 2026) they
 * open in a bottom sheet, so the long list never pushes the note down the page. Tapping a heading
 * there adds it, closes the sheet and puts the cursor under the new heading.
 */
export function GuideBox({
  groups,
  text,
  onHeading,
  columns = 3,
  extra,
  textRef,
}: {
  groups: readonly GuideGroup[];
  text: string;
  onHeading: (heading: string) => void;
  columns?: 2 | 3;
  extra?: ReactNode;
  /** The note the headings go into: focus lands there when the phone sheet closes. */
  textRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const guide = useDisclosure(false);
  const isPhone = useIsPhone();
  const all = guideHeadings(groups);
  const covered = all.filter((h) => headingFilled(text, h)).length;
  const list = (
    <div id={guide.panelId} className={styles.guidePanel} data-columns={isPhone ? 1 : columns}>
      {groups.map(([title, items]) => (
        <div key={title}>
          <h3 className={styles.guideHead}>{title}</h3>
          {items.map(([heading, cover]) => (
            <button
              key={heading}
              type="button"
              className={styles.guideItem}
              onClick={() => {
                if (isPhone) guide.close();
                onHeading(heading);
              }}
            >
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
  );
  return (
    <>
      <div className={styles.guideBar}>
        <Button
          size="sm"
          icon={BookOpen}
          iconEnd={isPhone ? undefined : ChevronDown}
          className={phoneRows.chip}
          onClick={guide.toggle}
          {...(isPhone ? { "aria-haspopup": "dialog" as const, "aria-expanded": guide.open } : guide.buttonProps)}
        >
          What to cover{" "}
          <span className={styles.mono}>
            {covered} of {all.length}
          </span>
        </Button>
        {extra}
      </div>
      {isPhone ? (
        <Sheet
          open={guide.open}
          onClose={guide.close}
          title="What to cover"
          description={`${covered} of ${all.length} covered. Tap a heading to add it to the note.`}
          mobileSize="content"
          returnFocusRef={textRef}
          testId="triage-guide-sheet"
        >
          {list}
        </Sheet>
      ) : guide.open ? (
        list
      ) : null}
    </>
  );
}

/** Rows for a textarea that grows with what is typed. */
export const autoRows = (text: string, min: number) => Math.max(min, text.split("\n").length + 1);
