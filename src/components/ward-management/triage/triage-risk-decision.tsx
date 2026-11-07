"use client";

/**
 * Triage and risk: 4 Triage decision. Urgency A to G is always the clinician's choice; the
 * form only hints. Legal form and date are kept only as typed, never checked or counted down, and no
 * Mental Health Act section numbers are shown. Synthetic data only.
 */
import { Info } from "lucide-react";

import { ChipGroup, FilterChip, Icon, Segmented, SrOnly, StatusGlyph, TextInput, phoneRows } from "@/components/wf";

import { ACTIONS, AHD, LEGAL, OUTCOMES, TIERS, WHO_TOLD, type Tier } from "./triage-risk-data";
import { Choice, MultiChips, Reveal, Row, type FormApi } from "./triage-risk-parts";
import { acuteFlagNames, hasLegalForm } from "./triage-risk-state";
import styles from "./triage-risk-form.module.css";

const toggleIn = (list: readonly string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

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
  const asked = state.person.referral?.urgency ?? null;
  const toggleAction = (value: string) =>
    update((s) => {
      const actions = toggleIn(s.actions, value);
      // Telling someone replaces "None needed".
      const told = WHO_TOLD.some(([action]) => action === value) && actions.includes(value);
      return { ...s, actions, urgNone: told ? false : s.urgNone };
    });
  const toggleNoneNeeded = () =>
    update((s) => ({
      ...s,
      urgNone: !s.urgNone,
      actions: s.urgNone ? s.actions : s.actions.filter((a) => !WHO_TOLD.some(([action]) => action === a)),
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
      <Row label="Actions" top>
        <MultiChips label="Actions" options={ACTIONS} values={state.actions} onToggle={toggleAction} />
      </Row>
      {state.actions.includes("Bed request") ? (
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
      {state.actions.includes("Senior consulted") ? (
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
