"use client";

/**
 * THE ONE SUBURB LOOKUP CARD (D-91, Josh, 31 Oct 2026: "the three suburb lookups" become one).
 * Community, the ward's Discharges tab and the Tools sheet each drew their own suburb box; they
 * already share one engine (#1123), and now they share this card. Drawn here, on Community, and
 * reused by the other two.
 *
 * - One page search field (`parts/search-field.tsx`): a whole suburb, an alias or a 4-digit
 *   postcode. A postcode lists every suburb filed under it.
 * - Each suburb answers on its own, with its postcodes and its state as a word: Reviewed,
 *   Contested, Unreviewed or Not found.
 * - **A contested or unreviewed suburb names no single clinic.** Contested shows its note and every
 *   reading beside its document; unreviewed shows its note and no team. Only a reviewed row names
 *   its team or teams, and only there may the caller add its own actions (Open, Show in list).
 * - Optional quick picks, as one sliding row on a phone (`parts/phone-rows.module.css`).
 *
 * Synthetic catchment data only. Typed words stay in memory.
 *
 * Example (the Tools sheet):
 *
 *     <SuburbLookupCard teamActions={(clinic) => <Button size="sm">Refer to {clinic}</Button>} />
 */
import { useId, useMemo, useState, type ReactNode } from "react";

