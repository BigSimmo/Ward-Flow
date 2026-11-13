"use client";

/**
 * Triage and risk: 4 Triage decision. Urgency A to G is always the clinician's choice; the
 * form only hints. Legal form and date are kept only as typed, never checked or counted down, and no
 * Mental Health Act section numbers are shown. Synthetic data only.
 */
import { Clock, Info } from "lucide-react";

import { ChipGroup, FilterChip, Icon, Segmented, SrOnly, StatusGlyph, TextInput, phoneRows } from "@/components/wf";

import {
  ACTION_GROUP_LABEL,
  ACTIONS_COMMON,
  PSOLIS_ACTIONS,
  REFERRED_TO_ACTIONS,
  type ActionGroup,
} from "./triage-psolis-lists";
import { AHD, LEGAL, OUTCOMES, TIER_LONG, TIERS, WHO_TOLD, type Tier } from "./triage-risk-data";
import { seeBy } from "./triage-see-by";
import { perthWallClockDate } from "./triage-risk-text";
import { FOLLOW_UP_CHOICES, followUpHint, followUpShown, recentDischargeFor } from "./triage-risk-safety";
import { Choice, PickMany, Reveal, Row, type FormApi } from "./triage-risk-parts";
import { acuteFlagNames, hasLegalForm } from "./triage-risk-state";
import styles from "./triage-risk-form.module.css";

