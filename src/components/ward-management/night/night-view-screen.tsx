"use client";

import { Ambulance, BedSingle, CalendarClock, Clock, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Card, CardHead, EmptyState, Hero, HeroFigures, HeroTop, LiveChip, StatusGlyph } from "@/components/wf";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
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
import { unitHealthService } from "@/components/ward-management/ward-service-scope";

import styles from "./night-view.module.css";

const CAPACITY_HREF = "/ward-flow/capacity";
const WAITING_HREF = "/ward-flow/delays";
const MOVEMENTS_HREF = "/ward-flow/movements";
const ON_CALL_HREF = "/ward-flow/on-call";

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

  const beds = useMemo(
    () => nightReadyBeds(units, admissions, bedReleases, movements, referrals),
    [units, admissions, bedReleases, movements, referrals],
  );
  const waits = useMemo(() => nightEdWaits(movements, now), [movements, now]);
  const onTheWay = useMemo(() => nightOnTheWay(movements, now), [movements, now]);
  const contacts = useMemo(() => nightContacts(network.sites, minuteOfDay(now)), [network.sites, now]);
  const unitName = (id: string | undefined) => units.find((unit) => unit.id === id)?.name;
  const atStep = waits.waiting - waits.underFirstStep;

  return (
    <main id="main-content" className={styles.main} data-testid="ward-night-view">
      <Hero
        level={1}
        title="Night view"
        titleMeta={`Statewide · as at ${formatInstantWithDay(now, now)}`}
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
                  label: `${beds.total === 1 ? "bed" : "beds"} ready`,
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
            meta={`${beds.total} ready`}
            action={
              <Link href={CAPACITY_HREF} className={styles.headLink}>
                Capacity
              </Link>
            }
          />
          {beds.wards.length === 0 ? (
            <EmptyState title="No bed ready" meta={`Checked at ${formatInstant(now)}`} />
          ) : (
            <ul className={styles.rows}>
              {beds.wards.map(({ unit, ready }) => (
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
                  <span className={styles.rowSub}>Suggested next step: {step.nextStep}</span>
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
            <ul className={styles.rows}>
              {onTheWay.map((movement) => {
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
