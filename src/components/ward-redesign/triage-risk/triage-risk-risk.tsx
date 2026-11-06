"use client";

/**
 * Triage and risk mock-up: 5 Risk and FDV, and 6 Formulation and plan (SMHMR905).
 *
 * - Past risk is kept apart from current risk. Past flags can be carried forward from the last
 *   RAMP (with Undo), then checked; current risk is assessed today and never carried forward.
 * - An unmarked factor is never a silent No: each list ends with an explicit "Rest of …" answer.
 * - The family and domestic violence questions are word for word, asked alone, with a trained
 *   interpreter and never a relative.
 * - There is no low, medium or high rating; the formulation and plan carry the judgement.
 *
 * Synthetic data only.
 */
import { Info } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { AppliedFilter, Badge, Button, ChipGroup, FilterChip, Icon, Kbd, Textarea, TextInput } from "@/components/wf";
import { phoneRows } from "@/components/wf/phone-rows";

import {
  COPY_TO,
  FACTOR_NAME,
  FDV_NOT_ASKED,
  FDV_QUESTIONS,
  FLAG_INFO,
  FLAGS_NOW,
  FLAGS_PAST,
  GUIDES,
  LAST_TRIAGE,
  MSE_TO_RISK,
  REVIEW,
  SOURCES,
  type FlagGroup,
} from "./triage-risk-data";
import { UrgencyHint } from "./triage-risk-decision";
import {
  autoRows,
  Choice,
  GuideBox,
  Hint,
  MultiChips,
  Reveal,
  Row,
  useDisclosure,
  type FormApi,
} from "./triage-risk-parts";
import { useHeadedBox } from "./triage-risk-review";
import { fdvOutcome, sinceLastText, type TriageState } from "./triage-risk-state";
import { boxLine, hasPhrase, wordCount } from "./triage-risk-text";
import styles from "./triage-risk-redesign.module.css";

