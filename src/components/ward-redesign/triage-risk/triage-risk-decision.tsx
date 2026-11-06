"use client";

/**
 * Triage and risk mock-up: 4 Triage decision. Urgency A to G is always the clinician's choice; the
 * form only hints. Legal form and date are kept only as typed, never checked or counted down, and no
 * Mental Health Act section numbers are shown. Synthetic data only.
 */
import { Info } from "lucide-react";

import { Icon, Segmented, SrOnly, StatusGlyph, TextInput } from "@/components/wf";

import { ACTIONS, AHD, LEGAL, OUTCOMES, REFERRER_URGENCY, TIERS, type Tier } from "./triage-risk-data";
import { Choice, MultiChips, Reveal, Row, type FormApi } from "./triage-risk-parts";
import { acuteFlagNames, hasLegalForm } from "./triage-risk-state";
import styles from "./triage-risk-redesign.module.css";

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
  const { state, set, setText } = form;
  const acute = acuteFlagNames(state);
  const toggleAction = (value: string) => set("actions", toggleIn(state.actions, value));
  return (
    <div className={styles.rows}>
      <Row label="Urgency" hint={`Referrer asked ${REFERRER_URGENCY}`} top>
        <Segmented
          size="md"
          label="Urgency"
          className={styles.tiers}
          items={TIERS.map(([tier, short, long]) => ({
            id: tier,
            label: (
              <span className={styles.tier}>
                <span className={styles.tierLetter}>{tier}</span>
                <span className={styles.tierWindow}>{short}</span>
                <SrOnly>, {long}</SrOnly>
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
              <MultiChips
                label="Who was told"
                options={[
                  ["Police notified", "Police"],
                  ["Ambulance notified", "Ambulance"],
                  ["Senior consulted", "Senior"],
                ]}
                values={state.actions}
                onToggle={toggleAction}
              />
            </div>
          </div>
        </Reveal>
      ) : null}
      {state.urgency && state.urgency !== REFERRER_URGENCY ? (
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
        <Choice
          label="Mental Health Act"
          options={LEGAL.map(([value, label]) => [value, label] as const)}
          value={state.legal}
          onChange={(v) => set("legal", v)}
        />
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
