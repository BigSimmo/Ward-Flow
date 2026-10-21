"use client";

import Link from "next/link";

import { FactGrid, RowSpark, StatusGlyph, useIsPhone } from "@/components/wf";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { splitDuration } from "@/components/ward-management/ward-clock";

import {
  CLOCK_TONE,
  personDim,
  trendSpanHours,
  trendStepHours,
  waitLine,
  type EdPerson,
  type EdRow,
  type Highlight,
} from "./ed-index";
import styles from "./ed-index.module.css";

/** The ED preview's body: facts, the 12 hour trend and who is waiting, longest first. */
export function EdPreview({
  row,
  highlight,
  accessTarget,
}: {
  row: EdRow;
  highlight: Highlight | null;
  accessTarget: number;
}) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.preview} data-testid="ed-index-preview-body">
      <FactGrid
        className={styles.previewFacts}
        facts={[
          { id: "waiting", label: "Waiting", value: <b className={styles.num}>{row.summary.waiting}</b> },
          {
            id: "past",
            label: `Past ${waitLine(accessTarget)}`,
            value: <b className={styles.num}>{row.pastTarget}</b>,
          },
          { id: "no-bed", label: "No bed yet", value: <b className={styles.num}>{row.noBed}</b> },
          { id: "form", label: "Under a form", value: <b className={styles.num}>{row.forms}</b> },
        ]}
      />
      <section className={styles.previewSection} aria-labelledby="ed-preview-trend">
        <h3 id="ed-preview-trend" className={styles.eyebrow}>
          {`Last ${trendSpanHours} hours`}
        </h3>
        <div className={styles.previewTrend}>
          <RowSpark values={row.trend} name={row.short} big testId="ed-row-spark" />
          <span className={styles.meta}>{`${row.trend.join(" · ")} now · every ${trendStepHours}h`}</span>
        </div>
      </section>
      <section className={styles.previewSection} aria-labelledby="ed-preview-people">
        <h3 id="ed-preview-people" className={styles.eyebrow}>
          Waiting, longest first
        </h3>
        {row.people.length === 0 ? (
          <p className={styles.previewEmpty}>
            <StatusGlyph tone="success" size={9} /> No one waiting at {row.short}
          </p>
        ) : (
          <ul className={styles.previewList} data-phone={isPhone ? "true" : undefined}>
            {row.people.map((person) => (
              <li
                key={person.movement.id}
                className={styles.previewPerson}
                data-act-now={person.clock === "past" ? "true" : undefined}
                data-dim={personDim(person, highlight) ? "true" : undefined}
              >
                <StatusGlyph tone={CLOCK_TONE[person.clock]} size={9} />
                <span className={styles.previewText}>
                  <Link href={person.href} className={styles.previewName}>
                    {person.name}
                  </Link>
                  <span className={styles.meta}>
                    {isPhone ? (
                      <>
                        <span className={styles.previewUmrn}>{person.umrn}</span> ·{" "}
                      </>
                    ) : null}
                    {person.stage}
                    {person.movement.legalForm ? ` · Form ${person.movement.legalForm.code}` : ""}
                    {person.destination ? ` · ${person.destination}` : ""}
                  </span>
                </span>
                <b className={styles.num}>{splitDuration(person.wait)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The phone wait-lane sheet's facts for the picked person. */
export function EdLaneFacts({ person }: { person: EdPerson }) {
  return (
    <>
      <FactGrid
        className={styles.previewFacts}
        facts={[
          {
            id: "wait",
            label: "In ED",
            value: (
              <span className={styles.longest}>
                {person.clock !== "in" ? <StatusGlyph tone={CLOCK_TONE[person.clock]} size={9} /> : null}
                <b className={styles.num}>{splitDuration(person.wait)}</b>
              </span>
            ),
          },
          { id: "stage", label: "Stage", value: person.stage },
          {
            id: "form",
            label: "Form",
            // Audit 1 (CS-14, Josh 20 Oct): "None" only for a voluntary person.
            value: person.movement.legalForm
              ? legalStatusShort(person.movement)
              : person.movement.legalStatus === "Voluntary"
                ? "None"
                : "Not recorded",
          },
          {
            id: "tier",
            label: "Tier",
            value: <span className={styles.tierChip}>T{person.movement.urgency}</span>,
          },
        ]}
      />
      <dl className={styles.laneFacts}>
        <div>
          <dt>Cohort</dt>
          <dd>
            {person.movement.cohort} · {person.movement.sex}
          </dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>{person.destination ?? "Not yet found"}</dd>
        </div>
      </dl>
    </>
  );
}