const toggleIn = (list: readonly string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** A flag press: not marked, then present, then not known, then not marked again. */
function cycleFactor(state: TriageState, key: string): TriageState {
  const f = { ...state.f };
  const mark = f[key];
  if (!mark) f[key] = "y";
  else if (mark === "y") f[key] = "u";
  else delete f[key];
  return { ...state, f };
}

/** One flag: its name, and "12 Oct" when carried or "not known" when marked so. */
export function FactorChip({ form, flag, name }: { form: FormApi; flag: string; name: string }) {
  const mark = form.state.f[flag];
  const sub = mark === "u" ? "not known" : mark === "y" && form.state.fromLast.includes(flag) ? "12 Oct" : "";
  return (
    <span title={FLAG_INFO[flag]} className={styles.flagWrap}>
      <FilterChip
        className={`${phoneRows.chip} ${mark === "u" ? styles.unknownChip : ""}`}
        pressed={mark === "y"}
        onPressedChange={() => form.update((s) => cycleFactor(s, flag))}
      >
        {name}
        {sub ? <span className={styles.chipSub}> {sub}</span> : null}
      </FilterChip>
    </span>
  );
}

function FlagGroups({ form, groups, label }: { form: FormApi; groups: readonly FlagGroup[]; label: string }) {
  return (
    <div className={styles.flagGroups}>
      {groups.map(([group, flags]) => (
        <div key={group} className={styles.flagGroup}>
          <span className={styles.flagGroupLabel}>{group}</span>
          <ChipGroup label={`${label}: ${group}`} className={phoneRows.chipRow}>
            {flags.map(([flag, name]) => (
              <FactorChip key={flag} form={form} flag={flag} name={name} />
            ))}
          </ChipGroup>
        </div>
      ))}
    </div>
  );
}

function SubHead({ tag, note, kind, action }: { tag: string; note: string; kind: "past" | "now"; action?: ReactNode }) {
  return (
    <div className={styles.subHead} data-kind={kind}>
      <Badge>{tag}</Badge>
      <span className={styles.quiet}>{note}</span>
      {action}
    </div>
  );
}

function FdvBlock({ form }: { form: FormApi }) {
  const { state, set, update } = form;
  const outcome = fdvOutcome(state);
  const anyYes = ["q1", "q2", "q3"].some((q) => state.fdv[q] === "y");
  const questions = FDV_QUESTIONS.filter(([id]) => id !== "q4" || anyYes);
  const answer = (id: string, value: string | null) =>
    update((s) => {
      const fdv = { ...s.fdv };
      if (value === "y" || value === "n") fdv[id] = value;
      else delete fdv[id];
      return { ...s, fdv };
    });
  /** Y and N answer the focused question and move to the next one. */
  const onKey = (event: KeyboardEvent<HTMLDivElement>, id: string, index: number) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key !== "y" && key !== "n") return;
    event.preventDefault();
    answer(id, key);
    const rows = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[data-fdv-question]");
    rows?.[index + 1]?.focus();
  };
  return (
    <>
      <div className={styles.subHead}>
        <h3 className={styles.subTitle}>Family and domestic violence</h3>
        <span className={styles.pushEnd}>{outcome ? `Outcome: ${outcome}` : "Outcome follows the answers"}</span>
      </div>
      <Hint>
        Ask alone, word for word. Trained interpreter, never a relative. <Kbd>Y</Kbd> and <Kbd>N</Kbd> keys answer the
        focused question.
      </Hint>
      {state.fdvNot ? null : (
        <div className={styles.questions}>
          {questions.map(([id, text], index) => (
            // A focusable row so Y and N can answer it, as the prototype does (aria-keyshortcuts says so).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the row is a keyboard shortcut target holding a radio group
            <div
              key={id}
              className={styles.question}
              role="group"
              aria-labelledby={`triage-fdv-${id}`}
              aria-keyshortcuts="Y N"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable so Y and N can answer it
              tabIndex={0}
              data-fdv-question=""
              onKeyDown={(event) => onKey(event, id, index)}
            >
              <span className={styles.questionText} id={`triage-fdv-${id}`}>
                {text}
              </span>
              <Choice
                label={text}
                options={[
                  ["y", "Yes"],
                  ["n", "No"],
                ]}
                value={state.fdv[id] ?? null}
                onChange={(v) => answer(id, v)}
              />
            </div>
          ))}
        </div>
      )}
      <ChipGroup label="Family violence screen not done">
        <FilterChip
          className={phoneRows.chip}
          pressed={state.fdvNot}
          onPressedChange={(on) => update((s) => ({ ...s, fdvNot: on, fdvReason: on ? s.fdvReason : null }))}
        >
          Could not ask
        </FilterChip>
        {state.fdvNot || anyYes ? null : (
          <FilterChip className={phoneRows.chip} pressed={state.fdvSus} onPressedChange={(on) => set("fdvSus", on)}>
            Suspected, not disclosed
          </FilterChip>
        )}
      </ChipGroup>
      {state.fdvNot ? (
        <Reveal>
          <MultiChips
            label="Why not asked"
            options={FDV_NOT_ASKED}
            values={state.fdvReason ? [state.fdvReason] : []}
            onToggle={(v) => set("fdvReason", state.fdvReason === v ? null : v)}
          />
        </Reveal>
      ) : null}
      {outcome === "Disclosed" || outcome === "Suspected, not disclosed" ? (
        <Reveal>
          <span className={styles.revealText}>
            Positive screen: complete the FDV951, offer social work or an FDV service. With reasonable belief of
            significant harm, consent to refer is preferred but not required.
          </span>
          <MultiChips
            label="FDV actions"
            options={[
              ["FDV951 started", "FDV951 started"],
              ["Social work referral", "Social work"],
            ]}
            values={state.actions}
            onToggle={(v) => set("actions", toggleIn(state.actions, v))}
          />
        </Reveal>
      ) : null}
    </>
  );
}

