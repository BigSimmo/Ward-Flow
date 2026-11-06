"use client";

/** Triage and risk mock-up: 1 Review details and 2 Assessment (SMHMR900). Synthetic data only. */
import { useRef, type ChangeEvent, type RefObject } from "react";

import { Button, ChipGroup, FilterChip, Kbd, StatusGlyph, Textarea, TextInput } from "@/components/wf";
import { phoneRows } from "@/components/wf/phone-rows";
import { timePresetClockText } from "@/components/wf/time-presets";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { minuteOfDay } from "@/components/ward-management/ward-clock";

import {
  AMHW,
  ATSI,
  EPISODE,
  GUIDES,
  HOW,
  INTERPRETER,
  LAST_TRIAGE,
  PROBLEMS,
  PURPOSE,
  RISK_TO_PROBLEM,
  WHERE,
} from "./triage-risk-data";
import { autoRows, Choice, GuideBox, MultiChips, Reveal, Row, type FormApi } from "./triage-risk-parts";
import type { TextKey, TriageState } from "./triage-risk-state";
import { addHeading, expandShortcut, wordCount } from "./triage-risk-text";
import styles from "./triage-risk-redesign.module.css";

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

function reviewDone(state: TriageState) {
  return Boolean(
    state.text.revTime.trim().length >= 5 &&
    state.how &&
    state.where &&
    state.present &&
    state.purpose &&
    state.episode,
  );
}

const HOW_NAME: Readonly<Record<string, string>> = Object.fromEntries(HOW);

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
  const now = useWardFlowClock(0);
  const done = reviewDone(state);
  const folded = done && !editing;
  return (
    <>
      <div className={styles.oneLine}>
        <span className={styles.from}>From referral</span>
        <span>
          <b>Synthetic ED</b> · Dr P. Singh, ED registrar
        </span>
        <span>
          eReferral <span className={styles.mono}>06/11 08:55</span>
        </span>
        <Button variant="ghost" size="sm" className={styles.pushEnd} onClick={() => form.openSummary("ref")}>
          View referral
        </Button>
      </div>
      {done ? (
        <div className={styles.oneLine}>
          <span className={styles.from}>Reviewed</span>
          <span>
            <b className={styles.mono}>{state.text.revTime}</b> · {HOW_NAME[state.how ?? ""]} · {state.where}
          </span>
          <span>
            Person {state.present === "yes" ? "present" : "not present"}
            {state.others.length ? `, with ${state.others.join(", ").toLowerCase()}` : ""}
          </span>
          <span>
            {state.purpose} · {state.episode} episode
          </span>
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
        <Row label="Reviewed" hint="Date and time" htmlFor="triage-rev-time">
          <div className={styles.inline}>
            <TextInput
              id="triage-rev-time"
              className={styles.mono}
              boxClassName={styles.shortInput}
              placeholder="DD/MM HH:MM"
              inputMode="numeric"
              value={state.text.revTime}
              onChange={(event) => setText("revTime", event.target.value)}
            />
            <Button
              size="sm"
              className={phoneRows.chip}
              onClick={() => setText("revTime", `06/11 ${timePresetClockText(minuteOfDay(now))}`)}
            >
              Now
            </Button>
          </div>
        </Row>
        <Row label="How">
          <Choice label="How" options={HOW} value={state.how} onChange={(v) => set("how", v)} />
        </Row>
        <Row label="Where they were">
          <Choice label="Where they were" options={WHERE} value={state.where} onChange={(v) => set("where", v)} />
        </Row>
        <Row label="Person present">
          <div className={styles.inline}>
            <Choice
              label="Person present"
              options={[
                ["yes", "Yes"],
                ["no", "No"],
              ]}
              value={state.present}
              onChange={(v) => set("present", v)}
            />
            <MultiChips
              label="Also present"
              options={["Carer or family", "Other service"]}
              values={state.others}
              onToggle={(v) => set("others", toggleIn(state.others, v))}
            />
          </div>
        </Row>
        <Row label="Purpose">
          <Choice label="Purpose" options={PURPOSE} value={state.purpose} onChange={(v) => set("purpose", v)} />
        </Row>
        <Row label="Episode" hint="From referral: ED. Change if needed">
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
        <Row label="Interpreter">
          <Choice label="Interpreter" options={INTERPRETER} value={state.interp} onChange={(v) => set("interp", v)} />
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
  const { state, set, update, say } = form;
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const box = useHeadedBox(form, "note", noteRef);
  const suggested = RISK_TO_PROBLEM.filter(([prefix]) =>
    Object.entries(state.f).some(([key, mark]) => mark === "y" && key.startsWith(prefix)),
  )
    .map(([, problem]) => problem)
    .filter((problem, index, all) => !state.problems.includes(problem) && all.indexOf(problem) === index);
  const insertHistory = () => {
    const note = state.text.note;
    if (/^History \(12 Oct/m.test(note)) return say("Last history is already in.");
    form.setText("note", `${note && !note.endsWith("\n") ? `${note}\n` : note}${LAST_TRIAGE.history}\n`);
    say("Inserted with its source and date.");
  };
  const toggleAware = (value: string) =>
    update((s) => {
      if (s.aware.includes(value)) return { ...s, aware: s.aware.filter((v) => v !== value) };
      // Agrees and opposed cannot both be true.
      const other = value === "person" ? "opposed" : value === "opposed" ? "person" : "";
      return { ...s, aware: [...s.aware.filter((v) => v !== other), value] };
    });
  return (
    <>
      <GuideBox
        groups={GUIDES.note}
        text={state.text.note}
        onHeading={box.onHeading}
        extra={
          <Button variant="ghost" size="sm" onClick={insertHistory}>
            Insert last history (12 Oct)
          </Button>
        }
      />
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
          <MultiChips
            label="Problems"
            options={PROBLEMS}
            values={state.problems}
            onToggle={(v) => set("problems", toggleIn(state.problems, v))}
          />
          {suggested.length ? (
            <div className={styles.suggest}>
              <span>Suggested from risk flags</span>
              {suggested.map((problem) => (
                <Button
                  key={problem}
                  size="sm"
                  variant="ghost"
                  className={phoneRows.chip}
                  onClick={() => set("problems", [...state.problems, problem])}
                >
                  + {problem}
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
