"use client";

/**
 * Triage and risk mock-up: 5 Risk assessment (with family and domestic violence), and 6 Formulation and
 * plan (SMHMR905).
 *
 * - Past risk is kept apart from current risk. Past flags can be carried forward from the last
 *   RAMP (with Undo), then each is confirmed today; Rest of history is never carried. Current risk
 *   is assessed today and never carried forward.
 * - A press on a flag marks it present. Not known is marked only in All RAMP factors (7 Nov 2026).
 * - An unmarked factor is never a silent No: each list ends with an explicit "Rest of …" answer,
 *   which names what it covers. A factor the mental state or the FDV screen contradicts is not
 *   covered; it is listed as a conflict to check.
 * - The family and domestic violence questions are word for word, asked alone, with an accredited
 *   interpreter and never a family member or friend.
 * - There is no low, medium or high rating; the formulation and plan carry the judgement.
 *
 * Synthetic data only.
 */
import { Check, Info } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  AppliedFilter,
  Badge,
  Button,
  ChipGroup,
  FilterChip,
  Icon,
  Kbd,
  Segmented,
  SrOnly,
  StatusGlyph,
  Textarea,
  TextInput,
  phoneRows,
} from "@/components/wf";

import {
  COPY_TO,
  FACTOR_NAME,
  FDV_NOT_ASKED,
  FDV_QUESTIONS,
  FLAG_INFO,
  FLAGS_NOW,
  FLAGS_PAST,
  GUIDES,
  MSE_TO_RISK,
  REVIEW,
  type FlagGroup,
} from "./triage-risk-data";
import { labelOf, PSOLIS_ACTIONS } from "./triage-psolis-lists";
import { UrgencyHint } from "./triage-risk-decision";
import { autoRows, Choice, GuideBox, MultiChips, Reveal, Row, useDisclosure, type FormApi } from "./triage-risk-parts";
import { useHeadedBox } from "./triage-risk-review";
import {
  MEANS_NOT_ASKED,
  MEANS_ROWS,
  MEANS_STATUS,
  MEANS_STILL_OPEN,
  meansPrefill,
  meansSafetyShown,
  meansStillOpen,
} from "./triage-risk-safety";
import { SafetyPlanDrawer } from "./triage-risk-safety-plan";
import { fdvOutcome, restConfirmed, restSets, sinceLastText, type TriageState } from "./triage-risk-state";
import { boxLine, hasPhrase, wordCount } from "./triage-risk-text";
import styles from "./triage-risk-form.module.css";

/** How many factor names a long "Covers" line shows before "Show all". */
const COVERS_SHOWN = 6;

/** Action codes from `PSOLIS_ACTIONS` as chip options, showing each one's plain label. */
const actionOptions = (codes: readonly string[]) => codes.map((code) => [code, labelOf(PSOLIS_ACTIONS, code)] as const);

