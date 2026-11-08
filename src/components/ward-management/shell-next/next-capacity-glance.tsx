"use client";

import { useMemo, type RefObject } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, PhoneOutgoing, X } from "lucide-react";

import { Sheet, durMinutes } from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import {
  bedKindBreakdown,
  bedKindGaps,
  bedKindTotals,
  bedsFreeingTodayTotal,
} from "@/components/ward-management/capacity/capacity-derivations";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { BED_KIND_LABEL, bedKindOfBed } from "@/components/ward-management/forecast/forecast-by-kind";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import styles from "./next-capacity-glance.module.css";

const CAPACITY_HREF = "/ward-flow/capacity";
const DAY = 24 * 60;

/**
 * Capacity at a glance (Josh, 8 Nov 2026: "a more phone optimised popup screen like for activity or
 * alerts with a link to open the full capacity page"). The coordinator's Capacity tab opens this
 * sheet first: ready beds against the people waiting, by bed type, with who has waited longest;
 * the beds planned to free today; and the ward to ring. It never pairs a person with a ward: the
 * coordinator does that. Figures come from the same derivations as the Capacity page.
 */
export function NextCapacityGlance({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet
      id="ward-phone-capacity"
      testId="ward-phone-capacity-sheet"
      open={open}
      onClose={onClose}
      ariaLabel="Capacity at a glance"
      headerHidden
      mobileBreakpoint="phone"
      returnFocusRef={returnFocusRef}
      contentClassName={styles.sheet}
      bodyClassName={styles.body}
      footer={
        <Link href={CAPACITY_HREF} className={styles.open} onClick={onClose} data-testid="ward-phone-capacity-open">
          Open full Capacity
          <ArrowUpRight aria-hidden="true" strokeWidth={2} />
        </Link>
      }
      footerClassName={styles.foot}
    >
      {open ? <GlanceBody onClose={onClose} /> : null}
    </Sheet>
  );
}

