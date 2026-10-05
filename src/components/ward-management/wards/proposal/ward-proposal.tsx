"use client";

import { Fragment } from "react";

import { BedGrid, BedGridLegend } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  RELEASE_BAND_LABELS,
  SERVICE_COLOUR,
  percent,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { RELEASE_BANDS } from "@/components/ward-management/ward-bed-availability";
import statStyles from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";
import { handoverScopeValue } from "@/components/ward-management/handover/handover-page";
import { dayOf, formatInstantWithDay, minutesUntil } from "@/components/ward-management/ward-clock";

import { ARRIVAL_STAGE_LABEL, DEPARTURE_BAND_LABEL, waitedLabel } from "./ward-pages-proposal-figures";
import {
  Answer,
  Figures,
  NotWiredButton,
  PageHeader,
  Row,
  Section,
  WardNotFound,
  WardSubnav,
  plural,
  wardPagesHref,
  type Attention,
} from "./ward-pages-proposal-parts";
import { useWardPagesProposal } from "./use-ward-pages-proposal";
import styles from "./ward-pages-proposal.module.css";

/**
 * Proposed ward screen ("Ward today"). One sentence on the ward's beds, then a single list of what
 * needs someone this shift, then who is leaving and who is coming. Every count is the length of the
 * list printed under it.
 */