const toggleIn = (list: readonly string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * A press on a flag toggles Present (7 Nov 2026: Tap marks is gone). Not known is marked only in
 * All RAMP factors; the "Rest of …" answers cover not present.
 */
function togglePresent(state: TriageState, key: string): TriageState {
  const f = { ...state.f };
  if (f[key] === "y") delete f[key];
  else f[key] = "y";
  return { ...state, f };
}

/** Not known, in All RAMP factors only: a second press clears it. */
function toggleNotKnown(state: TriageState, key: string): TriageState {
  const f = { ...state.f };
  if (f[key] === "u") delete f[key];
  else f[key] = "u";
  return { ...state, f };
}

/** One flag, named as its factor: a tick when present, and how it was recorded underneath. */
function FactorChip({ form, flag }: { form: FormApi; flag: string }) {
  const { state } = form;
  const mark = state.f[flag];
  const carried = mark === "y" && state.fromLast.includes(flag);
  const sub =
    mark === "u"
      ? "not known"
      : carried
        ? state.confirmed.includes(flag)
          ? "confirmed today"
          : `carried ${state.person.last?.when ?? ""}`.trim()
        : "";
  return (
    <span title={FLAG_INFO[flag]} className={styles.flagWrap} data-factor={flag}>
      <FilterChip
        className={`${phoneRows.chip} ${styles.flagChip} ${mark === "u" ? styles.unknownChip : ""}`}
        pressed={mark === "y"}
        onPressedChange={() => form.update((s) => togglePresent(s, flag))}
      >
        {mark === "y" ? <Icon icon={Check} size={14} className={styles.tick} /> : null}
        {FACTOR_NAME[flag]}
        {sub ? <span className={styles.chipSub}> {sub}</span> : null}
      </FilterChip>
    </span>
  );
}

/** A factor in All RAMP factors: its flag, then the one Not known toggle. */
export function FactorRow({ form, flag }: { form: FormApi; flag: string }) {
  const known = form.state.f[flag] === "u";
  return (
    <span className={styles.factorRow}>
      <FactorChip form={form} flag={flag} />
      <FilterChip
        className={`${phoneRows.chip} ${styles.notKnownChip}`}
        pressed={known}
        onPressedChange={() => form.update((s) => toggleNotKnown(s, flag))}
      >
        <span aria-hidden="true">Not known</span>
        <SrOnly>{`Not known: ${FACTOR_NAME[flag]}`}</SrOnly>
      </FilterChip>
    </span>
  );
}

function FlagGroups({
  form,
  groups,
  label,
  onAllFactors,
}: {
  form: FormApi;
  groups: readonly FlagGroup[];
  label: string;
  onAllFactors: () => void;
}) {
  return (
    <div className={styles.flagGroups}>
      {groups.map(([group, flags]) => (
        <div key={group} className={styles.flagGroup}>
          <span className={styles.flagGroupLabel}>{group}</span>
          <ChipGroup label={`${label}: ${group}`} className={phoneRows.chipRow}>
            {flags.map((flag) => (
              <FactorChip key={flag} form={form} flag={flag} />
            ))}
          </ChipGroup>
        </div>
      ))}
      <Button variant="ghost" size="sm" className={styles.notKnownLink} onClick={onAllFactors} aria-haspopup="dialog">
        Unsure about any? Mark not known
      </Button>
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

/**
 * What a "Rest of …" answer covers, by name. With Not present, factors the mental state or FDV
 * screen contradicts are left out and listed to check; current risk also asks for a confirmation.
 */
function Covers({ form, kind }: { form: FormApi; kind: "now" | "bg" }) {
  const { state } = form;
  const [showAll, setShowAll] = useState(false);
  const value = kind === "now" ? state.rest : state.restPast;
  if (!value) return null;
  const sets = restSets(state, kind);
  const notPresent = value === "np";
  const list = notPresent ? sets.covered : sets.all;
  const word = notPresent ? "not present" : kind === "now" ? "not assessed" : "not known";
  const confirm = () => {
    const keys = restSets(state, "now").covered.map((f) => f.key);
    form.set("restCov", keys);
    form.say(`Rest of current risk confirmed for ${keys.length} factors.`);
  };
  // 7 Nov 2026: a long list shows its first few names, except while a confirmation still asks
  // about all of them.
  const confirming = notPresent && kind === "now" && !restConfirmed(state);
  const short = list.length > COVERS_SHOWN + 2 && !confirming;
  const names = short && !showAll ? list.slice(0, COVERS_SHOWN) : list;
  return (
    <div className={styles.covers} data-refocus={`covers-${kind}`}>
      <span>
        <b>Covers {list.length}</b> unmarked {kind === "now" ? "current" : "history"} factors as {word}:{" "}
        {names.map((f) => f.name).join(", ") || "none"}
        {short && !showAll ? ` and ${list.length - COVERS_SHOWN} more.` : "."}
      </span>
      {short ? (
        <Button
          variant="ghost"
          size="sm"
          className={`${phoneRows.chip} ${styles.coversMore}`}
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? "Show fewer" : `Show all ${list.length}`}
        </Button>
      ) : null}
      {notPresent && sets.conflicts.length ? (
        <span className={styles.conflicts}>
          <StatusGlyph tone="warning" size={8} />
          <span>Not covered, check first:</span>
          {sets.conflicts.map(({ factor, why }) => (
            <span key={factor.key} className={styles.conflict}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  form.jump("risk", { selector: `[data-factor="${factor.key}"] button`, factor: factor.key })
                }
              >
                {factor.name}
              </Button>
              <span className={styles.quiet}>({why.join("; ")})</span>
            </span>
          ))}
        </span>
      ) : null}
      {notPresent && kind === "now" ? (
        restConfirmed(state) ? (
          <span className={styles.inlineMark}>
            <StatusGlyph tone="success" size={10} />
            Confirmed
          </span>
        ) : (
          <Button size="sm" id="triage-rest-ok" className={phoneRows.chip} onClick={confirm}>
            Confirm none of these are present
          </Button>
        )
      ) : null}
    </div>
  );
}

/**
 * Means safety (9 Nov 2026): once Plan or intent, or Access to means, is marked present. Each row is
 * Asked first, then what was found and who holds it. An unanswered row reads Not asked yet, never
 * No; Still accessible brings a quiet prompt, never a block. React state only.
 */
function MeansSafety({ form }: { form: FormApi }) {
  const { state, update, setText } = form;
  type Answer = TriageState["means"][string];
  const answer = (id: string, change: (a: Answer) => Answer | null) =>
    update((s) => {
      const means = { ...s.means };
      const next = change(means[id] ?? { asked: false, status: null });
      if (next) means[id] = next;
      else delete means[id];
      return { ...s, means };
    });
  return (
    <div className={styles.means} data-testid="triage-means-safety">
      <div className={styles.subHead}>
        <h3 className={styles.subTitle}>Means safety</h3>
        <span className={styles.quiet}>Ask about each. Unanswered reads Not asked yet.</span>
      </div>
      {MEANS_ROWS.map(([id, label, key]) => {
        const row = state.means[id];
        return (
          <div key={id} className={styles.meansRow} data-means={id}>
            <span className={styles.meansLabel}>
              <b>{label}</b>
              {row?.asked ? null : <span className={styles.quiet}>{MEANS_NOT_ASKED}</span>}
            </span>
            <span className={styles.meansAnswers}>
              <FilterChip
                className={phoneRows.chip}
                pressed={Boolean(row?.asked)}
                onPressedChange={(on) => answer(id, (a) => (on ? { ...a, asked: true } : null))}
              >
                <span aria-hidden="true">Asked</span>
                <SrOnly>{`Asked about ${label.toLowerCase()}`}</SrOnly>
              </FilterChip>
              {row?.asked ? (
                <>
                  <Choice
                    label={`${label}: what was found`}
                    options={MEANS_STATUS}
                    value={row.status}
                    onChange={(v) => answer(id, (a) => ({ ...a, status: v }))}
                  />
                  <TextInput
                    boxClassName={styles.meansWho}
                    aria-label={`${label}: who, where`}
                    placeholder="Who, where"
                    value={state.text[key]}
                    onChange={(event) => setText(key, event.target.value)}
                  />
                </>
              ) : null}
            </span>
            {meansStillOpen(state, id) ? (
              <p className={styles.nudgeLine} data-testid="triage-means-open">
                <StatusGlyph tone="neutral" size={8} />
                <span>{MEANS_STILL_OPEN}</span>
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FdvBlock({ form }: { form: FormApi }) {
  const { state, set, update } = form;
  const outcome = fdvOutcome(state);
  const anyYes = ["q1", "q2", "q3"].some((q) => state.fdv[q] === "y");
  const questions = FDV_QUESTIONS.filter(([id]) => id !== "q4" || anyYes);
  const notAlone = state.fdvAlone === "no";
  // No accredited interpreter: the questions cannot be asked through anyone else, so nudge as for privacy.
  const noInterpreter = state.interp === "unavail";
  const notPrivate = (state.how === "phone" || state.others.length > 0 || noInterpreter) && !state.fdvNot && !notAlone;
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
  const followUp = (label: string, codes: readonly string[]) => (
    <MultiChips
      label={label}
      options={actionOptions(codes)}
      values={state.actions}
      onToggle={(v) => set("actions", toggleIn(state.actions, v))}
    />
  );
  return (
    <>
      {/* 7 Nov 2026: condensed. One guidance line (the interpreter wording kept), Asked alone as one
          row before the questions, one nudge at most, and follow-ups only once the outcome needs them. */}
      <div className={styles.subHead}>
        <h3 className={styles.subTitle}>Family and domestic violence</h3>
        <span className={styles.pushEnd}>{outcome ? `Outcome: ${outcome}` : "Outcome follows the answers"}</span>
      </div>
      <p className={styles.fdvGuide}>
        Ask alone, word for word. If an interpreter is needed, use an accredited interpreter, never a family member or
        friend.
        {form.isPhone ? null : (
          <span className={styles.fdvKeys}>
            {" "}
            <Kbd>Y</Kbd> <Kbd>N</Kbd> answer the focused question.
          </span>
        )}
      </p>
      <div className={styles.fdvAlone}>
        <span className={styles.fdvAloneLabel} id="triage-fdv-alone-label">
          Asked alone?
        </span>
        <Choice
          id="triage-fdv-alone"
          label="Asked alone"
          options={[
            ["yes", "Yes"],
            ["no", "No, could not ask alone"],
          ]}
          value={state.fdvAlone}
          onChange={(v) => set("fdvAlone", v === "yes" || v === "no" ? v : null)}
        />
      </div>
      {notPrivate || (notAlone && !state.fdvNot) ? (
        <div className={styles.nudge} data-testid={notPrivate ? "triage-fdv-private" : undefined}>
          <span className={styles.grow}>
            {notAlone
              ? "Not alone: do not ask now. Tap Could not ask and choose why."
              : noInterpreter
                ? "No interpreter available: do not ask through family or friends. Tap Could not ask."
                : state.how === "phone"
                  ? "By phone: if you cannot be sure they are alone and can speak freely, choose No."
                  : "Others were present: ask only once they are alone, or choose No."}
          </span>
        </div>
      ) : null}
      {state.fdvNot || notAlone ? null : (
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
        {/* Only relevant once all three are answered No. */}
        {outcome === "Not disclosed" || outcome === "Suspected, not disclosed" ? (
          <FilterChip className={phoneRows.chip} pressed={state.fdvSus} onPressedChange={(on) => set("fdvSus", on)}>
            Suspected, not disclosed
          </FilterChip>
        ) : null}
      </ChipGroup>
      {state.fdvNot ? (
        <Reveal>
          <span id="triage-fdv-reason" className={styles.contents}>
            <MultiChips
              label="Why not asked"
              options={FDV_NOT_ASKED}
              values={state.fdvReason ? [state.fdvReason] : []}
              onToggle={(v) => set("fdvReason", state.fdvReason === v ? null : v)}
            />
          </span>
        </Reveal>
      ) : null}
      {outcome === "Disclosed" ? (
        <Reveal>
          <span className={styles.revealText}>
            Positive screen: complete the FDV951, offer social work or an FDV service. With reasonable belief of
            significant harm, consent to refer is preferred but not required.
          </span>
          {followUp("FDV actions", ["ref-primary"])}
        </Reveal>
      ) : null}
      {outcome === "Suspected, not disclosed" ? (
        <Reveal>
          <span className={styles.revealText} data-testid="triage-fdv-suspected">
            Suspected, not disclosed: note what raised your concern in the assessment. Do not press for disclosure. Ask
            again when they are alone and it is safe, and discuss with social work or a senior.
          </span>
          {followUp("FDV follow-up", ["ref-primary", "senior"])}
        </Reveal>
      ) : null}
    </>
  );
}

export function RiskBody({ form, onAllFactors }: { form: FormApi; onAllFactors: () => void }) {
  const { state, set, update, say } = form;
  const explain = useDisclosure(false);
  const carried = state.fromLast.length > 0;
  const carriedPresent = state.fromLast.filter((k) => state.f[k] === "y");
  const since = sinceLastText(state);
  const fromMse = MSE_TO_RISK.filter(([domain, phrase, flag]) => {
    const has =
      state.mseMode === "box"
        ? hasPhrase(boxLine(state.text.mseBox, domain), phrase, domain)
        : Boolean(state.mse[domain]?.chips.includes(phrase));
    return has && state.f[flag] !== "y";
  }).filter(([, , flag], index, all) => all.findIndex(([, , other]) => other === flag) === index);
  const last = state.person.last;
  const carryForward = () => {
    if (!last) return;
    update((s) => {
      const f = { ...s.f };
      const fromLast: string[] = [];
      for (const key of last.pastFlags) {
        if (!f[key]) {
          f[key] = "y";
          fromLast.push(key);
        }
      }
      // Flags only: Rest of history is always answered today.
      return { ...s, f, fromLast, confirmed: [] };
    });
    say(`Flags carried from ${last.when}. Confirm each today, and answer Rest of history.`);
  };
  const undoCarry = () =>
    update((s) => {
      const f = { ...s.f };
      for (const key of s.fromLast) delete f[key];
      return { ...s, f, fromLast: [], confirmed: [] };
    });
  const addOther = () => {
    const text = state.text.otherRisk.trim();
    if (!text) return say("Describe the risk first.");
    update((s) => ({ ...s, xr: [...s.xr, { t: text, k: s.xrKind }], text: { ...s.text, otherRisk: "" } }));
  };
  return (
    <>
      <SubHead
        tag="Past risk"
        kind="past"
        note={last ? "History. Carried from the last RAMP, then checked" : "History, answered today"}
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
                flags.map((flag) => (
                  <p key={flag} className={styles.flagInfo}>
                    <b>{FACTOR_NAME[flag]}</b>
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
          <span className={styles.grow}>
            Carried from {last?.when ?? "the last triage"}. Check each with the person, then mark it confirmed today.
            Tap a flag to change it.
          </span>
          <Button variant="ghost" size="sm" onClick={undoCarry}>
            Undo
          </Button>
          {carriedPresent.length ? (
            <div className={styles.confirmList} id="triage-carried" data-refocus="carried">
              {carriedPresent.map((key) => (
                <ChipGroup key={key} label={FACTOR_NAME[key]} className={styles.confirmItem}>
                  <span>{FACTOR_NAME[key]}</span>
                  <FilterChip
                    className={phoneRows.chip}
                    pressed={state.confirmed.includes(key)}
                    onPressedChange={() => set("confirmed", toggleIn(state.confirmed, key))}
                  >
                    Confirmed today
                  </FilterChip>
                </ChipGroup>
              ))}
            </div>
          ) : null}
        </div>
      ) : last ? (
        <div className={styles.carry}>
          <div className={styles.grow}>
            <b>{last.label}</b>
            <span>{last.pastSummary}</span>
          </div>
          {last.pastFlags.length ? (
            <Button size="sm" className={phoneRows.chip} onClick={carryForward}>
              Carry forward
            </Button>
          ) : null}
        </div>
      ) : (
        // Only a person with a previous triage on record is offered its flags; everyone else is
        // answered fresh today.
        <div className={styles.carry} data-testid="triage-no-last">
          <div className={styles.grow}>
            <b>No previous triage on record</b>
            <span>Answer past risk fresh today: mark each flag that applies, then Rest of history.</span>
          </div>
        </div>
      )}
      <FlagGroups form={form} groups={FLAGS_PAST} label="Past risk" onAllFactors={onAllFactors} />
      <div className={styles.restRow}>
        <span className={styles.grow}>
          <b>Rest of history</b> · anything not marked above
        </span>
        <Choice
          id="triage-rest-past"
          label="Rest of history"
          options={[
            ["np", "Not present"],
            ["nk", "Not known"],
          ]}
          value={state.restPast}
          onChange={(v) => set("restPast", v)}
        />
      </div>
      <Covers form={form} kind="bg" />
      <SubHead tag="Current risk" kind="now" note="Assess today. Never carried forward" />
      <FlagGroups form={form} groups={FLAGS_NOW} label="Current risk" onAllFactors={onAllFactors} />
      {state.f["other.now.parent"] === "y" ? (
        <div className={styles.nudge}>
          <span className={styles.grow}>Children or dependants: say who and where they are now in the assessment.</span>
          <MultiChips
            label="Child protection"
            options={actionOptions(["child-protection"])}
            values={state.actions}
            onToggle={(v) => set("actions", toggleIn(state.actions, v))}
          />
        </div>
      ) : null}
      {meansSafetyShown(state) ? (
        <Reveal>
          <MeansSafety form={form} />
        </Reveal>
      ) : null}
      {since ? (
        <p className={styles.since}>
          <Icon icon={Info} size={14} />
          <span>{since}</span>
        </p>
      ) : null}
      <div className={styles.restRow}>
        <span className={styles.grow}>
          <b>Rest of current risk</b> · anything not marked
        </span>
        <Choice
          id="triage-rest-now"
          label="Rest of current risk"
          options={[
            ["np", "Not present"],
            ["na", "Not assessed"],
          ]}
          value={state.rest}
          onChange={(v) => update((s) => ({ ...s, rest: v, restCov: null }))}
        />
      </div>
      <Covers form={form} kind="now" />
      {fromMse.length ? (
        <div className={styles.suggest} data-refocus="risk-suggest">
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
            <div className={styles.inline} data-refocus="other-risk">
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
            {/* Always one chosen: a second press keeps it (it is how the risk is filed, not an answer). */}
            <Segmented
              size="md"
              label="Past or current"
              className={styles.choice}
              items={[
                { id: "now", label: "Current" },
                { id: "bg", label: "Past" },
              ]}
              value={state.xrKind}
              onChange={(v) => set("xrKind", v)}
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
  const [building, setBuilding] = useState(false);
  return (
    <>
      <div className={styles.builderLine}>
        <Button size="sm" className={phoneRows.chip} onClick={() => setBuilding(true)} aria-haspopup="dialog">
          Build safety plan
        </Button>
        <span className={styles.quiet}>
          Six steps in the person&apos;s words, added under the safety plan headings.
        </span>
      </div>
      <SafetyPlanDrawer
        form={form}
        open={building}
        onClose={() => setBuilding(false)}
        prefillSafer={meansPrefill(state)}
      />
      <GuideBox
        groups={GUIDES.rp}
        text={state.text.rp}
        onHeading={box.onHeading}
        textRef={planRef}
        columns={2}
        extra={<span className={styles.quiet}>WA MP 0181/24 · NICE NG225</span>}
      />
      <Textarea
        ref={planRef}
        id="triage-rp"
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
            id="triage-changeable"
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
            id="triage-uncertain"
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
            // No typed window here (invented-figures guard): the choices above carry the times.
            <UrgencyHint>{`Urgency ${state.urgency}: consider the earliest risk review. You choose.`}</UrgencyHint>
          ) : null}
        </Row>
        <Row label="Plan copy to" labelId="triage-l-copy">
          <MultiChips
            label="Plan copy to"
            options={COPY_TO}
            values={state.copyGiven}
            onToggle={(v) => set("copyGiven", toggleIn(state.copyGiven, v))}
          />
        </Row>
      </div>
    </>
  );
}