function GlanceBody({ onClose }: { onClose: () => void }) {
  const { movements, units, admissions, bedReleases } = useWardFlowSelect(
    "movements",
    "units",
    "admissions",
    "bedReleases",
  );
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const canOpen = useCanOpenHref();

  const rows = useMemo(() => bedKindGaps(movements, [...units], now, admissions), [movements, units, now, admissions]);
  const totals = bedKindTotals(rows);
  const short = rows.reduce((sum, row) => sum + Math.max(0, -row.gap), 0);
  const freeing = bedsFreeingTodayTotal(bedReleases, now) ?? 0;
  const confirm = shiftConfirmations(units, now);

  // Planned discharges today, grouped by the hour they are expected: the wards and bed types freeing.
  const timeline = useMemo(() => {
    const today = Math.floor(now / DAY);
    const byHour = new Map<number, { n: number; wards: Set<string>; kinds: Set<string> }>();
    for (const release of bedReleases ?? []) {
      if (release.state === "discharged" || Math.floor(release.expectedAt / DAY) !== today) continue;
      const unit = units.find((item) => item.id === release.unitId);
      if (!unit) continue;
      const hour = Math.floor(release.expectedAt / 60) * 60;
      const slot = byHour.get(hour) ?? { n: 0, wards: new Set<string>(), kinds: new Set<string>() };
      slot.n += 1;
      slot.wards.add(unit.name);
      slot.kinds.add(
        BED_KIND_LABEL[
          bedKindOfBed(
            unit,
            admissions.find((admission) => admission.id === release.admissionId),
          )
        ],
      );
      byHour.set(hour, slot);
    }
    return [...byHour.entries()].sort(([a], [b]) => a - b);
  }, [bedReleases, units, admissions, now]);

  const quiet = rows.filter((row) => row.waiting === 0);
  const placing = rows.filter((row) => row.waiting > 0);
  const chase = confirm.waiting[0];

  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <span className={styles.eyebrow}>
            <span className={styles.live} aria-hidden="true" />
            Capacity · whole network
          </span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
        <h2 className={styles.title}>
          <span className={styles.mono}>{totals.bedsThatFit}</span> beds ready{" "}
          <small>
            for <span className={styles.mono}>{totals.waiting}</span> waiting
          </small>
        </h2>
        <dl className={styles.stats}>
          <div>
            <dt>freeing today</dt>
            <dd>+{freeing}</dd>
          </div>
          <div data-tone={short > 0 ? "warning" : undefined}>
            <dt>short now</dt>
            <dd>{short}</dd>
          </div>
          <div data-tone={confirm.waiting.length > 0 ? "warning" : undefined}>
            <dt>to confirm</dt>
            <dd>{confirm.waiting.length}</dd>
          </div>
        </dl>
      </header>

      <section className={styles.section} aria-labelledby="glance-place">
        <h3 className={styles.label} id="glance-place">
          Place someone now <i>longest wait first</i>
        </h3>
        <div className={styles.card}>
          {placing.length === 0 ? (
            <p className={styles.empty}>Nobody is waiting for a bed.</p>
          ) : (
            placing.map((row) => {
              const next = bedKindBreakdown(row.id, movements, [...units], admissions).waiting[0];
              const who = next ? patientOf(next) : undefined;
              const href = who?.patient ? patientHref(who.patient.id) : null;
              const fill = Math.round((Math.min(row.bedsThatFit, row.waiting) / row.waiting) * 100);
              return (
                <div key={row.id} className={styles.kind}>
                  <div className={styles.kindText}>
                    <div className={styles.kindHead}>
                      <b>{BED_KIND_LABEL[row.id]}</b>
                      <span>
                        <em className={styles.mono}>{row.bedsThatFit}</em> ready ·{" "}
                        <span className={styles.mono}>{row.waiting}</span> waiting
                      </span>
                    </div>
                    <span className={styles.meter} aria-hidden="true">
                      <span style={{ width: `${fill}%` }} data-short={row.gap < 0 || undefined} />
                    </span>
                    {next && who ? (
                      <span className={styles.next}>
                        Next <b>{who.formalName}</b> ·{" "}
                        <span className={styles.mono}>{durMinutes(Math.max(0, now - next.openedAt))}</span> waiting
                      </span>
                    ) : null}
                  </div>
                  {href && canOpen(href) && who ? (
                    <Link
                      href={href}
                      className={styles.go}
                      onClick={onClose}
                      aria-label={`Open ${who.formalName}, next for a ${BED_KIND_LABEL[row.id].toLowerCase()} bed`}
                    >
                      <ChevronRight aria-hidden="true" strokeWidth={2} />
                    </Link>
                  ) : null}
                </div>
              );
            })
          )}
          {quiet.length > 0 ? (
            <p className={styles.footNote}>
              {quiet.map((row) => `${BED_KIND_LABEL[row.id]} · ${row.bedsThatFit} ready`).join(", ")}, nobody waiting
            </p>
          ) : null}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="glance-freeing">
        <h3 className={styles.label} id="glance-freeing">
          Freeing up today <i>planned discharges</i>
        </h3>
        <div className={styles.card}>
          {timeline.length === 0 ? (
            <p className={styles.empty}>No discharges planned for the rest of today.</p>
          ) : (
            <ol className={styles.timeline}>
              {timeline.map(([hour, slot]) => (
                <li key={hour}>
                  <span className={styles.time}>{formatInstant(hour)}</span>
                  <span className={styles.rail} aria-hidden="true" />
                  <span className={styles.where}>
                    <b>{[...slot.wards].join(", ")}</b>
                    <span>{[...slot.kinds].join(", ")}</span>
                  </span>
                  <span className={styles.plus}>
                    +{slot.n}
                    <span className={styles.srOnly}> {slot.n === 1 ? "bed" : "beds"}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {chase ? (
        <section className={`${styles.card} ${styles.chase}`} aria-label="Ward to ring">
          <span className={styles.chaseText}>
            <b>
              <span className={styles.dot} aria-hidden="true" />
              {chase.name}
            </b>
            Last confirmed <span className={styles.mono}>{formatInstant(chase.allocatable.confirmedAt)}</span>
            {confirm.waiting.length > 1 ? ` · ${confirm.waiting.length - 1} more` : ""}
          </span>
          <button
            type="button"
            className={styles.call}
            onClick={(event) => {
              onClose();
              requestToolsTool("call-log", event.currentTarget);
            }}
          >
            <PhoneOutgoing aria-hidden="true" strokeWidth={2} />
            Call and log
          </button>
        </section>
      ) : null}
    </>
  );
}