export function RiskBody({ form, onAllFactors }: { form: FormApi; onAllFactors: () => void }) {
  const { state, set, update, say } = form;
  const explain = useDisclosure(false);
  const carried = state.fromLast.length > 0;
  const since = sinceLastText(state);
  const fromMse = MSE_TO_RISK.filter(([domain, phrase, flag]) => {
    const has =
      state.mseMode === "box"
        ? hasPhrase(boxLine(state.text.mseBox, domain), phrase, domain)
        : Boolean(state.mse[domain]?.chips.includes(phrase));
    return has && state.f[flag] !== "y";
  });
  const carryForward = () => {
    update((s) => {
      const f = { ...s.f };
      const fromLast: string[] = [];
      for (const key of LAST_TRIAGE.pastFlags) {
        if (!f[key]) {
          f[key] = "y";
          fromLast.push(key);
        }
      }
      const restFromLast = !s.restPast;
      return { ...s, f, fromLast, restPast: s.restPast ?? "np", restFromLast };
    });
    say("History carried from 12 Oct. Check each one.");
  };
  const undoCarry = () =>
    update((s) => {
      const f = { ...s.f };
      for (const key of s.fromLast) delete f[key];
      return { ...s, f, fromLast: [], restPast: s.restFromLast ? null : s.restPast, restFromLast: false };
    });
  const [kind, setKind] = useState<"now" | "bg">("now");
  const addOther = () => {
    const text = state.text.otherRisk.trim();
    if (!text) return say("Describe the risk first.");
    update((s) => ({ ...s, xr: [...s.xr, { t: text, k: kind }], text: { ...s.text, otherRisk: "" } }));
  };
  return (
    <>
      <SubHead
        tag="Past risk"
        kind="past"
        note="History. Carried from the last RAMP, then checked"
        action={
          <Button
            variant="ghost"
            size="sm"
            className={styles.pushEnd}
            onClick={explain.toggle}
            {...explain.buttonProps}
          >
            What each flag means
          </Button>
        }
      />
      {explain.open ? (
        <div className={styles.guidePanel} data-columns={2} id={explain.panelId}>
          {(
            [
              ["Past risk", FLAGS_PAST],
              ["Current risk", FLAGS_NOW],
            ] as const
          ).map(([title, groups]) => (
            <div key={title}>
              <h3 className={styles.guideHead}>{title}</h3>
              {groups.flatMap(([, flags]) =>
                flags.map(([flag, name]) => (
                  <p key={flag} className={styles.flagInfo}>
                    <b>{name}</b>
                    <span>{FLAG_INFO[flag]}</span>
                  </p>
                )),
              )}
            </div>
          ))}
        </div>
      ) : null}
      {carried ? (
        <div className={styles.carried}>
          <span>History carried from 12 Oct. Check each one with the person and record; tap a flag to change it.</span>
          <Button variant="ghost" size="sm" onClick={undoCarry}>
            Undo
          </Button>
        </div>
      ) : (
        <div className={styles.carry}>
          <div className={styles.grow}>
            <b>{LAST_TRIAGE.label}</b>
            <span>{LAST_TRIAGE.pastSummary}</span>
          </div>
          <Button size="sm" className={phoneRows.chip} onClick={carryForward}>
            Carry forward
          </Button>
        </div>
      )}
      <FlagGroups form={form} groups={FLAGS_PAST} label="Past risk" />
      <div className={styles.restRow}>
        <span className={styles.grow}>
          <b>Rest of history</b> · anything not marked above
        </span>
        <Choice
          label="Rest of history"
          options={[
            ["np", "Not present"],
            ["nk", "Not known"],
          ]}
          value={state.restPast}
          onChange={(v) => update((s) => ({ ...s, restPast: v, restFromLast: false }))}
        />
      </div>
      <SubHead tag="Current risk" kind="now" note="Assess today. Never carried forward" />
      <FlagGroups form={form} groups={FLAGS_NOW} label="Current risk" />
      {state.f["other.now.parent"] === "y" ? (
        <div className={styles.nudge}>
          <span className={styles.grow}>Children or dependants: say who and where they are now in the assessment.</span>
          <MultiChips
            label="Child protection"
            options={["Child protection notified"]}
            values={state.actions}
            onToggle={(v) => set("actions", toggleIn(state.actions, v))}
          />
        </div>
      ) : null}
      {since ? (
        <p className={styles.since}>
          <Icon icon={Info} size={14} />
          <span>{since}</span>
        </p>
      ) : null}
      <div className={styles.restRow}>
        <span className={styles.grow}>
          <b>Rest of current risk</b> · tap a flag twice for not known ·{" "}
          <Button variant="ghost" size="sm" onClick={onAllFactors} aria-haspopup="dialog">
            See all RAMP factors
          </Button>
        </span>
        <Choice
          label="Rest of current risk"
          options={[
            ["np", "Not present"],
            ["na", "Not assessed"],
          ]}
          value={state.rest}
          onChange={(v) => set("rest", v)}
        />
      </div>
      {fromMse.length ? (
        <div className={styles.suggest}>
          <span>Suggested from mental state</span>
          {fromMse.map(([, , flag]) => (
            <Button
              key={flag}
              size="sm"
              variant="ghost"
              className={phoneRows.chip}
              onClick={() => update((s) => ({ ...s, f: { ...s.f, [flag]: "y" } }))}
            >
              + {FACTOR_NAME[flag]}
            </Button>
          ))}
        </div>
      ) : null}
      <Row label="Other risk" hint="Anything not listed, past or current" htmlFor="triage-other-risk" top>
        <div className={styles.stack}>
          {state.xr.length ? (
            <div className={styles.inline}>
              {state.xr.map((risk, index) => (
                <AppliedFilter
                  key={`${risk.t}-${index}`}
                  removeLabel={`Remove ${risk.t}`}
                  onRemove={() => update((s) => ({ ...s, xr: s.xr.filter((_, i) => i !== index) }))}
                >
                  {`${risk.t} · ${risk.k === "bg" ? "past" : "current"}`}
                </AppliedFilter>
              ))}
            </div>
          ) : null}
          <div className={styles.inline}>
            <TextInput
              id="triage-other-risk"
              boxClassName={styles.grow}
              placeholder="Describe the risk, e.g. driving while unwell"
              value={state.text.otherRisk}
              onChange={(event) => form.setText("otherRisk", event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addOther();
              }}
            />
            <Choice
              label="Past or current"
              options={[
                ["now", "Current"],
                ["bg", "Past"],
              ]}
              value={kind}
              onChange={(v) => setKind(v === "bg" ? "bg" : "now")}
            />
            <Button size="sm" className={phoneRows.chip} onClick={addOther}>
              Add
            </Button>
          </div>
        </div>
      </Row>
      <FdvBlock form={form} />
    </>
  );
}

