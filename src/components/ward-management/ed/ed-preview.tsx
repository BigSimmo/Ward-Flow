"use client";

import Link from "next/link";

import { ChevronLeft, ChevronRight, LogIn } from "lucide-react";

import { Button, FactGrid, Icon, StatusGlyph, buttonClass, useIsPhone } from "@/components/wf";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { edHref, raiseReferralHref } from "@/components/ward-management/shell/ward-facade";

import {
  CLOCK_TONE,
  personDim,
  trendSpanHours,
  trendStepHours,
  waitLine,
  type EdPerson,
  type EdRow,
  type Highlight,
} from "./ed-index-parts";
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
      <section className={styles.previewSummary} aria-label={`${row.short} now`}>
        <div className={styles.previewHero}>
          <p className={styles.previewBig}>
            <b className={styles.previewBigNum}>{row.summary.waiting}</b>
            <span>waiting now</span>
          </p>
          <PreviewTrend values={row.trend} name={row.short} />
        </div>
        <ul className={styles.previewTiles}>
          {[
            { id: "past", tone: "danger", label: `Past ${waitLine(accessTarget)}`, value: row.pastTarget },
            { id: "no-bed", tone: "warning", label: "No bed yet", value: row.noBed },
            { id: "form", tone: "info", label: "Under a form", value: row.forms },
          ].map((tile) => (
            <li
              key={tile.id}
              className={styles.previewTile}
              data-tone={tile.value > 0 ? tile.tone : "none"}
              data-testid={`ed-preview-${tile.id}`}
            >
              <b>{tile.value}</b>
              <span>{tile.label}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.previewSection} aria-labelledby="ed-preview-people">
        <h3 id="ed-preview-people" className={styles.eyebrow}>
          Waiting, longest first
        </h3>
        {row.people.length === 0 ? (
          <p className={styles.previewEmpty}>
            <StatusGlyph tone="success" size={9} /> Nobody waiting at {row.short}
          </p>
        ) : (
          <ul className={styles.previewList} data-phone={isPhone ? "true" : undefined}>
            {row.people.map((person) => (
              <li
                key={person.movement.id}
                className={styles.previewPerson}
                data-act-now={person.clock === "past" ? "true" : undefined}
                data-dim={personDim(person, highlight) ? "true" : undefined}
                data-clock={person.clock}
              >
                <span className={styles.previewBadge}>
                  <StatusGlyph tone={CLOCK_TONE[person.clock]} size={12} />
                </span>
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
                <EdWaitFigures person={person} />
                <span
                  className={styles.previewMeter}
                  aria-hidden="true"
                  style={{ width: `${Math.min(100, Math.max(4, (person.wait / accessTarget) * 100)).toFixed(1)}%` }}
                />
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
          {
            id: "referral",
            label: "Since referral",
            value: (
              <b className={styles.num}>
                {person.sinceReferral === undefined ? "Not recorded" : splitDuration(person.sinceReferral)}
              </b>
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

/** The desktop wait lanes' picked person: tier, name, where they are, their wait and where to go next. */
export function EdLanePicked({ person, row }: { person: EdPerson; row: EdRow }) {
  return (
    <>
      <span className={styles.tier} title={`Tier ${person.movement.urgency}`}>
        {person.movement.urgency}
      </span>
      <b className={styles.pickedName}>{person.name}</b>
      <span className={styles.meta}>
        {row.short} · {person.stage}
        {person.movement.legalForm ? ` · Form ${person.movement.legalForm.code}` : ""}
        {person.destination ? ` · ${person.destination}` : ""}
      </span>
      <span className={styles.longest}>
        {person.clock !== "in" ? <StatusGlyph tone={CLOCK_TONE[person.clock]} size={9} /> : null}
        <EdWaitFigures person={person} />
      </span>
      <span className={styles.pickedActions}>
        <Link className={buttonClass({ variant: "sec", size: "sm" })} href={person.href}>
          Open patient
        </Link>
        <Link className={buttonClass({ variant: "pri", size: "sm" })} href={edHref(row.summary.ed.id)}>
          Open {row.short}
        </Link>
      </span>
    </>
  );
}

/** The ED preview's footer: raise a referral from this ED, or enter it. */
export function EdPreviewFoot({ row }: { row: EdRow }) {
  return (
    <div className={styles.previewFoot}>
      <Link
        className={buttonClass({ variant: "sec" })}
        href={raiseReferralHref({ source: "ed_medical", originEdId: row.summary.ed.id })}
      >
        New referral
      </Link>
      <Link
        className={buttonClass({ variant: "pri" })}
        href={edHref(row.summary.ed.id)}
        data-testid="ed-index-preview-enter"
      >
        <Icon icon={LogIn} size={16} />
        Enter {row.short}
      </Link>
    </div>
  );
}

/** The ED preview header's step buttons, to the previous or next ED in the current order. */
export function EdPreviewSteps({ onStep }: { onStep: (by: -1 | 1) => void }) {
  return (
    <span className={styles.previewSteps}>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        icon={ChevronLeft}
        aria-label="Previous ED"
        onClick={() => onStep(-1)}
      />
      <Button variant="ghost" size="sm" iconOnly icon={ChevronRight} aria-label="Next ED" onClick={() => onStep(1)} />
    </span>
  );
}

/**
 * WF-02: since referral is the main figure; time in ED sits beside it with its own label, so the
 * home preview and the Waiting list never print two different waits under one word. Note 9: the
 * figure leads in the body face, coloured by its clock, with its label in small type underneath.
 */
function EdWaitFigures({ person }: { person: EdPerson }) {
  const main = person.sinceReferral ?? person.wait;
  return (
    <span className={styles.previewWait}>
      <b className={styles.previewWaitNum}>{splitDuration(main)}</b>
      <span className={styles.previewWaitLabel}>
        {person.sinceReferral === undefined ? "in ED" : `since referral · ${splitDuration(person.wait)} in ED`}
      </span>
    </span>
  );
}

/** The 12 hour trend, shaded, with its first and last values named under it. */
function PreviewTrend({ values, name }: { values: readonly number[]; name: string }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 40;
  const max = Math.max(4, ...values);
  const x = (index: number) => (index * width) / (values.length - 1);
  const y = (value: number) => (height - 3 - (value / max) * (height - 8)).toFixed(1);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  return (
    <div className={styles.previewTrend}>
      <svg
        className={styles.previewSpark}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${name}, waiting over ${trendSpanHours} hours, every ${trendStepHours}h: ${values.join(", ")}`}
        focusable="false"
        data-testid="ed-row-spark"
      >
        <polygon className={styles.previewSparkArea} points={`0,${height} ${points} ${width},${height}`} />
        <polyline className={styles.previewSparkLine} points={points} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={styles.previewAxis}>
        <span>{`${trendSpanHours}h ago · ${first}`}</span>
        <span className={styles.previewDelta} data-tone={change > 0 ? "up" : change < 0 ? "down" : "level"}>
          {change === 0 ? "level" : `${change > 0 ? "up" : "down"} ${Math.abs(change)}`}
        </span>
        <span>{`now · ${last}`}</span>
      </span>
    </div>
  );
}
