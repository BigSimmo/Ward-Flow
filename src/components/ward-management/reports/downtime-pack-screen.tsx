"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Ambulance, BedDouble, Camera, FileText, Printer, Users } from "lucide-react";

import {
  Button,
  Card,
  CardHead,
  GroupHead,
  Hero,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  Spinner,
  StatusGlyph,
  cx,
  durMinutes,
  tableClasses,
} from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { BED_STATE_DETAILS, BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { formatInstant, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";

import {
  downtimePack,
  downtimePackIsStale,
  lastDowntimePack,
  rememberDowntimePack,
  subscribeDowntimePack,
  type DowntimePack,
  type DowntimeWard,
} from "./downtime-pack";
import { FactGrid, HeroChip, HeroChips, reportDay, reportMoment, useIsPhone } from "./report-parts";
import styles from "./reports.module.css";

const NOT_RECORDED = "Not recorded";
/** A pack older than this reads as stale, in words and with a glyph. Nothing turns red. */
const STALE_AFTER_MINUTES = 60;
/** How long "Taking snapshot" shows before the new time, so the change is seen. */
const TAKING_MS = 450;

type Section = "beds" | "ed" | "moves" | "forms";
const SECTION_IDS: Record<Section, string> = {
  beds: "downtime-beds",
  ed: "downtime-ed",
  moves: "downtime-moves",
  forms: "downtime-legal",
};

/** Wards grouped by service, in the pack's own order, with a subtotal per service. */
function serviceGroups(wards: readonly DowntimeWard[]) {
  const groups: Array<{
    service: string;
    wards: DowntimeWard[];
    total: {
      beds: number;
      ready: number;
      pending: number;
      occupied: number;
      onLeave: number;
      pulled: number;
      closed: number;
    };
  }> = [];
  for (const ward of wards) {
    let group = groups.find((entry) => entry.service === ward.service);
    if (!group) {
      group = {
        service: ward.service,
        wards: [],
        total: { beds: 0, ready: 0, pending: 0, occupied: 0, onLeave: 0, pulled: 0, closed: 0 },
      };
      groups.push(group);
    }
    group.wards.push(ward);
    group.total.beds += ward.beds;
    group.total.ready += ward.counts.ready;
    group.total.pending += ward.pendingPreparation;
    group.total.occupied += ward.counts.occupied;
    group.total.onLeave += ward.counts.onLeave;
    group.total.pulled += ward.counts.pulled;
    group.total.closed += ward.counts.closed;
  }
  return groups;
}

type PackTotals = { ready: number; ed: number; moves: number; forms: number };

/** The four hero figures of a pack. */
function packTotals(pack: DowntimePack): PackTotals {
  return {
    ready: pack.totals.ready,
    ed: pack.edQueue.length,
    moves: pack.pendingMoves.length,
    forms: pack.legalForms.length,
  };
}

/** "+2", "-1" or "0": the change since the last pack, in mono beside a hero figure. */
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
}

function twinWords(delta: number): string {
  if (delta === 0) return "no change since the last pack";
  return `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} since the last pack`;
}

/** "17 beds · 13 occupied · 1 pulled · 1 closed": the parts that are not zero. */
function wardLine(ward: DowntimeWard): string {
  const parts = [`${ward.beds} beds`, `${ward.counts.occupied} occupied`];
  if (ward.counts.pulled > 0) parts.push(`${ward.counts.pulled} pulled`);
  if (ward.counts.closed > 0) parts.push(`${ward.counts.closed} closed`);
  if (ward.pendingPreparation > 0) parts.push(`${ward.pendingPreparation} being made ready`);
  return parts.join(" · ");
}

type SheetRow = { title: string; facts: Array<{ id: string; label: string; value: string }> };

/**
 * DOWNTIME PACK — a frozen snapshot of beds, the ED queue, moves under way and legal forms, for
 * paper use while the system is unavailable. The pack does not update while open; "New snapshot"
 * takes another. The last one is kept in this tab's memory only (D-18), never in browser storage.
 *
 * v10: one hero with the frozen time and the four totals as chips that jump to their table. After a
 * new snapshot each chip carries a delta twin: the change since the pack it replaced. Phone is its
 * own layout: a compact hero, a four-way segmented control and rows that open a sheet of facts.
 */
export function DowntimePackScreen() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { dayZero, units, admissions, bedReleases, leaveBeds, movements, worldGeneration } = world;
  const patientOf = usePatientOf();
  const isPhone = useIsPhone();
  const role = useRouteRole();
  const canSnapshot = role === "coordinator";

  const take = useCallback((): void => {
    const pack = downtimePack({
      units,
      admissions,
      bedReleases,
      leaveBeds,
      movements,
      now,
      identify: (movement) => {
        const person = patientOf(movement);
        return `${person.displayName} · ${person.umrn}`;
      },
    });
    rememberDowntimePack(pack, worldGeneration);
  }, [units, admissions, bedReleases, leaveBeds, movements, now, patientOf, worldGeneration]);

  // Taken or restored only after mount: the server snapshot is always null, so a server render never
  // holds a pack (it would be shared across visitors and its stamp would not match the browser's).
  const pack = useSyncExternalStore(subscribeDowntimePack, lastDowntimePack, () => null);
  // Take a pack whenever there is none: on first opening, and after a restored session has dropped
  // the one taken from the seed (the provider forgets it and notifies, whether or not the tree is
  // re-keyed). A reset or scenario switch (a new world generation) retakes it too, even while open.
  // A later world change alone never retakes: the pack is frozen until "New snapshot".
  useEffect(() => {
    if (pack === null || downtimePackIsStale(worldGeneration)) take();
  }, [pack, worldGeneration, take]);

  const [taking, setTaking] = useState(false);
  // The totals of the pack a New snapshot replaced, for the delta twins. Held by this screen only:
  // twins appear after a snapshot the reader asked for, never on opening.
  const [before, setBefore] = useState<PackTotals | null>(null);
  const takingTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (takingTimer.current !== null) window.clearTimeout(takingTimer.current);
    },
    [],
  );
  const newSnapshot = () => {
    if (!canSnapshot || taking) return;
    const current = lastDowntimePack();
    if (current) setBefore(packTotals(current));
    setTaking(true);
    takingTimer.current = window.setTimeout(() => {
      takingTimer.current = null;
      take();
      setTaking(false);
    }, TAKING_MS);
  };

  const [section, setSection] = useState<Section>("beds");
  const [sheet, setSheet] = useState<SheetRow | null>(null);

  const at = (instant: Instant | null) => (instant === null ? NOT_RECORDED : reportMoment(instant, dayZero));

  if (pack === null) {
    return (
      <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v10">
        <main id="main-content" className={styles.main} aria-busy="true">
          <Hero level={1} eyebrow="Downtime pack · synthetic data" title="Downtime pack" titleMeta="Taking snapshot" />
        </main>
      </div>
    );
  }

  const ageMinutes = Math.max(0, now - pack.generatedAt);
  const stale = ageMinutes >= STALE_AFTER_MINUTES;
  const frozenAt = formatInstant(pack.generatedAt);
  const groups = serviceGroups(pack.wards);

  const totals = packTotals(pack);
  const twin = (key: keyof PackTotals) =>
    before && !taking
      ? { twin: signed(totals[key] - before[key]), twinLabel: twinWords(totals[key] - before[key]) }
      : {};

  const jumpTo = (target: Section) => {
    document.getElementById(SECTION_IDS[target])?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const snapshotButton = (variant: "onHero" | "sec") => (
    <span className={styles.gated}>
      <Button
        variant={variant}
        icon={taking ? undefined : Camera}
        onClick={newSnapshot}
        disabled={!canSnapshot}
        aria-describedby={canSnapshot ? undefined : "downtime-snapshot-reason"}
        data-testid="ward-downtime-refresh"
      >
        {taking ? (
          <>
            <Spinner /> Taking snapshot
          </>
        ) : (
          "New snapshot"
        )}
      </Button>
      {canSnapshot ? null : (
        <span id="downtime-snapshot-reason" className={styles.reasonOnHero}>
          Coordinator only
        </span>
      )}
    </span>
  );
  const printButton = (
    <Button variant="light" icon={Printer} onClick={() => window.print()} data-testid="ward-downtime-print">
      Print
    </Button>
  );
  const takenLine = (
    <span data-testid="ward-downtime-generated">Taken {at(pack.generatedAt)} · does not update while open</span>
  );
  const staleLine = stale ? (
    <span className={styles.staleLine} data-testid="ward-downtime-stale">
      <StatusGlyph tone="warning" size={9} />
      Stale · taken {durMinutes(ageMinutes)} ago
    </span>
  ) : null;

  if (isPhone) {
    return (
      <div className={cx(styles.page, styles.phonePage)} data-testid="ward-downtime-pack" data-ward-design="v10">
        <main id="main-content" className={styles.main}>
          <PhoneHero
            level={1}
            title={`Frozen at ${frozenAt}`}
            sub={`${reportDay(pack.generatedAt, dayZero)} · does not update while open`}
            figures={[
              { id: "ready", value: totals.ready, label: "Beds ready" },
              { id: "ed", value: totals.ed, label: "In ED" },
              { id: "moves", value: totals.moves, label: "Moves" },
            ]}
            actions={
              <>
                {snapshotButton("onHero")}
                {printButton}
              </>
            }
          />
          {staleLine ? <p className={styles.phoneNote}>{staleLine}</p> : null}
          <Segmented<Section>
            className={styles.phoneSeg}
            size="md"
            label="Downtime pack section"
            value={section}
            onChange={setSection}
            items={[
              { id: "beds", label: "Beds" },
              { id: "ed", label: "ED" },
              { id: "moves", label: "Moves" },
              { id: "forms", label: "Forms" },
            ]}
          />
          {section === "beds" ? (
            groups.map((group) => (
              <section key={group.service} className={styles.phoneGroup} aria-label={group.service}>
                <GroupHead title={group.service} meta={`${group.total.ready} ready`} variant="letter" />
                <ul className={styles.phoneList}>
                  {group.wards.map((ward) => (
                    <PhoneListRow
                      key={ward.unitId}
                      as="li"
                      name={ward.name}
                      meta={wardLine(ward)}
                      value={ward.counts.ready}
                      time="ready"
                      onSelect={() =>
                        setSheet({
                          title: ward.name,
                          facts: [
                            { id: "beds", label: "Beds", value: String(ward.beds) },
                            { id: "ready", label: BED_STATE_LABELS.ready, value: String(ward.counts.ready) },
                            { id: "occupied", label: BED_STATE_LABELS.occupied, value: String(ward.counts.occupied) },
                            {
                              id: "closed",
                              label: `${BED_STATE_LABELS.pulled} or ${BED_STATE_LABELS.closed.toLowerCase()}`,
                              value: String(ward.counts.pulled + ward.counts.closed),
                            },
                          ],
                        })
                      }
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : section === "ed" ? (
            <PhoneSection empty="Nobody waiting" count={pack.edQueue.length}>
              {pack.edQueue.map((line) => (
                <PhoneListRow
                  key={line.movementId}
                  as="li"
                  name={line.person}
                  meta={`${line.ed} · ${line.stage}`}
                  value={splitDuration(line.waitedMinutes)}
                  time="waited"
                  onSelect={() =>
                    setSheet({
                      title: line.person,
                      facts: [
                        { id: "ed", label: "ED", value: line.ed },
                        { id: "arrived", label: "Arrived", value: at(line.openedAt) },
                        { id: "legal", label: "Legal status", value: line.legalStatus },
                        { id: "accepted", label: "Accepted by", value: line.acceptedWard || NOT_RECORDED },
                      ],
                    })
                  }
                />
              ))}
            </PhoneSection>
          ) : section === "moves" ? (
            <PhoneSection empty="No moves pending" count={pack.pendingMoves.length}>
              {pack.pendingMoves.map((line) => (
                <PhoneListRow
                  key={line.movementId}
                  as="li"
                  name={line.person}
                  meta={`${line.from} to ${line.to}`}
                  value={line.plannedAt === null ? "None" : formatInstant(line.plannedAt)}
                  time="planned"
                  onSelect={() =>
                    setSheet({
                      title: line.person,
                      facts: [
                        { id: "to", label: "To", value: line.to },
                        { id: "stage", label: "Stage", value: line.stage },
                        { id: "planned", label: "Planned move", value: at(line.plannedAt) },
                        { id: "eta", label: "Transport ETA", value: at(line.transportEta) },
                      ],
                    })
                  }
                />
              ))}
            </PhoneSection>
          ) : (
            <PhoneSection empty="No legal forms on open movements" count={pack.legalForms.length}>
              {pack.legalForms.map((line) => (
                <PhoneListRow
                  key={line.movementId}
                  as="li"
                  name={line.person}
                  meta={`${line.form || NOT_RECORDED} · ${line.legalStatus}`}
                  value={line.madeAt === null ? "None" : formatInstant(line.madeAt)}
                  time="made"
                  onSelect={() =>
                    setSheet({
                      title: line.person,
                      facts: [
                        { id: "form", label: "Form", value: line.form || NOT_RECORDED },
                        { id: "made", label: "Made", value: at(line.madeAt) },
                        { id: "received", label: "Received", value: at(line.receivedAt) },
                        { id: "expiry", label: "Typed expiry", value: at(line.typedExpiryAt) },
                      ],
                    })
                  }
                />
              ))}
            </PhoneSection>
          )}
          <PhoneSheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet?.title ?? ""}>
            {sheet ? <FactGrid facts={sheet.facts} /> : null}
          </PhoneSheet>
          <WardPrototypeFooter testId="ward-downtime-footer" note="Synthetic data" />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v10">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Downtime pack · synthetic data"
          title="Downtime pack"
          titleMeta={
            <span className={styles.frozen} data-testid="ward-downtime-frozen">
              <span className={styles.frozenDot} aria-hidden="true" />
              Frozen <b>{frozenAt}</b>
            </span>
          }
          aside={
            <span className={styles.heroActions} data-print-hide>
              {snapshotButton("onHero")}
              {printButton}
            </span>
          }
          bar={
            <HeroChips label="Pack totals, each jumps to its table">
              <HeroChip
                value={totals.ready}
                label={
                  pack.totals.pendingPreparation > 0
                    ? `Beds ready · ${pack.totals.pendingPreparation} being made ready`
                    : "Beds ready"
                }
                onPress={() => jumpTo("beds")}
                {...twin("ready")}
              />
              <HeroChip value={totals.ed} label="In ED" onPress={() => jumpTo("ed")} {...twin("ed")} />
              <HeroChip value={totals.moves} label="Moves pending" onPress={() => jumpTo("moves")} {...twin("moves")} />
              <HeroChip value={totals.forms} label="Legal forms" onPress={() => jumpTo("forms")} {...twin("forms")} />
            </HeroChips>
          }
          barAside={
            <span className={styles.heroLine}>
              {staleLine}
              {takenLine}
            </span>
          }
        />

        <Card aria-labelledby="downtime-beds-title" id={SECTION_IDS.beds} className={styles.packCard}>
          <CardHead
            id="downtime-beds-title"
            icon={BedDouble}
            title="Beds by ward"
            aside={
              <span className={styles.headMeta}>
                <b>{pack.totals.ready}</b> ready
                {pack.totals.pendingPreparation > 0 ? (
                  <>
                    {" "}
                    · <b>{pack.totals.pendingPreparation}</b> being made ready
                  </>
                ) : null}{" "}
                · <b>{pack.totals.occupied}</b> occupied of <b>{pack.totals.beds}</b>
              </span>
            }
          />
          <div className={styles.tableWrap}>
            <table
              className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
              data-testid="ward-downtime-beds"
            >
              <caption className={styles.srOnly}>Beds by ward at {at(pack.generatedAt)}, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  <th scope="col">Service</th>
                  <th scope="col" className={styles.num}>
                    Beds
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.ready}>
                    {BED_STATE_LABELS.ready}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.beingMadeReady}>
                    {BED_STATE_LABELS.beingMadeReady}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.occupied}>
                    {BED_STATE_LABELS.occupied}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.onLeave}>
                    {BED_STATE_LABELS.onLeave}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.pulled}>
                    {BED_STATE_LABELS.pulled}
                  </th>
                  <th scope="col" className={styles.num} title={BED_STATE_DETAILS.closed}>
                    {BED_STATE_LABELS.closed}
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.service}>
                    <tr className={styles.subtotal} data-testid="ward-downtime-subtotal">
                      <th scope="rowgroup" colSpan={2}>
                        {group.service}
                        <span className={styles.subtotalCount}>
                          {group.wards.length} {group.wards.length === 1 ? "ward" : "wards"}
                        </span>
                      </th>
                      <td className={styles.num}>{group.total.beds}</td>
                      <td className={styles.num}>{group.total.ready}</td>
                      <td className={styles.num}>{group.total.pending}</td>
                      <td className={styles.num}>{group.total.occupied}</td>
                      <td className={styles.num}>{group.total.onLeave}</td>
                      <td className={styles.num}>{group.total.pulled}</td>
                      <td className={styles.num}>{group.total.closed}</td>
                    </tr>
                    {group.wards.map((ward) => (
                      <tr key={ward.unitId}>
                        <th scope="row">{ward.name}</th>
                        <td className={styles.muted}>{ward.service}</td>
                        <td className={styles.num}>{ward.beds}</td>
                        <td className={styles.num}>
                          {ward.counts.ready > 0 ? <span className={styles.fit}>{ward.counts.ready}</span> : 0}
                        </td>
                        <td className={styles.num}>{ward.pendingPreparation}</td>
                        <td className={styles.num}>{ward.counts.occupied}</td>
                        <td className={styles.num}>{ward.counts.onLeave}</td>
                        <td className={styles.num}>{ward.counts.pulled}</td>
                        <td className={styles.num}>{ward.counts.closed}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.total}>
                  <th scope="row" colSpan={2}>
                    All wards
                  </th>
                  <td className={styles.num}>{pack.totals.beds}</td>
                  <td className={styles.num} data-testid="ward-downtime-total-ready">
                    {pack.totals.ready}
                  </td>
                  <td className={styles.num}>{pack.totals.pendingPreparation}</td>
                  <td className={styles.num}>{pack.totals.occupied}</td>
                  <td className={styles.num}>{pack.totals.onLeave}</td>
                  <td className={styles.num}>{pack.totals.pulled}</td>
                  <td className={styles.num}>{pack.totals.closed}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={styles.cardNote}>
            Beds in “Being made ready” are counted in Ready. Beds “On leave” are held for a patient on leave and counted
            in Occupied.
          </p>
        </Card>

        <Card aria-labelledby="downtime-ed-title" id={SECTION_IDS.ed} className={styles.packCard}>
          <CardHead
            id="downtime-ed-title"
            icon={Users}
            title="ED queue"
            aside={
              <span className={styles.headMeta}>
                <b>{pack.edQueue.length}</b> waiting
              </span>
            }
          />
          {pack.edQueue.length === 0 ? (
            <p className={styles.cardNote}>0 waiting. Nobody was in an ED queue when the pack was taken.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table
                className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
                data-testid="ward-downtime-ed"
              >
                <caption className={styles.srOnly}>Emergency department queue, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">ED</th>
                    <th scope="col">Arrived</th>
                    <th scope="col" className={styles.num}>
                      Waited
                    </th>
                    <th scope="col" className={styles.num}>
                      Urgency
                    </th>
                    <th scope="col">Legal status</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Accepted by</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.edQueue.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.ed}</td>
                      <td className={styles.time}>{at(line.openedAt)}</td>
                      <td className={styles.num}>{splitDuration(line.waitedMinutes)}</td>
                      <td className={styles.num}>{line.urgency}</td>
                      <td>{line.legalStatus}</td>
                      <td>{line.stage}</td>
                      <td>{line.acceptedWard || NOT_RECORDED}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card aria-labelledby="downtime-moves-title" id={SECTION_IDS.moves} className={styles.packCard}>
          <CardHead
            id="downtime-moves-title"
            icon={Ambulance}
            title="Pending moves"
            aside={
              <span className={styles.headMeta}>
                <b>{pack.pendingMoves.length}</b> accepted
              </span>
            }
          />
          {pack.pendingMoves.length === 0 ? (
            <p className={styles.cardNote}>0 pending. No accepted move was under way when the pack was taken.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table
                className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
                data-testid="ward-downtime-moves"
              >
                <caption className={styles.srOnly}>Pending moves, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Planned move</th>
                    <th scope="col">Transport ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.pendingMoves.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.from}</td>
                      <td>{line.to}</td>
                      <td>{line.stage}</td>
                      <td className={styles.time}>{at(line.plannedAt)}</td>
                      <td className={styles.time}>{at(line.transportEta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card aria-labelledby="downtime-legal-title" id={SECTION_IDS.forms} className={styles.packCard}>
          <CardHead
            id="downtime-legal-title"
            icon={FileText}
            title="Legal forms"
            meta="Recorded times only, not legally checked"
            aside={
              <span className={styles.headMeta}>
                <b>{pack.legalForms.length}</b> forms
              </span>
            }
          />
          {pack.legalForms.length === 0 ? (
            <p className={styles.cardNote}>0 forms. No legal form was on an open movement when the pack was taken.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table
                className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
                data-testid="ward-downtime-legal"
              >
                <caption className={styles.srOnly}>Legal forms with recorded times, synthetic</caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Form</th>
                    <th scope="col">Legal status</th>
                    <th scope="col">Made</th>
                    <th scope="col">Received</th>
                    <th scope="col">Typed expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.legalForms.map((line) => (
                    <tr key={line.movementId}>
                      <th scope="row">{line.person}</th>
                      <td>{line.form || NOT_RECORDED}</td>
                      <td>{line.legalStatus}</td>
                      <td className={styles.time}>{at(line.madeAt)}</td>
                      <td className={styles.time}>{at(line.receivedAt)}</td>
                      <td className={styles.time}>{at(line.typedExpiryAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <WardPrototypeFooter testId="ward-downtime-footer" note="Synthetic data" />
      </main>
    </div>
  );
}

/** A phone list with its empty line: 0 and a sentence, never a blank card. */
function PhoneSection({ empty, count, children }: { empty: string; count: number; children: ReactNode }) {
  if (count === 0) return <p className={styles.phoneNote}>0 · {empty}</p>;
  return <ul className={styles.phoneList}>{children}</ul>;
}