export function WardProposal({ unitId }: { unitId?: string }) {
  const { ward, detail, asAt, now, world, missing } = useWardPagesProposal(unitId);
  if (missing) return <WardNotFound />;
  if (!ward || !detail) return <p className={styles.empty}>No wards in this network.</p>;
  const { unit } = ward;
  const initials = (subject: Parameters<typeof world.resolvePatientIdentity>[0]) =>
    world.resolvePatientIdentity(subject).initials || "Initials not recorded";

  const { requests, arrivals, departures, pastDate, heldUp, awayAtEd, leaving } = detail;
  const confirmedAt = unit.allocatable.confirmedAt;
  const confirmedAgo = -minutesUntil(confirmedAt, now);
  const numbersStale = confirmedAgo > unit.allocatable.staleAfterMinutes;

  const attention: Attention[] = [];
  if (requests.length)
    attention.push({
      tone: ward.ready === 0 ? "danger" : "warn",
      label: `${plural(requests.length, "bed request")} waiting for your answer`,
      href: wardPagesHref("answer", unit.id),
    });
  if (numbersStale)
    attention.push({ tone: "warn", label: `Today's numbers last confirmed ${waitedLabel(confirmedAgo)} ago` });
  if (pastDate.length)
    attention.push({
      tone: "warn",
      label: `${plural(pastDate.length, "person", "people")} past the ward's expected date`,
    });
  if (heldUp.length) attention.push({ tone: "warn", label: `${plural(heldUp.length, "discharge")} held up` });
  if (awayAtEd.length)
    attention.push({
      tone: "info",
      label: `${plural(awayAtEd.length, "person", "people")} away at an emergency department`,
    });

  const shiftItems = [
    ...requests.map((request) => ({
      key: `req-${request.movementId}`,
      title: <>{initials(request.movement)} · bed request from an emergency department</>,
      sub: `Waiting ${waitedLabel(request.waitedMinutes)}`,
      end: (
        <a className={styles.link} href={wardPagesHref("answer", unit.id)}>
          Answer
        </a>
      ),
      tone: request.urgent ? styles.dangerText : styles.warnText,
      tag: request.urgent ? "Urgent" : "Request",
    })),
    ...pastDate.map((bed) => ({
      key: `past-${bed.admission.id}`,
      title: <>{initials(bed.admission)} · past the ward&rsquo;s expected date</>,
      sub: `${bed.days === null ? "Days not recorded" : `${bed.days} days in bed`}${bed.admission.blockReason ? ` · held up: ${bed.admission.blockReason.toLowerCase()}` : ""}`,
      end: <NotWiredButton>Update date</NotWiredButton>,
      tone: styles.warnText,
      tag: "Date passed",
    })),
    ...heldUp
      .filter((bed) => !bed.pastDate)
      .map((bed) => ({
        key: `held-${bed.admission.id}`,
        title: <>{initials(bed.admission)} · discharge held up</>,
        sub: bed.admission.blockReason ?? "",
        end: <NotWiredButton>No longer held up</NotWiredButton>,
        tone: styles.warnText,
        tag: "Held up",
      })),
    ...awayAtEd.map((bed) => ({
      key: `ed-${bed.admission.id}`,
      title: <>{initials(bed.admission)} · at an emergency department, bed held</>,
      sub: `Since ${formatInstantWithDay(bed.admission.awayAtEmergencyDepartmentSince ?? now, now)}`,
      end: <NotWiredButton>Mark back</NotWiredButton>,
      tone: "",
      tag: "Away",
    })),
  ];

  return (
    <main id="main-content" className={styles.page} data-testid="ward-pages-proposal-ward">
      <PageHeader
        crumbs={[{ label: "Ward Hub", href: wardPagesHref("hub") }, { label: ward.service }, { label: ward.hospital }]}
        title={unit.name}
        dotColour={SERVICE_COLOUR[ward.service]}
        subline={`${unit.cohort} · ${plural(unit.beds, "bed")} · ${
          unit.lockedBeds === unit.beds
            ? "all locked"
            : unit.lockedBeds === 0
              ? "all open"
              : `${unit.lockedBeds} locked, ${unit.beds - unit.lockedBeds} open`
        }`}
        asAt={asAt}
        action={
          requests.length ? (
            <a className={styles.primary} href={wardPagesHref("answer", unit.id)}>
              Answer {plural(requests.length, "request")}
            </a>
          ) : null
        }
      />
      <WardSubnav unitId={unit.id} active="ward" requests={requests.length} beds={unit.beds} />

      <Answer attention={attention}>
        <strong>{ward.ready === 0 ? "No ready bed" : `${plural(ward.ready, "ready bed")}`}</strong> on {unit.name}, with{" "}
        {ward.occupied} of {ward.beds} beds occupied ({percent(ward.occupancy)}).{" "}
        {plural(arrivals.length, "person", "people")} {arrivals.length === 1 ? "is" : "are"} coming in and{" "}
        {leaving.today} {leaving.today === 1 ? "is" : "are"} expected to leave today ({leaving.confirmedToday}{" "}
        confirmed).
      </Answer>

      <Figures
        label="Ward bed figures"
        items={[
          { label: "Beds", value: ward.beds },
          {
            label: "Occupied",
            value: ward.occupied,
            note: `${percent(ward.occupancy)} · ${ward.onLeave} on leave`,
            keyClass: statStyles.segOccupied,
          },
          {
            label: "Ready",
            value: ward.ready,
            tone: ward.ready === 0 ? "danger" : "good",
            keyClass: statStyles.segReady,
            note: ward.beingMadeReady ? `${ward.beingMadeReady} being made ready` : undefined,
          },
          { label: "Pulled", value: ward.pulled, note: "given, not arrived", keyClass: statStyles.segPulled },
          { label: "Closed", value: ward.closed, note: "empty, not offered", keyClass: statStyles.segClosed },
          { label: "Leaving today", value: leaving.today, note: `${leaving.confirmedToday} confirmed` },
          { label: "Coming in", value: arrivals.length, note: "accepted, not arrived" },
        ]}
      />

      <div className={styles.columns}>
        <div className={styles.stack}>
          <Section
            title="Needs you this shift"
            meta={shiftItems.length ? plural(shiftItems.length, "item") : undefined}
          >
            {shiftItems.length ? (
              <ul className={styles.list}>
                {shiftItems.map((item) => (
                  <Row
                    key={item.key}
                    title={
                      <>
                        <span className={`${styles.tag} ${item.tone}`}>{item.tag}</span>
                        {item.title}
                      </>
                    }
                    sub={item.sub}
                    end={item.end}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                Nothing needs this ward right now. Requests, past dates and held-up discharges appear here.
              </p>
            )}
          </Section>

          <Section
            title="Going out"
            meta={`${leaving.today} today · ${leaving.tomorrow} tomorrow${leaving.overdue ? ` · ${leaving.overdue} date passed` : ""}`}
          >
            {departures.length ? (
              <ul className={styles.list}>
                {departures.map(({ release, band, admission }) => (
                  <Row
                    key={release.id}
                    title={
                      <>
                        <span className={band === "overdue" ? styles.warnText : ""}>
                          {DEPARTURE_BAND_LABEL[band]}
                          {band !== "overdue" && dayOf(release.expectedAt) < dayOf(now) ? ", date passed" : ""}
                        </span>
                        <span className={styles.rowTime}>{formatInstantWithDay(release.expectedAt, now)}</span>
                      </>
                    }
                    sub={[
                      admission ? initials(admission) : "Stay not linked",
                      release.state === "confirmed" ? "confirmed" : "expected",
                      release.waitingOn ? `waiting on ${release.waitingOn.toLowerCase()}` : null,
                      admission?.blockReason ? `held up: ${admission.blockReason.toLowerCase()}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    end={
                      release.state === "confirmed" ? (
                        <span className={styles.goodText}>Confirmed</span>
                      ) : (
                        <NotWiredButton>Confirm</NotWiredButton>
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No discharge is expected today or tomorrow.</p>
            )}
          </Section>

          <Section title="Coming in" meta={plural(arrivals.length, "person", "people")}>
            {arrivals.length ? (
              <ul className={styles.list}>
                {arrivals.map((arrival) => (
                  <Row
                    key={arrival.movementId}
                    title={<>From {arrival.edName}</>}
                    sub={`${initials(arrival.movement)} · ${ARRIVAL_STAGE_LABEL[arrival.stage] ?? arrival.stage} · accepted ${waitedLabel(arrival.sinceMinutes)} ago`}
                    end={
                      <a
                        className={styles.link}
                        href={`/mockups/ward-flow/movements/${encodeURIComponent(arrival.movementId)}`}
                      >
                        Movement
                      </a>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Nobody is on the way to this ward.</p>
            )}
          </Section>
        </div>

        <div className={styles.stack}>
          <Section
            title="Beds now"
            meta={
              <a className={styles.link} href={wardPagesHref("board", unit.id)}>
                Open bed board
              </a>
            }
            sheet
          >
            <BedGrid figures={ward} />
            <BedGridLegend />
          </Section>
          <Section title="When beds come free" meta="today and tomorrow" sheet>
            <dl className={styles.factList}>
              {RELEASE_BANDS.map((band) => {
                const { confirmed, expected } = ward.releases[band];
                return (
                  <Fragment key={band}>
                    <dt>{RELEASE_BAND_LABELS[band]}</dt>
                    <dd className={styles.num}>
                      {confirmed + expected === 0 ? (
                        <span className={styles.inlineNote}>None</span>
                      ) : (
                        `${confirmed} confirmed · ${expected} expected`
                      )}
                    </dd>
                  </Fragment>
                );
              })}
            </dl>
            {ward.releases.overdue.expected ? (
              <p className={styles.note}>
                Not counted above: {plural(ward.releases.overdue.expected, "discharge")} expected on an earlier day and
                never confirmed. They are listed under Going out.
              </p>
            ) : null}
          </Section>
          <Section title="Today's numbers" sheet>
            <dl className={styles.factList}>
              <dt>Ready beds confirmed</dt>
              <dd className={styles.num}>{unit.allocatable.value}</dd>
              <dt>Confirmed</dt>
              <dd className={numbersStale ? styles.warnText : ""}>{formatInstantWithDay(confirmedAt, now)}</dd>
            </dl>
            <p className={styles.note}>
              The ward confirms its ready beds on the bed requests page.{" "}
              <a className={styles.link} href={wardPagesHref("answer", unit.id)}>
                Confirm numbers
              </a>
            </p>
          </Section>
          <Section title="Ward tools" sheet>
            <ul className={styles.list}>
              <Row
                title="Handover sheet"
                end={
                  <a
                    className={styles.link}
                    href={`/mockups/ward-flow/handover?scope=${encodeURIComponent(handoverScopeValue({ kind: "ward", id: unit.id }))}`}
                  >
                    Open
                  </a>
                }
              />
              <Row title="Raise a ward-to-ward referral" end={<NotWiredButton>Start</NotWiredButton>} />
              <Row
                title="Ward statistics"
                end={
                  <a
                    className={styles.link}
                    href={`/mockups/ward-flow/statistics/proposal?screen=ward&id=${encodeURIComponent(unit.id)}`}
                  >
                    Open
                  </a>
                }
              />
            </ul>
          </Section>
        </div>
      </div>
    </main>
  );
}
