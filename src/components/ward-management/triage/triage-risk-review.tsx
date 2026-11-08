"use client";

/** Triage and risk: 1 Review details and 2 Assessment (SMHMR900). Synthetic data only. */
import { useRef, useState, type ChangeEvent, type RefObject } from "react";

import { Button, ChipGroup, FilterChip, Kbd, StatusGlyph, Textarea, TextInput, phoneRows } from "@/components/wf";

import {
  AMHW,
  ARRIVED_BY,
  ATSI,
  EPISODE,
  GUIDES,
  HOW,
  INTERPRETER,
  OTHERS_PRESENT,
  PURPOSE,
  RISK_TO_PROBLEM,
  SOURCES,
} from "./triage-risk-data";
import {
  ALL_PROGRAMS,
  labelOf,
  PROBLEMS_COMMON,
  PROGRAMS,
  PSOLIS_PROBLEMS,
  REFERRAL_TYPES,
  REFERRAL_TYPES_COMMON,
  STREAMS,
  VENUES,
  VENUES_COMMON,
  type StreamCode,
} from "./triage-psolis-lists";
import {
  autoRows,
  Choice,
  GuideBox,
  MultiChips,
  PickMany,
  PickOne,
  Reveal,
  Row,
  type FormApi,
} from "./triage-risk-parts";
import type { TextKey, TriageState } from "./triage-risk-state";
import { addHeading, checkReviewTime, expandShortcut, reviewTimeStamp, wordCount } from "./triage-risk-text";
import styles from "./triage-risk-form.module.css";

const toggleIn = (list: readonly string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** A free-text box with headings and the dot shortcuts (.all, .form, .plan). */
export function useHeadedBox(
  form: FormApi,
  key: Extract<TextKey, "note" | "rp">,
  ref: RefObject<HTMLTextAreaElement | null>,
) {
  const placeCaret = (caret: number) =>
    requestAnimationFrame(() => {
      const box = ref.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(caret, caret);
    });
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = event.target;
    const expanded = expandShortcut(key, value, selectionStart);
    if (!expanded) return form.setText(key, value);
    form.setText(key, expanded.value);
    placeCaret(expanded.caret);
    form.say(expanded.message);
  };
  const onHeading = (heading: string) => {
    const next = addHeading(form.state.text[key], heading);
    form.setText(key, next.value);
    placeCaret(next.caret);
  };
  return { onChange, onHeading };
}

function reviewDone(state: TriageState, now: number) {
  return Boolean(
    checkReviewTime(state.text.revTime, now).ok &&
    state.how &&
    state.where &&
    state.present &&
    state.purpose &&
    state.episode,
  );
}

const HOW_NAME: Readonly<Record<string, string>> = Object.fromEntries(HOW);

/** The stream a program belongs to, so Change offers only that stream's programs. */
function streamOf(program: string | null): StreamCode | null {
  if (!program) return null;
  const found = (Object.keys(PROGRAMS) as StreamCode[]).find((stream) =>
    PROGRAMS[stream].some(([code]) => code === program),
  );
  return found ?? null;
}

/**
 * Program, a desk setting from webPSOLIS Stream and Program: one fact line with Change, which offers
 * only the programs of the desk's stream. Never a clinical answer.
 */