const toggleIn = (list: readonly string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const ACTION_GROUP: Readonly<Record<string, ActionGroup>> = Object.fromEntries(
  PSOLIS_ACTIONS.map(([code, , , group]) => [code, group]),
);
/** The More list's heading for an action: Notified, Referred to, Advised or Done. */
const actionGroupOf = (code: string) => {
  const group = ACTION_GROUP[code];
  return group ? ACTION_GROUP_LABEL[group] : undefined;
};
const isTold = (code: string) => WHO_TOLD.some(([action]) => action === code);

export function UrgencyHint({ children }: { children: string }) {
  return (
    <p className={styles.urgHint}>
      <Icon icon={Info} size={14} />
      <span>{children}</span>
    </p>
  );
}

export function DecisionBody({ form }: { form: FormApi }) {
  const { state, set, setText, update } = form;
  const acute = acuteFlagNames(state);
  const due = seeBy(
    state.urgency,
    state.text.revTime,
    perthWallClockDate(form.now),
    state.urgency ? TIER_LONG[state.urgency] : "",
  );
  const asked = state.person.referral?.urgency ?? null;
  // Follow-up (9 Nov 2026): a hint from marked current risk or a recent discharge on the record; never a choice.
  const followHint = followUpShown(state.outcome)
    ? followUpHint(state, recentDischargeFor(state.person.id, perthWallClockDate(form.now)))
    : null;
  const setActions = (actions: string[]) =>
    update((s) => {
      // Telling someone replaces "None needed".
      const told = actions.some((code) => isTold(code) && !s.actions.includes(code));
      return { ...s, actions, urgNone: told ? false : s.urgNone };
    });
  const toggleAction = (value: string) => setActions(toggleIn(state.actions, value));
  const referredNudge =
    state.outcome === "Referred on" &&
    !state.actions.some((code) => (REFERRED_TO_ACTIONS as readonly string[]).includes(code));
  const toggleNoneNeeded = () =>
    update((s) => ({
      ...s,
      urgNone: !s.urgNone,
      actions: s.urgNone ? s.actions : s.actions.filter((a) => !isTold(a)),
    }));
  return (
    <div className={styles.rows}>
      <Row label="Urgency" hint={asked ? `Referrer asked ${asked}` : "No urgency asked"} top>
        <Segmented
          size="md"
          label="Urgency"
          className={`${styles.tiers} ${styles.choice}`}
          items={TIERS.map(([tier, short, long]) => ({
            id: tier,
            label: (
              <span className={styles.tier}>
                <span className={styles.tierLetter} aria-hidden="true">
                  {tier}
                </span>
                <span className={styles.tierWindow} aria-hidden="true">
                  {short}
                </span>
                <SrOnly>{`${tier} ${short}, ${long}`}</SrOnly>
              </span>
            ),
          }))}
          value={state.urgency ?? ""}
          onChange={(tier) => set("urgency", tier === state.urgency ? null : (tier as Tier))}
        />
        {acute.length ? (
          <UrgencyHint>{`Hint: flags include ${acute.join(", ")}. Consider A or B. You choose.`}</UrgencyHint>
        ) : null}
        {due ? (
          <p className={styles.urgHint} data-testid="triage-see-by-hint">
            <Icon icon={Clock} size={14} />
            <span>
              See by <b>{due.when}</b>.{" "}
              {due.unsigned ? <b data-testid="triage-see-by-unsigned">Window not signed. </b> : null}
              {due.when === "Now"
                ? "Immediate response."
                : "Counted from the reviewed time with this tier's window. Shown on the banner too."}
            </span>
          </p>
        ) : state.urgency && TIER_LONG[state.urgency] && !["F", "G"].includes(state.urgency) ? (
          <UrgencyHint>Set the reviewed time and the see-by time appears.</UrgencyHint>
        ) : null}
      </Row>
      {state.urgency === "A" ? (
        <Reveal act>
          <div className={styles.actLine}>
            <StatusGlyph tone="danger" size={12} />
            <div className={styles.stack}>
              <span>
                <b>Immediate response.</b> If anyone is in danger now, call 000 or police. Record who you told:
              </span>
              <span id="triage-urg-who" className={styles.contents}>
                <ChipGroup label="Who was told" className={phoneRows.chipRow}>
                  {WHO_TOLD.map(([value, label]) => (
                    <FilterChip
                      key={value}
                      className={phoneRows.chip}
                      pressed={state.actions.includes(value)}
                      onPressedChange={() => toggleAction(value)}
                    >
                      {label}
                    </FilterChip>
                  ))}
                  <FilterChip className={phoneRows.chip} pressed={state.urgNone} onPressedChange={toggleNoneNeeded}>
                    None needed
                  </FilterChip>
                </ChipGroup>
              </span>
              {state.urgNone ? (
                <TextInput
                  id="triage-urg-none-why"
                  aria-label="Why no one needed to be told"
                  placeholder="Why no one needed to be told"
                  value={state.text.urgNoneWhy}
                  onChange={(event) => setText("urgNoneWhy", event.target.value)}
                />
              ) : null}
            </div>
          </div>
        </Reveal>
      ) : null}
      {state.urgency && asked && state.urgency !== asked ? (
        <Reveal>
          <Row label="Why it differs" htmlFor="triage-urg-reason">
            <TextInput
              id="triage-urg-reason"
              placeholder="One line"
              value={state.text.urgReason}
              onChange={(event) => setText("urgReason", event.target.value)}
            />
          </Row>
        </Reveal>
      ) : null}
      <Row label="Outcome">
        <Choice label="Outcome" options={OUTCOMES} value={state.outcome} onChange={(v) => set("outcome", v)} />
      </Row>
      {followUpShown(state.outcome) ? (
        <Reveal>
          <Row label="Follow-up" hint="Contact after this triage" top>
            <div className={styles.stack} data-testid="triage-follow-up">
              <Choice
                id="triage-follow-up"
                label="Follow-up"
                options={FOLLOW_UP_CHOICES}
                value={state.followUp}
                onChange={(v) => set("followUp", v)}
              />
              {followHint ? <UrgencyHint>{followHint}</UrgencyHint> : null}
              {state.followUp === "none" ? (
                <TextInput
                  id="triage-follow-up-why"
                  aria-label="Say why follow-up is not needed"
                  placeholder="Say why"
                  value={state.text.followUpWhy}
                  onChange={(event) => setText("followUpWhy", event.target.value)}
                />
              ) : (
                <TextInput
                  id="triage-follow-up-who"
                  aria-label="Who will contact"
                  placeholder="Who will contact"
                  value={state.text.followUpWho}
                  onChange={(event) => setText("followUpWho", event.target.value)}
                />
              )}
            </div>
          </Row>
        </Reveal>
      ) : null}
      <Row label="Actions" top>
        <PickMany
          id="triage-actions"
          label="Actions"
          noun="actions"
          list={PSOLIS_ACTIONS}
          common={ACTIONS_COMMON}
          values={state.actions}
          onChange={setActions}
          groupOf={actionGroupOf}
          other={{
            code: "other",
            label: "Other action, in a few words",
            value: state.text.actionOther,
            onChange: (v) => setText("actionOther", v),
          }}
        />
        {referredNudge ? (
          <p className={styles.nudgeLine} data-testid="triage-referred-nudge">
            <StatusGlyph tone="neutral" size={8} />
            <span>Referred on: add who to, such as Referred to community mental health.</span>
          </p>
        ) : null}
      </Row>
      {state.actions.includes("bed-request") ? (
        <Reveal>
          <Row label="Medically cleared" hint="Needed for a bed request">
            <Choice
              label="Medically cleared"
              options={[
                ["yes", "Cleared"],
                ["pending", "Pending"],
                ["na", "Not needed"],
              ]}
              value={state.medical}
              onChange={(v) => set("medical", v)}
            />
          </Row>
        </Reveal>
      ) : null}
      {state.actions.includes("senior") ? (
        <Reveal>
          <Row label="Consulted with" hint="Name and outcome" htmlFor="triage-consult">
            <TextInput
              id="triage-consult"
              placeholder="Dr R. Patel, consultant: agrees with plan"
              value={state.text.consultWho}
              onChange={(event) => setText("consultWho", event.target.value)}
            />
          </Row>
        </Reveal>
      ) : null}
      <Row label="Mental Health Act">
        <Choice label="Mental Health Act" options={LEGAL} value={state.legal} onChange={(v) => set("legal", v)} />
      </Row>
      {hasLegalForm(state) ? (
        <Reveal>
          <Row label="Form and date, as typed" hint="Not legally checked." htmlFor="triage-legal-form">
            <TextInput
              id="triage-legal-form"
              className={styles.mono}
              placeholder="Form 5A · 28/01/2027 23:59"
              value={state.text.legalForm}
              onChange={(event) => setText("legalForm", event.target.value)}
            />
          </Row>
        </Reveal>
      ) : null}
      <Row label="Directive or guardian">
        <Choice label="Directive or guardian" options={AHD} value={state.ahd} onChange={(v) => set("ahd", v)} />
      </Row>
      {state.ahd === "ahd" ? (
        <Reveal>
          <Row label="Directive copy" hint="Follow any relevant decision">
            <Choice
              label="Directive copy"
              options={[
                ["onfile", "On the record"],
                ["toget", "To be provided"],
              ]}
              value={state.ahdCopy}
              onChange={(v) => set("ahdCopy", v)}
            />
          </Row>
        </Reveal>
      ) : null}
    </div>
  );
}
