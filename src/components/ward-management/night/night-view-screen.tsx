"use client";

import { Ambulance, BedSingle, CalendarClock, Clock, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Card,
  CardHead,
  EmptyState,
  Hero,
  HeroFigures,
  HeroTop,
  LiveChip,
  ShowMoreRow,
  StatusGlyph,
  foldHidden,
  foldLimit,
} from "@/components/wf";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { formatInstant, formatInstantWithDay, minuteOfDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import {
  nightContactNowText,
  nightContacts,
  nightEdWaits,
  nightOnTheWay,
  nightReadyBeds,
} from "@/components/ward-management/night-view-figures";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  healthServiceAcronym,
  movementBelongsToService,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";

import styles from "./night-view.module.css";

const CAPACITY_HREF = "/ward-flow/capacity";
const WAITING_HREF = "/ward-flow/waiting";
const MOVEMENTS_HREF = "/ward-flow/movements";
const ON_CALL_HREF = "/ward-flow/on-call";

/** About eight rows, then the kit's Show more (DESIGN-SYSTEM.md section 4). */
const NIGHT_ROWS = 8;

/** A list's fold: the rows to draw and the Show more row, if folding hides two or more. */
function useFold<T>(items: readonly T[], id: string) {
  const [open, setOpen] = useState(false);
  const hidden = foldHidden(items.length, NIGHT_ROWS);
  return {
    rows: open || hidden === 0 ? items : items.slice(0, foldLimit(items.length, NIGHT_ROWS)),
    more:
      hidden === 0 ? null : (
        <ShowMoreRow onClick={() => setOpen((was) => !was)} expanded={open} controls={id}>
          {open ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ),
  };
}

/**
 * Night view (feature plan item 29): the coordinator's overnight screen. Beds ready, ED waits by
 * Step, who is on the way, tonight's intake windows and the key on-call lines, on one page. Every
 * figure comes from the same derivation as the day screens (`night-view-figures.ts`), so the counts
 * here always match Home, Waiting, Movements and On-call. It shows; it never suggests a ward (D-71).
 */
export function NightViewScreen() {
  const { movements, units, bedReleases, admissions, referrals } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "admissions",
    "referrals",
  );
  const now = useWardFlowClock();
  const network = useWardNetwork();
  const patientOf = usePatientOf();
  // The chosen service scopes each figure exactly as Home's matching figure: ED waits and journeys
  // follow it; beds stay network-wide (a placement may use any ward) and say so, in Home's words.
  const service = useServiceScope();
  const networkWord = service === null ? "" : " network-wide";
  const scopedMovements = useMemo(
    () =>
      service === null ? movements : movements.filter((movement) => movementBelongsToService(movement, service, units)),
    [movements, units, service],
  );

  const beds = useMemo(
    () => nightReadyBeds(units, admissions, bedReleases, movements, referrals),
    [units, admissions, bedReleases, movements, referrals],
  );
  const waits = useMemo(() => nightEdWaits(scopedMovements, now), [scopedMovements, now]);
  const onTheWay = useMemo(() => nightOnTheWay(scopedMovements, now), [scopedMovements, now]);
  const bedRows = useFold(beds.wards, "night-beds-list");
  const movingRows = useFold(onTheWay, "night-moving-list");
  const contacts = useMemo(() => nightContacts(network.sites, minuteOfDay(now)), [network.sites, now]);
  const unitName = (id: string | undefined) => units.find((unit) => unit.id === id)?.name;
  const atStep = waits.waiting - waits.underFirstStep;

  return (
    <main id="main-content" className={styles.main} data-testid="ward-night-view">
      <Hero
        level={1}
        title="Night view"
        titleMeta={`${service === null ? "Statewide" : healthServiceAcronym(service) || service} · as at ${formatInstantWithDay(now, now)}`}
        aside={<LiveChip state="live" onHero age={formatInstant(now)} />}
      >
        <HeroTop
          quickBar={false}
          figures={
            <HeroFigures
              label="Tonight"
              testId="night-figures"
              items={[
                {
                  id: "beds",
                  value: beds.total,
                  label: `${beds.total === 1 ? "bed" : "beds"} ready${networkWord}`,
                  testId: "night-figure-beds",
                },
                {
                  id: "waiting",
                  value: waits.waiting,
                  label: "waiting in ED",
                  testId: "night-figure-waiting",
                },
                {
                  id: "moving",
                  value: onTheWay.length,
                  label: "on the way",
                  testId: "night-figure-moving",
                },
              ]}
            />
          }
        />
      </Hero>

      <div className={styles.grid}>
        <Card aria-labelledby="night-beds-title" data-testid="night-beds">
          <CardHead
            title={<span id="night-beds-title">Beds ready now</span>}
            icon={BedSingle}
            iconPlain
            meta={`${beds.total} ready${networkWord}`}
            action={
              <Link href={CAPACITY_HREF} className={styles.headLink}>
                Capacity
              </Link>
            }
          />
          {beds.wards.length === 0 ? (
            <EmptyState title="No bed ready" meta={`Checked at ${formatInstant(now)}`} />
          ) : (
            <ul className={styles.rows} id="night-beds-list">
              {bedRows.rows.map(({ unit, ready }) => (
                <li key={unit.id} className={styles.row} data-testid={`night-ward-${unit.id}`}>
                  <span className={styles.rowMain}>
                    <Link href={unitHref(unit.id)} className={styles.rowTitle}>
                      {unit.name}
                    </Link>
                    <span className={styles.rowSub}>
                      {unitHealthService(unit) ?? "Service not recorded"} · confirmed{" "}
                      {formatInstantWithDay(unit.allocatable.confirmedAt, now)}
                    </span>
                  </span>
                  <span className={styles.count}>
                    <b>{ready}</b> ready
                  </span>
                </li>
              ))}
            </ul>
          )}
          {bedRows.more}
          {beds.wardsWithNone > 0 ? (
            <p className={styles.cardFoot}>
              {beds.wardsWithNone} {beds.wardsWithNone === 1 ? "ward has" : "wards have"} no bed ready. Wards are in a
              fixed order: health service, then name.
            </p>
          ) : null}
        </Card>

        <Card aria-labelledby="night-steps-title" data-testid="night-ed-steps">
          <CardHead
            title={<span id="night-steps-title">ED waits by Step</span>}
            icon={Clock}
            iconPlain
            meta={`${waits.waiting} waiting`}
            action={
              <Link href={WAITING_HREF} className={styles.headLink}>
                Waiting
              </Link>
            }
          />
          <ul className={styles.rows}>
            {waits.steps.map((step) => (
              <li key={step.step} className={styles.row} data-testid={`night-step-${step.step}`}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{step.label}</span>
                  {/* 3.1: no "Ask wards" when everyone at this step already has it recorded. */}
                  {step.count > 0 && step.actionDoneCount === step.count ? null : (
                    <span className={styles.rowSub}>Next escalation step: {step.nextStep}</span>
                  )}
                </span>
                <span className={styles.count}>
                  <b>{step.count}</b> waiting
                </span>
              </li>
            ))}
            <li className={styles.row} data-testid="night-step-under">
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>Under Step 1</span>
              </span>
              <span className={styles.count}>
                <b>{waits.underFirstStep}</b> waiting
              </span>
            </li>
          </ul>
          <p className={styles.cardFoot}>
            {atStep} at a Step. Time in the department, as on the ED board. A Step is a prompt for a person to act.
          </p>
        </Card>

        <Card aria-labelledby="night-moving-title" data-testid="night-on-the-way">
          <CardHead
            title={<span id="night-moving-title">On the way</span>}
            icon={Ambulance}
            iconPlain
            meta={`${onTheWay.length} moving`}
            action={
              <Link href={MOVEMENTS_HREF} className={styles.headLink}>
                Movements
              </Link>
            }
          />
          {onTheWay.length === 0 ? (
            <EmptyState title="Nobody on the way" meta={`Checked at ${formatInstant(now)}`} />
          ) : (
            <ul className={styles.rows} id="night-moving-list">
              {movingRows.rows.map((movement) => {
                const eta = movement.transport?.estimatedAt;
                return (
                  <li key={movement.id} className={styles.row} data-testid={`night-moving-${movement.id}`}>
                    <span className={styles.rowMain}>
                      <Link href={movementHref(movement.id)} className={styles.rowTitle}>
                        {patientOf({ movementId: movement.id }).displayName}
                      </Link>
                      <span className={styles.rowSub}>
                        To {unitName(movement.acceptedUnitId) ?? "a ward not recorded"}
                        {eta === undefined ? "" : ` · due ${formatInstantWithDay(eta, now)}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {movingRows.more}
        </Card>

        <Card aria-labelledby="night-intake-title" data-testid="night-intake-windows">
          <CardHead
            title={<span id="night-intake-title">Tonight&apos;s intake windows</span>}
            icon={CalendarClock}
            iconPlain
          />
          {/* Feature plan item 13 (overnight intake windows) is not built yet. Until wards record
              their windows, this says so rather than showing a time nobody set. */}
          <p className={styles.notRecorded} data-testid="night-intake-not-recorded">
            Not recorded. Wards do not record overnight intake windows in Ward Flow yet.
          </p>
        </Card>

        <Card aria-labelledby="night-oncall-title" data-testid="night-on-call">
          <CardHead
            title={<span id="night-oncall-title">On call now</span>}
            icon={Phone}
            iconPlain
            meta={`at ${formatInstant(now)}`}
            action={
              <Link href={ON_CALL_HREF} className={styles.headLink}>
                On-call
              </Link>
            }
          />
          <ul className={styles.rows}>
            {contacts.map((contact) => (
              <li key={contact.entry.id} className={styles.row} data-testid={`night-contact-${contact.entry.id}`}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{contact.label}</span>
                  <span className={styles.rowSub}>
                    <StatusGlyph tone={contact.now.kind === "on" ? "success" : "neutral"} size={9} />{" "}
                    {nightContactNowText(contact)}
                  </span>
                </span>
                <span className={styles.number}>{contact.number ?? "Not recorded"}</span>
              </li>
            ))}
          </ul>
          <p className={styles.cardFoot}>Synthetic numbers. They reach nobody.</p>
        </Card>
      </div>

      <WardPrototypeFooter testId="ward-night-view-footer" />
    </main>
  );
}