function ProgramLine({ form }: { form: FormApi }) {
  const { state, set } = form;
  const [changing, setChanging] = useState(false);
  const label = labelOf(ALL_PROGRAMS, state.program);
  // A program set by the desk names its stream; with none, the site's one stream.
  const programs = PROGRAMS[streamOf(state.program) ?? STREAMS[0][0]];
  const open = changing || !label;
  return (
    <div className={styles.oneLine} data-testid="triage-program">
      <span>
        Program <b>{label || "not set"}</b>
      </span>
      {label ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.pushEnd}
          aria-expanded={open}
          aria-controls="triage-program-choice"
          onClick={() => setChanging(!changing)}
        >
          {changing ? "Done" : "Change"}
        </Button>
      ) : null}
      {open ? (
        <div id="triage-program-choice" className={styles.programChoice}>
          <Choice
            label="Program"
            options={programs.map(([code, name]) => [code, name] as const)}
            value={state.program}
            onChange={(v) => set("program", v)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** "Dr P. Singh, ED registrar · (08) 5550 0190", from what is typed. */
function referrerLine(state: TriageState): string {
  const t = state.text;
  const who = [t.refName.trim(), t.refRole.trim()].filter(Boolean).join(", ");
  return [who, t.refPhone.trim()].filter(Boolean).join(" · ");
}

/**
 * The referrer, from the referral where it names them: one fact line with Change, or the three
 * fields while changing (or when nothing is known yet). Synthetic only.
 */
function ReferrerLine({ form }: { form: FormApi }) {
  const { state, setText } = form;
  const referral = state.person.referral;
  const line = referrerLine(state);
  const [changing, setChanging] = useState(false);
  const open = changing || !line;
  return (
    <div className={styles.oneLine} data-testid="triage-referrer">
      <span className={styles.from}>{referral ? "From referral" : "No referral"}</span>
      {referral ? (
        <span>
          <b>{referral.from}</b>
          {referral.received ? ` · ${referral.received}` : ""}
        </span>
      ) : null}
      {open ? null : (
        <span>
          Referrer <b>{line}</b>
        </span>
      )}
      <span className={`${styles.inline} ${styles.pushEnd}`}>
        {line ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls="triage-referrer-fields"
            onClick={() => setChanging(!changing)}
          >
            {changing ? "Done" : "Change"}
          </Button>
        ) : null}
        {referral ? (
          <Button variant="ghost" size="sm" onClick={() => form.openSummary("ref")}>
            View referral
          </Button>
        ) : null}
      </span>
      {open ? (
        <div className={styles.referrerFields} id="triage-referrer-fields">
          <TextInput
            aria-label="Referrer name"
            placeholder="Referrer name"
            autoComplete="off"
            value={state.text.refName}
            onChange={(event) => setText("refName", event.target.value)}
          />
          <TextInput
            aria-label="Referrer role"
            placeholder="Role"
            autoComplete="off"
            value={state.text.refRole}
            onChange={(event) => setText("refRole", event.target.value)}
          />
          <TextInput
            aria-label="Referrer phone"
            placeholder="Phone"
            inputMode="tel"
            autoComplete="off"
            className={styles.mono}
            value={state.text.refPhone}
            onChange={(event) => setText("refPhone", event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ReviewBody({
  form,
  editing,
  onEditing,
}: {
  form: FormApi;
  editing: boolean;
  onEditing: (editing: boolean) => void;
}) {
  const { state, set, setText } = form;
  const [timeFocused, setTimeFocused] = useState(false);
  const done = reviewDone(state, form.now);
  // Never folds away under the caret: the fields stay open while the time is being typed.
  const folded = done && !editing && !timeFocused;
  const time = checkReviewTime(state.text.revTime, form.now);
  // A wrong time shows once the field is left or the time is complete; a future time at once.
  const showError = Boolean(time.message) && (time.future || !timeFocused || state.text.revTime.trim().length >= 16);
  const accompanied = state.text.accompanied.trim();
  const language = state.text.interpLang.trim();
  return (
    <>
      <ReferrerLine form={form} />
      <ProgramLine form={form} />
      {done ? (
        <div className={styles.oneLine} data-testid="triage-review-line">
          <span className={styles.from}>Reviewed</span>
          <span>
            <b className={styles.mono}>{state.text.revTime}</b> · {HOW_NAME[state.how ?? ""]} ·{" "}
            {labelOf(VENUES, state.where)}
          </span>
          {state.referralType ? <span>Referral: {labelOf(REFERRAL_TYPES, state.referralType)}</span> : null}
          {state.arrivedBy || accompanied ? (
            <span>
              Arrived {state.arrivedBy ? `by ${state.arrivedBy.toLowerCase()}` : ""}
              {accompanied ? `${state.arrivedBy ? ", " : ""}with ${accompanied}` : ""}
            </span>
          ) : null}
          <span>
            Person {state.present === "yes" ? "present" : "not present"}
            {state.others.length ? `, with ${state.others.join(", ").toLowerCase()}` : ""}
          </span>
          <span>
            {state.purpose} · {state.episode} episode
          </span>
          {state.interp === "yes" || state.interp === "unavail" ? (
            <span>
              Interpreter{state.interp === "unavail" ? " needed, not available" : ""}
              {language ? `: ${language}` : ", language not given"}
            </span>
          ) : null}
          {state.sources.length ? <span>Sources: {state.sources.join(", ").toLowerCase()}</span> : null}
          {state.atsi ? null : (
            <span className={styles.inlineMark}>
              <StatusGlyph tone="warning" size={8} />
              Aboriginal status not asked
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={styles.pushEnd}
            aria-expanded={!folded}
            aria-controls="triage-review-fields"
            onClick={() => onEditing(!editing)}
          >
            {folded ? "Change" : "Done"}
          </Button>
        </div>
      ) : null}
      <div className={styles.rows} id="triage-review-fields" hidden={folded}>
        <Row label="Referral type" hint="Who or what referred them" top>
          <PickOne
            label="Referral type"
            noun="referral types"
            list={REFERRAL_TYPES}
            common={REFERRAL_TYPES_COMMON}
            value={state.referralType}
            onChange={(v) => set("referralType", v)}
          />
        </Row>
        <Row label="Reviewed" hint="Date and time" htmlFor="triage-rev-time">
          <div className={styles.inline}>
            <TextInput
              id="triage-rev-time"
              className={styles.mono}
              boxClassName={styles.timeInput}
              placeholder="DD/MM/YYYY HH:MM"
              autoComplete="off"
              invalid={showError}
              aria-describedby={showError ? "triage-rev-error" : undefined}
              value={state.text.revTime}
              onChange={(event) => setText("revTime", event.target.value)}
              onFocus={() => setTimeFocused(true)}
              onBlur={() => setTimeFocused(false)}
            />
            <Button
              size="sm"
              className={phoneRows.chip}
              onClick={() => setText("revTime", reviewTimeStamp(new Date(form.now)))}
            >
              Now
            </Button>
          </div>
          {showError ? (
            <p className={styles.fieldError} id="triage-rev-error">
              <StatusGlyph tone="warning" size={8} />
              <span>{time.message}</span>
            </p>
          ) : null}
        </Row>
        <Row label="How">
          <Choice label="How" options={HOW} value={state.how} onChange={(v) => set("how", v)} />
        </Row>
        <Row label="Where they were" top>
          <PickOne
            label="Where they were"
            noun="venues"
            list={VENUES}
            common={VENUES_COMMON}
            value={state.where}
            onChange={(v) => set("where", v)}
          />
        </Row>
        <Row label="Arrived by" top>
          <Choice
            label="Arrived by"
            options={ARRIVED_BY}
            value={state.arrivedBy}
            onChange={(v) => set("arrivedBy", v)}
          />
        </Row>
        <Row label="Accompanied by" htmlFor="triage-accompanied">
          <TextInput
            id="triage-accompanied"
            placeholder="Who came with them, if anyone"
            autoComplete="off"
            value={state.text.accompanied}
            onChange={(event) => setText("accompanied", event.target.value)}
          />
        </Row>
        <Row label="Person present">
          <Choice
            id="triage-present"
            label="Person present"
            options={[
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            value={state.present}
            onChange={(v) => set("present", v)}
          />
        </Row>
        <Row label="Others present" hint="At the review">
          <MultiChips
            label="Others present"
            options={OTHERS_PRESENT}
            values={state.others}
            onToggle={(v) => set("others", toggleIn(state.others, v))}
          />
        </Row>
        <Row label="Purpose">
          <Choice label="Purpose" options={PURPOSE} value={state.purpose} onChange={(v) => set("purpose", v)} />
        </Row>
        <Row
          label="Episode"
          hint={state.person.referral?.episode ? `From referral: ${state.person.referral.episode}` : undefined}
        >
          <Choice label="Episode" options={EPISODE} value={state.episode} onChange={(v) => set("episode", v)} />
        </Row>
        <Row label="Aboriginal or Torres Strait Islander" hint="Ask every time">
          <Choice
            label="Aboriginal or Torres Strait Islander"
            options={ATSI}
            value={state.atsi}
            onChange={(v) => set("atsi", v)}
          />
        </Row>
        {state.atsi && ["a", "t", "b"].includes(state.atsi) ? (
          <Reveal>
            <Row label="Aboriginal MH worker">
              <Choice label="Aboriginal MH worker" options={AMHW} value={state.amhw} onChange={(v) => set("amhw", v)} />
            </Row>
          </Reveal>
        ) : null}
        <Row label="Interpreter needed" hint="Accredited, never family or friends">
          <div className={styles.inline}>
            <Choice
              label="Interpreter needed"
              options={INTERPRETER}
              value={state.interp}
              onChange={(v) => set("interp", v)}
            />
            {state.interp === "yes" || state.interp === "unavail" ? (
              <TextInput
                aria-label="Interpreter language"
                placeholder="Language"
                autoComplete="off"
                boxClassName={styles.languageInput}
                value={state.text.interpLang}
                onChange={(event) => setText("interpLang", event.target.value)}
              />
            ) : null}
          </div>
        </Row>
        <Row label="Sources used" hint="Collateral" top>
          <MultiChips
            label="Sources used"
            options={SOURCES}
            values={state.sources}
            onToggle={(v) => set("sources", toggleIn(state.sources, v))}
          />
        </Row>
        <Row label="Notes source">
          <ChipGroup label="Notes source">
            <FilterChip className={phoneRows.chip} pressed={state.trans} onPressedChange={(on) => set("trans", on)}>
              Transcribed from paper notes
            </FilterChip>
          </ChipGroup>
        </Row>
      </div>
    </>
  );
}

export function AssessmentBody({ form }: { form: FormApi }) {
  const { state, set, update } = form;
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const box = useHeadedBox(form, "note", noteRef);
  const suggested = RISK_TO_PROBLEM.filter(([prefix]) =>
    Object.entries(state.f).some(([key, mark]) => mark === "y" && key.startsWith(prefix)),
  )
    .map(([, problem]) => problem)
    .filter((problem, index, all) => !state.problems.includes(problem) && all.indexOf(problem) === index);
  const toggleAware = (value: string) =>
    update((s) => {
      if (s.aware.includes(value)) return { ...s, aware: s.aware.filter((v) => v !== value) };
      // Agrees and opposed cannot both be true.
      const other = value === "person" ? "opposed" : value === "opposed" ? "person" : "";
      return { ...s, aware: [...s.aware.filter((v) => v !== other), value] };
    });
  return (
    <>
      {/* A signed triage keeps codes only, so there is no earlier history text to insert. */}
      <GuideBox groups={GUIDES.note} text={state.text.note} onHeading={box.onHeading} textRef={noteRef} />
      <Textarea
        ref={noteRef}
        aria-label="Assessment"
        rows={autoRows(state.text.note, 8)}
        placeholder="Write it as you would say it. Open What to cover for prompts; tapping one adds its heading."
        value={state.text.note}
        onChange={box.onChange}
      />
      <div className={styles.boxFoot}>
        <span>
          Type <Kbd>.all</Kbd> for every heading. Mental state has its own section below
        </span>
        <span className={styles.mono}>{wordCount(state.text.note)} words</span>
      </div>
      <div className={styles.rows}>
        <Row label="Problems" top>
          <PickMany
            id="triage-problems"
            label="Problems"
            noun="problems"
            list={PSOLIS_PROBLEMS}
            common={PROBLEMS_COMMON}
            values={state.problems}
            onChange={(v) => set("problems", v)}
            other={{
              code: "other",
              label: "Other problem, in a few words",
              value: state.text.problemOther,
              onChange: (v) => form.setText("problemOther", v),
            }}
          />
          {suggested.length ? (
            <div className={styles.suggest} data-refocus="problem-suggest">
              <span>Suggested from risk flags</span>
              {suggested.map((problem) => (
                <Button
                  key={problem}
                  size="sm"
                  variant="ghost"
                  className={phoneRows.chip}
                  onClick={() => set("problems", [...state.problems, problem])}
                >
                  + {labelOf(PSOLIS_PROBLEMS, problem)}
                </Button>
              ))}
            </div>
          ) : null}
        </Row>
        <Row label="Aware of referral">
          <MultiChips
            label="Aware of referral"
            options={[
              ["person", "Person agrees"],
              ["opposed", "Person opposed"],
              ["carer", "Carer aware"],
            ]}
            values={state.aware}
            onToggle={toggleAware}
          />
        </Row>
      </div>
    </>
  );
}