import { Badge, Card, CardBody, CardHead, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
import type { CatchmentLookup } from "@/components/ward-management/ward-catchment";

import { SearchField } from "../parts/search-field";
import { ShowMoreRow } from "../parts/show-more-row";
import phoneRows from "../parts/phone-rows.module.css";
import { catchmentLookupsFor, isPostcodeQuery } from "./suburb-lookup";
import styles from "./suburb-lookup-card.module.css";

/** A postcode can file many suburbs under it: the first few answer, then Show more. */
const SUBURBS_SHOWN = 3;

const STATE_WORD: Record<CatchmentLookup["state"], { word: string; tone: WfTone }> = {
  reviewed: { word: "Reviewed", tone: "success" },
  contested: { word: "Contested", tone: "warning" },
  unreviewed: { word: "Unreviewed", tone: "warning" },
  unknown: { word: "Not found", tone: "neutral" },
};

export type SuburbLookupCardProps = {
  /** The card's heading. */
  title?: string;
  /** One quiet line beside the heading. */
  note?: ReactNode;
  /** The words the field opens with, for example the first quick pick. */
  initialQuery?: string;
  /** Suburbs offered as one tap (Community: the suburbs whose row names more than one team). */
  picks?: readonly string[];
  /** The quick picks' spoken name. */
  picksLabel?: string;
  /** A reviewed team's second line, for example its health service and suburb count. */
  teamMeta?: (clinic: string) => ReactNode;
  /** A reviewed team's own actions. Never drawn for a contested or unreviewed suburb. */
  teamActions?: (clinic: string) => ReactNode;
  /** `bar`: the field and the answer side by side on a wide screen (Community's full-width bar). */
  layout?: "stacked" | "bar";
  /** On a phone, no card chrome: the page's own pane is the card (Community's Suburb pane). */
  plainOnPhone?: boolean;
  className?: string;
};

export function SuburbLookupCard({
  title = "Suburb lookup",
  note = "Which team covers it",
  initialQuery = "",
  picks = [],
  picksLabel = "Suburbs to try",
  teamMeta,
  teamActions,
  layout = "stacked",
  plainOnPhone = false,
  className,
}: SuburbLookupCardProps) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [showAll, setShowAll] = useState(false);
  const trimmed = query.trim();
  const lookups = useMemo(() => catchmentLookupsFor(trimmed), [trimmed]);
  const shown = showAll ? lookups : lookups.slice(0, SUBURBS_SHOWN);

  return (
    <Card
      className={cx(styles.card, plainOnPhone && styles.plainOnPhone, className)}
      aria-labelledby={`${id}-title`}
      data-testid="suburb-lookup-card"
    >
      <CardHead id={`${id}-title`} title={title} eyebrow aside={<span className={styles.headNote}>{note}</span>} />
      <CardBody className={cx(styles.body, layout === "bar" && styles.bar)}>
        <div className={styles.ask}>
          <SearchField
            id={`${id}-field`}
            label="Suburb or postcode"
            placeholder="Suburb, alias or postcode"
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              setShowAll(false);
            }}
          />
          {picks.length > 0 ? (
            <div className={cx(styles.picks, phoneRows.chipRow)} role="group" aria-label={picksLabel}>
              {picks.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.pick, phoneRows.chip)}
                  aria-pressed={pick.toLowerCase() === trimmed.toLowerCase()}
                  onClick={() => {
                    setQuery(pick);
                    setShowAll(false);
                  }}
                >
                  {pick}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.answer} aria-live="polite" id={`${id}-answer`}>
          {trimmed === "" ? (
            <p className={styles.hint}>
              Type a suburb or a 4-digit postcode to see the team the catchment table names.
            </p>
          ) : lookups.length === 0 ? (
            <p className={styles.hint}>No suburb is filed under postcode {trimmed} in the catchment documents.</p>
          ) : (
            <>
              {isPostcodeQuery(trimmed) ? (
                <p className={styles.postcodeLine}>
                  <b className={styles.num}>{lookups.length}</b> {lookups.length === 1 ? "suburb" : "suburbs"} filed
                  under {trimmed}
                </p>
              ) : null}
              {shown.map((lookup, index) => (
                <SuburbAnswer
                  key={`${lookup.suburb ?? lookup.query}-${index}`}
                  lookup={lookup}
                  teamMeta={teamMeta}
                  teamActions={teamActions}
                />
              ))}
              {lookups.length > SUBURBS_SHOWN ? (
                <ShowMoreRow onClick={() => setShowAll((all) => !all)} expanded={showAll} controls={`${id}-answer`}>
                  {showAll ? "Show fewer" : `Show ${lookups.length - SUBURBS_SHOWN} more suburbs`}
                </ShowMoreRow>
              ) : null}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/** One suburb's answer: its name, postcodes and state, then what that state allows it to say. */
function SuburbAnswer({
  lookup,
  teamMeta,
  teamActions,
}: {
  lookup: CatchmentLookup;
  teamMeta?: (clinic: string) => ReactNode;
  teamActions?: (clinic: string) => ReactNode;
}) {
  const state = STATE_WORD[lookup.state];
  const answers = lookup.state === "unknown" ? [] : lookup.answers;
  const postcodes = [...new Set(answers.flatMap((answer) => answer.postcodes))];
  const name = lookup.suburb ?? lookup.query.trim();
  const viaAlias = lookup.matchedVia?.kind === "alias" ? lookup.query.trim() : null;
  const clinics = lookup.state === "reviewed" ? [...new Set(answers.flatMap((answer) => answer.clinics))] : [];

  return (
    <section className={styles.suburb} aria-label={name}>
      <header className={styles.suburbHead}>
        <span className={styles.suburbName}>
          {name}
          {viaAlias ? <span className={styles.alias}>written {viaAlias}</span> : null}
        </span>
        {postcodes.length > 0 ? <span className={styles.postcodes}>{postcodes.join(", ")} WA</span> : null}
        <Badge tone={state.tone} size="sm" className={styles.state}>
          {state.word}
        </Badge>
      </header>

      {lookup.state === "reviewed" ? (
        <>
          {clinics.length > 1 ? (
            <p className={styles.warn}>
              <StatusGlyph tone="warning" size={9} />
              <span>
                {clinics.length} teams name {name}. Check the right one.
              </span>
            </p>
          ) : null}
          <ul className={styles.teams}>
            {clinics.map((clinic) => (
              <li key={clinic} className={styles.team}>
                <span className={styles.teamName}>
                  {clinic}
                  {teamMeta ? <span className={styles.teamMeta}>{teamMeta(clinic)}</span> : null}
                </span>
                {teamActions ? <span className={styles.teamActions}>{teamActions(clinic)}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : lookup.state === "contested" ? (
        <>
          <p className={styles.note}>{lookup.note}</p>
          {/* Every reading beside its document, never one picked: the reader chooses. */}
          <ul className={styles.readings} aria-label={`Readings for ${name}`}>
            {lookup.answers.map((answer, index) => (
              <li key={`${answer.document.id}-${index}`} className={styles.reading}>
                <span className={styles.readingText}>{answer.clinics.join(" / ") || "No clinic recorded"}</span>
                <span className={styles.readingSource}>
                  {answer.document.id}
                  {answer.document.date ? `, ${answer.document.date}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : lookup.state === "unreviewed" ? (
        <>
          <p className={styles.note}>{lookup.note}</p>
          <p className={styles.quiet}>No team is named here until the row is reviewed. Check the source row first.</p>
        </>
      ) : (
        <p className={styles.note}>{lookup.note}</p>
      )}
    </section>
  );
}
