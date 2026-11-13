"use client";

/**
 * Triage and risk: 3 Mental state. "One box" (the default) is one textarea, with a
 * Tap-in phrases panel whose phrases land on their domain's line; "By domain" is one row per
 * domain with chips and a detail box. Switching converts the text both ways. Synthetic data only.
 */
import { useState } from "react";

import { Button, ChipGroup, FilterChip, Segmented, StatusGlyph, Textarea, TextInput, phoneRows } from "@/components/wf";

import { MSE, type MseDomain } from "./triage-risk-data";
import { autoRows, Hint, type FormApi } from "./triage-risk-parts";
import { mseAnswered, mseAnsweredCount, type TriageState } from "./triage-risk-state";
import {
  boxLine,
  boxToDomains,
  domainsToBox,
  hasPhrase,
  NA,
  toggleBoxPhrase,
  toggleDomainChip,
  type DomainEntry,
} from "./triage-risk-text";
import styles from "./triage-risk-form.module.css";

const BY_PHONE = "Not observed (by phone)";

function replacedWords(replaced: readonly string[], phrase: string) {
  return `Replaced ${replaced.join(", ").toLowerCase()} with ${phrase.toLowerCase()}`;
}

/**
 * Switches layout, carrying the text across so nothing is lost. Each switch reads the other layout
 * afresh: a line deleted from the box clears that domain, and a domain emptied of chips and detail
 * leaves no line behind.
 */
function switchMseMode(state: TriageState, mode: "box" | "dom"): TriageState {
  if (mode === state.mseMode) return state;
  if (mode === "dom") return { ...state, mseMode: "dom", mse: boxToDomains(state.text.mseBox) };
  return { ...state, mseMode: "box", text: { ...state.text, mseBox: domainsToBox(state.mse, state.text.mseBox) } };
}

function LookFor({ domain, open, onToggle }: { domain: MseDomain; open: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={styles.lookFor}
      aria-expanded={open}
      aria-controls={`triage-look-${domain.id}`}
      onClick={onToggle}
    >
      Look for
    </Button>
  );
}