export function PlanBody({ form }: { form: FormApi }) {
  const { state, set } = form;
  const planRef = useRef<HTMLTextAreaElement>(null);
  const box = useHeadedBox(form, "rp", planRef);
  const urgent = state.urgency === "A" || state.urgency === "B";
  return (
    <>
      <GuideBox
        groups={GUIDES.rp}
        text={state.text.rp}
        onHeading={box.onHeading}
        columns={2}
        extra={<span className={styles.quiet}>WA MP 0181/24 · NICE NG225</span>}
      />
      <Textarea
        ref={planRef}
        aria-label="Risk formulation and safety plan"
        rows={autoRows(state.text.rp, 7)}
        placeholder="Who is at risk, of what, how soon, what keeps them safe, and the plan. Short lines are fine."
        value={state.text.rp}
        onChange={box.onChange}
      />
      <div className={styles.boxFoot}>
        <span>
          Type <Kbd>.form</Kbd> for formulation, <Kbd>.plan</Kbd> for safety plan, <Kbd>.all</Kbd> for both
        </span>
        <span className={styles.mono}>{wordCount(state.text.rp)} words</span>
      </div>
      <div className={styles.rows}>
        <Row label="Risk may change quickly">
          <Choice
            label="Risk may change quickly"
            options={[
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            value={state.changeable}
            onChange={(v) => set("changeable", v)}
          />
        </Row>
        <Row label="Factors add uncertainty">
          <Choice
            label="Factors add uncertainty"
            options={[
              ["yes", "Yes"],
              ["no", "No"],
            ]}
            value={state.uncertain}
            onChange={(v) => set("uncertain", v)}
          />
        </Row>
        <Row label="Review risk by" hint="Next RAMP due; sooner after any big change">
          <Choice label="Review risk by" options={REVIEW} value={state.review} onChange={(v) => set("review", v)} />
          {urgent && state.review !== "24h" ? (
            <UrgencyHint>{`Urgency ${state.urgency}: consider a risk review within 24 hours. You choose.`}</UrgencyHint>
          ) : null}
        </Row>
        <Row label="Copy and collateral" hint="Who you spoke to or used" top>
          <div className={styles.stack}>
            <span className={styles.miniLabel}>Copy to</span>
            <MultiChips
              label="Plan copy to"
              options={COPY_TO}
              values={state.copyGiven}
              onToggle={(v) => set("copyGiven", toggleIn(state.copyGiven, v))}
            />
            <span className={styles.miniLabel}>Collateral</span>
            <MultiChips
              label="Collateral and sources"
              options={SOURCES}
              values={state.sources}
              onToggle={(v) => set("sources", toggleIn(state.sources, v))}
            />
          </div>
        </Row>
      </div>
    </>
  );
}
