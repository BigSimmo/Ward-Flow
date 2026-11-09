"use client";

import { useId, useMemo, useState } from "react";
import { Clock3, Search } from "lucide-react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { Button, Radio, ShowMoreRow, TextInput, foldHidden, foldLimit } from "@/components/wf";
import remind from "./ward-tool-remind-me.module.css";
import styles from "./ward-tool-call-log.module.css";

const PERSON_LIMIT = 5;

/**
 * Log a delay (friction pass item 6c, Josh's approval, 9 Nov 2026): a short form in Tools in place
 * of a trip to the Waiting page. Pick the person, say what is holding them up, Log delay. It records
 * the same "what is holding this up" note as the movement panel (`RECORD_MOVEMENT_BLOCKER`), with
 * the same roles and the same words-only rule. People this desk may open, longest open first.
 */
export function ToolLogDelay() {
  const { movements, patients, referrals } = useWardFlowSelect("movements", "patients", "referrals");
  const now = useWardFlowClock();
  const canOpen = useCanOpenHref();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const gate = useRoleGate()("RECORD_MOVEMENT_BLOCKER");
  const save = useWardFormSave("tools-log-delay");
  const baseId = useId();

  const [personId, setPersonId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const people = useMemo(
    () =>
      movements
        .filter((movement) => isOpen(movement) && canOpen(movementHref(movement.id)))
        .sort((a, b) => a.openedAt - b.openedAt)
        .map((movement) => ({ movement, who: resolveSubjectPatient(movement, { patients, referrals, movements }) })),
    [movements, patients, referrals, canOpen],
  );
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? people.filter(
        ({ who }) => who.formalName.toLowerCase().includes(needle) || who.umrn.toLowerCase().includes(needle),
      )
    : people;
  const chosen = people.find(({ movement }) => movement.id === personId);
  const folded = matches.slice(0, foldLimit(matches.length, PERSON_LIMIT));
  const shown = all || needle ? matches : chosen && !folded.includes(chosen) ? [...folded, chosen] : folded;
  const hidden = needle ? 0 : foldHidden(matches.length, PERSON_LIMIT);
  const missing = !gate.allowed
    ? gate.reason
    : !chosen
      ? "Pick a person"
      : draft.trim().length === 0
        ? "Say what is holding this up"
        : save.pending
          ? "Saving"
          : undefined;

  function submit() {
    if (!chosen || draft.trim().length === 0 || !gate.allowed) return;
    const name = chosen.who.formalName;
    save.submit(
      () => raise("RECORD_MOVEMENT_BLOCKER", { movementId: chosen.movement.id, blocker: draft }),
      () => {
        setSaved(`Logged for ${name} at ${formatInstantWithDay(now, now)}.`);
        setDraft("");
        setPersonId(null);
      },
    );
  }

  return (
    <div className={remind.tool} data-testid="tools-log-delay">
      <fieldset className={styles.said}>
        <legend className={remind.label}>Who</legend>
        <TextInput
          icon={Search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder="Name or UR number"
          aria-label="Find a person by name or UR number"
          autoComplete="off"
        />
        {shown.length === 0 ? (
          <p className={styles.saved}>{needle ? "No one open matches." : "No one open at this desk."}</p>
        ) : (
          <div className={styles.card}>
            {shown.map(({ movement, who }) => {
              const blocker = movement.blocker.trim();
              return (
                <Radio
                  key={movement.id}
                  name="log-delay-person"
                  className={styles.option}
                  checked={movement.id === personId}
                  onChange={() => {
                    setPersonId(movement.id);
                    setSaved(null);
                  }}
                  data-testid={`tools-log-delay-person-${movement.id}`}
                  label={
                    <span className={styles.optionText}>
                      <strong>
                        {who.formalName} <span className={remind.mono}>{who.umrn}</span>
                      </strong>
                      <span>{[stageCopy[movement.stage].label, blocker].filter(Boolean).join(" · ")}</span>
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
        {hidden > 0 ? (
          <ShowMoreRow onClick={() => setAll(!all)} expanded={all}>
            {all ? "Show fewer" : `Show ${hidden} more`}
          </ShowMoreRow>
        ) : null}
      </fieldset>

      <div className={remind.step}>
        <label className={remind.label} htmlFor={`${baseId}-text`}>
          What is holding this up
        </label>
        <TextInput
          id={`${baseId}-text`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Awaiting single-room clean"
          autoComplete="off"
          aria-describedby={`${baseId}-hint`}
          data-testid="tools-log-delay-text"
        />
        <p className={styles.saved} id={`${baseId}-hint`}>
          Wards, roles and jobs only. Never a name or clinical detail.
        </p>
      </div>

      <div className={remind.actions}>
        <Button
          variant="pri"
          icon={Clock3}
          disabledReason={missing}
          onClick={submit}
          data-testid="tools-log-delay-save"
        >
          Log delay
        </Button>
      </div>
      {save.error ? (
        <p className={styles.saved} role="alert">
          {save.error}
        </p>
      ) : null}
      {saved ? (
        <p className={styles.saved} role="status">
          {saved}
        </p>
      ) : null}
    </div>
  );
}