export function MentalStateBody({ form }: { form: FormApi }) {
  const { state, update, say } = form;
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const [looking, setLooking] = useState<ReadonlySet<string>>(new Set());
  const toggleLook = (id: string) =>
    setLooking((open) => {
      const next = new Set(open);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const box = state.mseMode === "box";

  const tapBox = (domain: string, phrase: string) => {
    const result = toggleBoxPhrase(state.text.mseBox, domain, phrase);
    form.setText("mseBox", result.box);
    if (result.replaced.length) say(replacedWords(result.replaced, phrase));
  };
  const tapDomain = (domain: string, phrase: string) => {
    const entry: DomainEntry = state.mse[domain] ?? { chips: [], detail: "" };
    const result = toggleDomainChip(entry.chips, domain, phrase);
    update((s) => ({ ...s, mse: { ...s.mse, [domain]: { ...entry, chips: result.chips } } }));
    if (result.replaced.length) say(replacedWords(result.replaced, phrase));
  };
  const setDetail = (domain: string, detail: string) =>
    update((s) => ({ ...s, mse: { ...s.mse, [domain]: { chips: s.mse[domain]?.chips ?? [], detail } } }));
  const notObservedByPhone = () => {
    if (box) return tapBox("app", BY_PHONE);
    update((s) => ({
      ...s,
      mse: { ...s.mse, app: { chips: [NA], detail: s.mse.app?.detail || "By phone" } },
    }));
  };

  return (
    <>
      <Hint>
        Nothing is assumed normal. Each domain builds its own line; &quot;Look for&quot; explains what to check.
      </Hint>
      {state.how === "phone" && !mseAnswered(state, "app") ? (
        <div className={styles.nudge}>
          <span className={styles.grow}>
            Reviewed by phone. Record what you heard; mark what you could not see in one tap.
          </span>
          <Button size="sm" className={phoneRows.chip} onClick={notObservedByPhone}>
            Appearance not observed
          </Button>
        </div>
      ) : null}
      <div className={styles.guideBar}>
        <Segmented
          size="md"
          label="Mental state layout"
          className={styles.choice}
          items={[
            { id: "box", label: "One box" },
            { id: "dom", label: "By domain" },
          ]}
          value={state.mseMode}
          onChange={(mode) => update((s) => switchMseMode(s, mode))}
        />
        <span className={styles.quiet}>Switch any time. Nothing is lost.</span>
        {box ? (
          <Button
            size="sm"
            className={`${styles.pushEnd} ${phoneRows.chip}`}
            aria-expanded={phrasesOpen}
            aria-controls="triage-mse-phrases"
            onClick={() => setPhrasesOpen((open) => !open)}
          >
            {phrasesOpen ? "Hide phrases" : "Show phrases"}
          </Button>
        ) : null}
      </div>
      {box ? (
        <>
          <Textarea
            id="triage-mse-box"
            aria-label="Mental state"
            rows={autoRows(state.text.mseBox, 5)}
            placeholder="Type, or use Show phrases to tap them in. One line per domain, for example: Speech: pressured, hard to interrupt"
            value={state.text.mseBox}
            onChange={(event) => form.setText("mseBox", event.target.value)}
          />
          {/* 7 Nov 2026: one short foot; the placeholder and Show phrases already say how to add. */}
          <div className={styles.boxFoot}>
            {/* A9-22(d): a line counts only when it starts with the domain's exact name and a colon, so say so. */}
            <span>
              {phrasesOpen
                ? "Tap a phrase again to remove it."
                : "One line per domain. Start each line with the domain's name and a colon, as in Speech:"}
            </span>
            <span className={styles.mono} data-testid="triage-mse-count">
              {mseAnsweredCount(state)} of {MSE.length} domains
            </span>
          </div>
          {phrasesOpen ? (
            <div className={styles.phrasePanel} id="triage-mse-phrases">
              {MSE.map((domain) => {
                const line = boxLine(state.text.mseBox, domain.id);
                return (
                  <div key={domain.id} className={styles.phraseRow}>
                    <div className={styles.phraseHead}>
                      <span className={styles.domainLabel}>{domain.label}</span>
                      <LookFor domain={domain} open={looking.has(domain.id)} onToggle={() => toggleLook(domain.id)} />
                    </div>
                    <ChipGroup label={`${domain.label} phrases`} className={phoneRows.chipRow}>
                      {[...domain.phrases, "Not assessed"].map((phrase) => (
                        <FilterChip
                          key={phrase}
                          className={`${phoneRows.chip} ${phrase === "Not assessed" ? styles.notAssessed : ""}`}
                          pressed={hasPhrase(line, phrase, domain.id)}
                          onPressedChange={() => tapBox(domain.id, phrase)}
                        >
                          {phrase}
                        </FilterChip>
                      ))}
                    </ChipGroup>
                    {looking.has(domain.id) ? (
                      <p className={styles.lookText} id={`triage-look-${domain.id}`}>
                        {domain.lookFor}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.domainList}>
          {MSE.map((domain) => {
            const entry = state.mse[domain.id];
            const answered = mseAnswered(state, domain.id);
            return (
              <div key={domain.id} className={styles.domainRow}>
                <div className={styles.phraseHead}>
                  <span className={styles.domainLabel} id={`triage-dl-${domain.id}`}>
                    <StatusGlyph tone={answered ? "success" : "neutral"} size={10} />
                    {domain.label}
                  </span>
                  <LookFor domain={domain} open={looking.has(domain.id)} onToggle={() => toggleLook(domain.id)} />
                </div>
                <div className={styles.domainBody}>
                  {looking.has(domain.id) ? (
                    <p className={styles.lookText} id={`triage-look-${domain.id}`}>
                      {domain.lookFor}
                    </p>
                  ) : null}
                  <ChipGroup label={domain.label} className={phoneRows.chipRow}>
                    {[...domain.phrases, NA].map((phrase) => (
                      <FilterChip
                        key={phrase}
                        className={`${phoneRows.chip} ${phrase === NA ? styles.notAssessed : ""}`}
                        pressed={Boolean(entry?.chips.includes(phrase))}
                        onPressedChange={() => tapDomain(domain.id, phrase)}
                      >
                        {phrase === NA ? "Not assessed" : phrase}
                      </FilterChip>
                    ))}
                  </ChipGroup>
                  <TextInput
                    id={`triage-mx-${domain.id}`}
                    aria-label={`${domain.label} detail`}
                    placeholder={domain.detailHint}
                    value={entry?.detail ?? ""}
                    onChange={(event) => setDetail(domain.id, event.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
