"use client";

/**
 * Triage and risk (built 7 Nov 2026): the Start a triage step, at `/ward-flow/triage/new`. Opened from
 * New, then Triage, in the app bar (New triage in the phone's Create sheet), or from the form's own
 * "Start a new triage". It asks who the triage is for: a search over the synthetic world's people, the
 * referrals still waiting for a triage, and Add patient for someone not found. Choosing a person
 * opens their form blank. Synthetic data only; the typed search stays in React and is never stored.
 */
import { ChevronRight, Inbox, UserPlus } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Badge, Card, CardBody, CardHead, FormalName, Hero, Icon, SearchField, buttonClass } from "@/components/wf";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";

import type { TriagePerson } from "./triage-risk-data";
import { legalLine, searchTriagePeople } from "./triage-risk-people";
import { useTriagePeople } from "./use-triage-people";
import styles from "./triage-risk-start.module.css";

function PersonRow({
  person,
  onChoose,
  showReferral,
}: {
  person: TriagePerson;
  onChoose: () => void;
  showReferral: boolean;
}) {
  return (
    <li>
      <button type="button" className={styles.person} onClick={onChoose} data-testid="triage-start-person">
        <span className={styles.personText}>
          <span className={styles.personName}>
            <FormalName name={person.name} />
            <span className={styles.personMeta}>{person.meta}</span>
          </span>
          <span className={styles.personLine}>
            UMRN <b className={styles.mono}>{person.umrn}</b> · DOB <b className={styles.mono}>{person.dob}</b>
          </span>
          <span className={styles.personLine}>
            Now at {person.nowAt === "Not recorded" ? <i className={styles.quiet}>not recorded</i> : person.nowAt}
          </span>
          <span className={styles.personLine}>{legalLine(person)}</span>
          <span className={styles.tags}>
            {showReferral && person.referral ? (
              <Badge>
                Open referral {person.referral.id} · {person.referral.from}
              </Badge>
            ) : null}
            {person.last ? <Badge>Previous triage on record</Badge> : null}
          </span>
        </span>
        <Icon icon={ChevronRight} size={16} className={styles.chevron} />
      </button>
    </li>
  );
}

export function TriageStart({ onChoose }: { onChoose: (person: TriagePerson) => void }) {
  const { people, awaiting } = useTriagePeople();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchTriagePeople(people, query), [people, query]);
  const searching = query.trim().length > 0;
  const headingId = useId();
  return (
    <main id="main-content" className={styles.main} data-testid="triage-start">
      <Hero
        level={1}
        eyebrow="Triage and risk · Synthetic"
        title="Start a triage"
        titleMeta="SMHMR900 and SMHMR905"
        lead="Choose who it is for. The form opens blank, with nothing pre-selected."
      />
      <div className={styles.grid}>
        <Card className={styles.card} aria-labelledby={headingId}>
          <CardHead id={headingId} title="Who is this triage for?" meta="Synthetic people" />
          <CardBody className={styles.body}>
            <SearchField
              id="triage-start-search"
              label="Search by name, UMRN or date of birth"
              placeholder="Surname, given name, UMRN or DOB"
              value={query}
              onValueChange={setQuery}
              count={searching ? { shown: matches.length, total: people.length, noun: "people" } : undefined}
            />
            {searching ? (
              matches.length ? (
                <ul className={styles.list} aria-label="Matching people">
                  {matches.map((person) => (
                    <PersonRow key={person.id} person={person} onChoose={() => onChoose(person)} showReferral />
                  ))}
                </ul>
              ) : (
                <p className={styles.empty} data-testid="triage-start-no-match">
                  No synthetic person matches. Check the spelling, or add them.
                </p>
              )
            ) : (
              <p className={styles.quiet}>
                Type a surname, UMRN or date of birth. Surnames that start with it come first.
              </p>
            )}
            <Link href={WARD_ADD_PERSON_HREF} className={buttonClass({ variant: "sec", className: styles.add })}>
              <Icon icon={UserPlus} size={16} />
              Not found? Add patient
            </Link>
          </CardBody>
        </Card>
        <Card className={styles.card} aria-labelledby={`${headingId}-awaiting`}>
          <CardHead
            id={`${headingId}-awaiting`}
            title="Referrals awaiting triage"
            icon={Inbox}
            iconPlain
            meta={`${awaiting.length}`}
          />
          <CardBody className={styles.body}>
            {awaiting.length ? (
              <ul className={styles.list} aria-label="Referrals awaiting triage">
                {awaiting.map((person) => (
                  <PersonRow
                    key={`${person.id}-${person.referral?.id}`}
                    person={person}
                    onChoose={() => onChoose(person)}
                    showReferral
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.quiet}>No referral is waiting for a triage.</p>
            )}
          </CardBody>
        </Card>
      </div>
      <p className={styles.footNote}>
        Ward Flow prototype. Synthetic people only. Not validated clinical decision support.
      </p>
    </main>
  );
}
