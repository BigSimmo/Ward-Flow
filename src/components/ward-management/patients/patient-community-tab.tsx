"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  Clipboard,
  FileText,
  History,
  Phone,
  Scale,
  Siren,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, CardFoot, CardHead, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
import { activeCommunityTreatmentOrder, type Patient } from "@/components/ward-management/ward-patients";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { formTitleForCode } from "@/lib/form-register";
import { communityTeamById, communityTeamSlug } from "../community/community-derivations";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { calendarDateOf, formatInstant, type Instant } from "../ward-clock";
import type { Admission } from "../ward-admissions";
import type { Movement } from "../ward-model";
import { callRows, type CallRow, type CallTarget } from "./patient-call-list";
import type { PatientNowRecord } from "./patient-now-records";
import {
  recordExtrasFor,
  type CommunityEngagement,
  type PastEpisode,
  type RecordDocument,
} from "./patient-record-extras";
import styles from "./patient-community-tab.module.css";

/**
 * Community tab (patient screen round 2, 1 Nov 2026). Shown only when community engagement is
 * noted (a team episode or a CTO). Answers, in order: which team, who is caring, who to contact,
 * is a CTO in force, which community documents exist, and how hospital and community connect.
 * Every value comes from the record; a field it cannot hold is left out, never guessed. Numbers
 * come from the On-call directory or the record (mock lines); nothing here dials.
 */

// ── Reading the record ──────────────────────────────────────────────────────────────────────

/** Only a team the record calls Active claims active care. */
function teamTone(state: string): WfTone {
  if (/^active\b/i.test(state)) return "success";
  if (/^closed\b/i.test(state)) return "closed";
  return "neutral";
}

/** "Dr E. Waters, Peel Family Practice" → name over practice. Free text, so split only on the first comma. */
function splitGp(gp: string): { name: string; practice?: string } {
  const at = gp.indexOf(",");
  if (at < 0) return { name: gp };
  return { name: gp.slice(0, at).trim(), practice: gp.slice(at + 1).trim() || undefined };
}

/** "28 Oct 2026, home visit" → date over "Home visit". Typed text, split on the first comma only. */
function splitContact(value: string): { when: string; how?: string } {
  const at = value.indexOf(",");
  if (at < 0) return { when: value };
  const how = value.slice(at + 1).trim();
  return { when: value.slice(0, at).trim(), how: how ? how[0].toUpperCase() + how.slice(1) : undefined };
}

/** DD/MM/YYYY 24h, from a demo-clock instant. */
function dateTime(instant: Instant, dayZero: Date | undefined): string {
  if (!dayZero) return formatInstant(instant);
  const day = calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Australia/Perth",
  });
  return `${day} ${formatInstant(instant)}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Sort key for a typed date ("14 Jun 2026", "Mar 2025"). Ordering only; never shown or counted. */
function dateKey(value: string | undefined): number {
  const match = value ? /^(?:(\d{1,2})\s+)?([a-z]{3})[a-z]*\s+(\d{4})/i.exec(value.trim()) : null;
  if (!match) return 0;
  const month = MONTHS.indexOf(match[2].toLowerCase());
  return Number(match[3]) * 10_000 + (month + 1) * 100 + Number(match[1] ?? 0);
}

/** "2 Jul 2026" to "6 Aug 2026" → "2 Jul – 6 Aug 2026". Typed strings, trimmed, never computed. */
function span(start: string, end: string | undefined, open: boolean): string {
  if (open) return `${start} – now`;
  if (!end || end === start) return start;
  const startYear = /\d{4}$/.exec(start)?.[0];
  const endYear = /\d{4}$/.exec(end)?.[0];
  const head = startYear && startYear === endYear ? start.slice(0, -4).trim() : start;
  return `${head} – ${end}`;
}

/** The team page for a team name, or nothing. The hub keys teams by place ("Midland"), so try the
 *  name as written, then without "Community (Mental Health) Team". Never a guessed or fallback page. */
function teamPageHref(name: string): string | undefined {
  const candidates = [name, name.replace(/\s+community(\s+mental\s+health)?\s+team$/i, "")];
  for (const candidate of candidates) {
    const team = communityTeamById(communityTeamSlug(candidate));
    if (team) return `/ward-flow/community/${team.id}`;
  }
  return undefined;
}

/** The person's open ward stay, if the record joins one: occupied first, then any not yet departed. */
function openStay(admissions: readonly Admission[] | undefined, patientId: string | undefined) {
  if (!admissions || !patientId) return undefined;
  const own = admissions.filter((admission) => admission.patientId === patientId);
  return (
    own.findLast((admission) => admission.state === "occupied") ??
    own.findLast((admission) => admission.state !== "departed")
  );
}

const DOC_TONE: Record<RecordDocument["status"], WfTone> = {
  "In force": "info",
  Current: "success",
  Filed: "neutral",
  Ended: "closed",
  Superseded: "closed",
};

const CTO_CODE = /^5[A-F]$/i;

// ── Small parts ─────────────────────────────────────────────────────────────────────────────

function Tag({ tone, children }: { tone?: WfTone; children: ReactNode }) {
  return (
    <span className={styles.tag}>
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      {children}
    </span>
  );
}

function CopyCareLinks({ value }: { value: string }) {
  const [message, setMessage] = useState("");
  return (
    <span className={styles.copy}>
      <span role="status" className={styles.copyStatus}>
        {message}
      </span>
      <Button
        size="sm"
        icon={Clipboard}
        onClick={async () => {
          try {
            await copyTextToClipboard(value);
            setMessage("Copied");
          } catch {
            setMessage("Clipboard is unavailable in this browser");
          }
        }}
      >
        Copy care links
      </Button>
    </span>
  );
}

type Stat = { id: string; icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode };

function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className={styles.stats} data-count={stats.length} aria-label="Community care at a glance">
      {stats.map((stat) => (
        <div key={stat.id} className={styles.stat}>
          <dt className={styles.statLabel}>
            <span className={styles.chip} aria-hidden="true">
              <stat.icon size={14} aria-hidden="true" />
            </span>
            {stat.label}
          </dt>
          <dd className={styles.statValue}>{stat.value}</dd>
          {stat.sub ? <dd className={styles.statSub}>{stat.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function EngagementHero({ engagement, followUp }: { engagement: CommunityEngagement; followUp?: ReactNode }) {
  const active = engagement.status === "active";
  const href = teamPageHref(engagement.team);
  const last = engagement.lastContact ? splitContact(engagement.lastContact) : undefined;
  const next = engagement.nextContact ? splitContact(engagement.nextContact) : undefined;
  const stats: Stat[] = [
    {
      id: "cm",
      icon: UserRound,
      label: active ? "Case manager" : "Last case manager",
      value: engagement.caseManager.name,
      sub: engagement.caseManager.role,
    },
    ...(engagement.psychiatrist
      ? [
          {
            id: "psy",
            icon: Stethoscope,
            label: "Psychiatrist",
            value: engagement.psychiatrist.name,
            sub: engagement.psychiatrist.role,
          },
        ]
      : []),
    ...(last ? [{ id: "last", icon: CalendarCheck, label: "Last contact", value: last.when, sub: last.how }] : []),
    ...(next ? [{ id: "next", icon: CalendarClock, label: "Next contact", value: next.when, sub: next.how }] : []),
  ];

  return (
    <Card className={styles.hero} aria-label="Community team">
      <div className={styles.heroHead}>
        <span className={cx(styles.chip, styles.chipLg)} aria-hidden="true">
          <Users size={18} aria-hidden="true" />
        </span>
        <div className={styles.heroTitle}>
          <h2>{engagement.team}</h2>
          <p>
            <span>{engagement.program}</span>
            <Tag tone={active ? "success" : "closed"}>
              {active ? `Active since ${engagement.since}` : `Ended ${engagement.ended ?? ""}`.trim()}
            </Tag>
            {!active ? <span className={styles.quiet}>Started {engagement.since}</span> : null}
          </p>
        </div>
        {href ? (
          <Link href={href} className={buttonClass({ className: styles.teamLink })}>
            Open team page
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <StatRow stats={stats} />
      {followUp}
    </Card>
  );
}

type ContactItem = {
  key: string;
  name: string;
  role: ReactNode;
  /** A held number. `null`: the directory holds no line. Undefined: no line is expected. */
  number?: string | null;
  hours?: string;
  tag?: { tone?: WfTone; text: string };
};

function ContactGroup({ label, items }: { label: string; items: ContactItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.group}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <ul className={styles.rows}>
        {items.map((item) => (
          <li key={item.key} className={styles.contact}>
            <span className={styles.contactText}>
              <span className={styles.contactName}>
                <b>{item.name}</b>
                {item.tag ? <Tag tone={item.tag.tone}>{item.tag.text}</Tag> : null}
              </span>
              <span className={styles.sub}>{item.role}</span>
            </span>
            {item.number !== undefined ? (
              <span className={styles.contactNumber}>
                {item.number ? (
                  <b className={styles.mono} aria-label={`${item.name}: ${item.number}`}>
                    {item.number}
                  </b>
                ) : (
                  <span className={styles.quiet}>No line held</span>
                )}
                {item.hours ? <span className={styles.quiet}>{item.hours}</span> : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

type TimelineRow = {
  key: string;
  order: number;
  when: string;
  icon: LucideIcon;
  community: boolean;
  where: string;
  kind: string;
  outcome?: string;
  tone?: WfTone;
};

function CareTimeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <ol className={styles.timeline} aria-label="Hospital and community episodes, newest first">
      {rows.map((row) => (
        <li key={row.key} className={styles.tlRow}>
          <span className={styles.tlWhen}>{row.when}</span>
          <span className={cx(styles.tlNode, row.community && styles.tlNodeCommunity)} aria-hidden="true">
            <row.icon size={13} aria-hidden="true" />
          </span>
          <span className={styles.tlText}>
            <span className={styles.tlWhere}>
              <b>{row.where}</b>
              <span className={styles.tlKind}>
                {row.tone ? <StatusGlyph tone={row.tone} size={9} /> : null}
                {row.kind}
              </span>
            </span>
            {row.outcome ? <span className={styles.sub}>{row.outcome}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────────────────────

export function PatientCommunityTab({
  record,
  patient,
  onRecordCto,
  onEndCto,
  recordCtoUnavailable,
  endCtoUnavailable,
}: {
  record: PatientNowRecord;
  patient?: Patient;
  /** Held for the page's contract. Now owns who to call for the current movement. */
  movement?: Movement;
  receivingWardName?: string;
  /** True while a placement or stay is open. */
  stayOpen: boolean;
  onRecordCto: () => void;
  onEndCto: () => void;
  /** Feature 11: why this route's role may not record or end a CTO ("Community team only"). */
  recordCtoUnavailable?: string;
  endCtoUnavailable?: string;
}) {
  const flow = useOptionalWardFlowSelect("admissions", "units", "now", "dayZero");
  const extras = recordExtrasFor(patient?.id ?? record.id);
  const engagements = [...(extras?.community ?? [])].sort(
    (a, b) => Number(b.status === "active") - Number(a.status === "active") || dateKey(b.since) - dateKey(a.since),
  );
  const engagement = engagements[0];
  const order = activeCommunityTreatmentOrder(patient);
  const lastOrder = patient?.communityTreatmentOrder;
  const gp = patient?.generalPractitioner ? splitGp(patient.generalPractitioner) : undefined;

  // ── Who to contact. One clock for every directory row's hours.
  const now = flow?.now;
  const lookup = (target: CallTarget): CallRow | undefined =>
    now === undefined ? undefined : callRows([target], now)[0];
  const sameTeam = (name: string) => engagement !== undefined && name.toLowerCase() === engagement.team.toLowerCase();
  const teams = [...record.community.teams];
  if (engagement && !teams.some((team) => sameTeam(team.name))) {
    teams.unshift({ name: engagement.team, state: "", note: "" });
  }

  const careTeam: ContactItem[] = [
    ...(engagement?.status === "active"
      ? [
          {
            key: "cm",
            name: engagement.caseManager.name,
            role: `Case manager · ${engagement.caseManager.role.replace(/,?\s*case manager$/i, "")}`,
            number: engagement.caseManager.phone ?? null,
          } satisfies ContactItem,
        ]
      : []),
    ...teams.map((team, index): ContactItem => {
      const tone = teamTone(team.state);
      const call = tone === "closed" ? undefined : lookup({ kind: "team", name: team.name, role: team.state });
      const linked = sameTeam(team.name);
      return {
        key: `team-${index}`,
        name: team.name,
        role: linked ? "Team duty line" : team.note || "Community team",
        number: call ? call.number : tone === "closed" ? undefined : null,
        hours: call?.hours,
        tag: linked || !team.state ? undefined : { tone, text: team.state },
      };
    }),
  ];
  const primary: ContactItem[] = gp
    ? [{ key: "gp", name: gp.name, role: gp.practice ? `GP · ${gp.practice}` : "GP" }]
    : [{ key: "gp", name: "GP not recorded", role: "GP" }];
  const mustTell: ContactItem[] = (extras?.supports ?? [])
    .filter((person) => person.notify)
    .map((person, index) => ({
      key: `support-${index}`,
      name: person.name,
      role: [person.role, person.relationship].filter(Boolean).join(" · "),
      number: person.phone ?? null,
    }));

  const summary = [
    engagement ? `Community team: ${engagement.team} (${engagement.status === "active" ? "active" : "ended"})` : null,
    engagement?.status === "active"
      ? `Case manager: ${engagement.caseManager.name}${engagement.caseManager.phone ? `, ${engagement.caseManager.phone}` : ""}`
      : null,
    `GP: ${patient?.generalPractitioner ?? "Not recorded"}`,
    `Catchment: ${patient?.catchmentCommunityTeam ?? "Not recorded"}`,
  ]
    .filter(Boolean)
    .join("\n");

  // ── CTO: the order in force from the store; earlier orders from the store and the register.
  type CtoRow = { key: string; code: string; title: string; source?: string; when: string; status: string };
  const ctoHistory: CtoRow[] = [];
  if (lastOrder && lastOrder.endedAt !== undefined) {
    ctoHistory.push({
      key: "store-last",
      code: lastOrder.form,
      title: formTitleForCode(lastOrder.form) ?? "Community treatment order",
      when: `${dateTime(lastOrder.recordedAt, flow?.dayZero)} to ${dateTime(lastOrder.endedAt, flow?.dayZero)}`,
      status: "Ended",
    });
  }
  for (const [index, earlier] of [...(lastOrder?.earlier ?? [])].reverse().entries()) {
    ctoHistory.push({
      key: `store-${index}`,
      code: earlier.form,
      title: formTitleForCode(earlier.form) ?? "Community treatment order",
      when: `${dateTime(earlier.recordedAt, flow?.dayZero)} to ${dateTime(earlier.endedAt, flow?.dayZero)}`,
      status: "Ended",
    });
  }
  for (const document of extras?.documents ?? []) {
    if (!document.code || !CTO_CODE.test(document.code)) continue;
    ctoHistory.push({
      key: document.id,
      code: document.code.toUpperCase(),
      title: formTitleForCode(document.code) ?? document.title,
      source: document.source,
      when: document.date,
      status: document.status,
    });
  }

  const ctoButton = !patient ? undefined : order ? (
    <Button size="sm" onClick={onEndCto} disabledReason={endCtoUnavailable}>
      Record ended
    </Button>
  ) : (
    // B3 (site review, 12 Oct 2026): the engine records a CTO while a placement or stay is open,
    // and this card then shows it, so the action is not greyed for that.
    <Button size="sm" onClick={onRecordCto} disabledReason={recordCtoUnavailable}>
      Record CTO
    </Button>
  );

  // ── Community documents: those the engagement lists plus any filed under Community. CTO forms
  // sit in the CTO card above, so they are not listed twice.
  const listed = new Set(engagements.flatMap((item) => item.documentIds));
  const documents = (extras?.documents ?? [])
    .filter((document) => listed.has(document.id) || document.category === "Community")
    .filter((document) => !document.code || !CTO_CODE.test(document.code))
    .sort((a, b) => dateKey(b.date) - dateKey(a.date));

  // ── Hospital and community over time: team episodes, and stays that ended with the team or a CTO.
  const communityEpisodes = (extras?.episodes ?? []).filter((episode) => episode.kind === "community");
  const timeline: TimelineRow[] = [];
  for (const [index, item] of engagements.entries()) {
    const match = communityEpisodes.find((episode) => episode.where === item.team && episode.start === item.since);
    timeline.push({
      key: `eng-${index}`,
      order: dateKey(item.since),
      when: span(item.since, item.ended, item.status === "active"),
      icon: Users,
      community: true,
      where: item.team,
      kind: item.program,
      tone: item.status === "active" ? "success" : "closed",
      outcome: item.status === "active" ? `Case manager ${item.caseManager.name}` : match?.outcome,
    });
  }
  const linked = (episode: PastEpisode) => /\bcommunity team\b|\bCTO\b/i.test(episode.outcome);
  for (const episode of extras?.episodes ?? []) {
    const isCommunity = episode.kind === "community";
    if (isCommunity && engagements.some((item) => item.team === episode.where && item.since === episode.start))
      continue;
    if (!isCommunity && !linked(episode)) continue;
    timeline.push({
      key: episode.id,
      order: dateKey(episode.start),
      when: span(episode.start, episode.end, false),
      icon: isCommunity ? Users : episode.kind === "ed" ? Siren : BedDouble,
      community: isCommunity,
      where: episode.where,
      kind: [isCommunity ? "Community" : episode.kind === "ed" ? "ED" : "Admission", episode.stay]
        .filter(Boolean)
        .join(" · "),
      outcome: episode.outcome,
    });
  }
  timeline.sort((a, b) => b.order - a.order);

  // ── Follow-up after a discharge from the open stay, when the record holds one.
  const stay = openStay(flow?.admissions, patient?.id);
  const discharge = stay?.followUp;
  const followUp = discharge ? (
    <p className={styles.followUp}>
      <span className={styles.followLabel}>After discharge</span>
      <b>{discharge.state === "arranged" ? "Follow-up arranged" : "Follow-up not arranged"}</b>
      <span className={styles.quiet}>
        {dateTime(discharge.recordedAt, flow?.dayZero)} · {discharge.recordedBy}
      </span>
    </p>
  ) : null;

  return (
    <section className={styles.pane} aria-label="Community and care continuity" data-layout="community">
      {engagement ? (
        <EngagementHero engagement={engagement} followUp={followUp} />
      ) : followUp ? (
        <Card className={styles.hero}>{followUp}</Card>
      ) : null}

      <div className={styles.cols}>
        <Card aria-label="Recorded care directory">
          <CardHead level={2} icon={Phone} title="Who to contact" meta="Mock numbers" />
          <ContactGroup label="Community team" items={careTeam} />
          <ContactGroup label="Primary care" items={primary} />
          <ContactGroup label="Must be told" items={mustTell} />
          <CardFoot
            className={styles.foot}
            meta={
              <span className={styles.caveat}>
                A recorded catchment does not confirm current case management or an active appointment.
              </span>
            }
          >
            <CopyCareLinks value={summary} />
          </CardFoot>
        </Card>

        <div className={styles.col}>
          <Card aria-label="Community treatment order">
            <CardHead level={2} icon={Scale} title="Community treatment order" action={ctoButton} />
            <div className={styles.ctoNow}>
              {order ? (
                <>
                  <p className={styles.ctoValue}>
                    <StatusGlyph tone="info" />
                    Form {order.form} in force
                  </p>
                  <p className={styles.quiet}>
                    Recorded {dateTime(order.recordedAt, flow?.dayZero)} · {order.recordedBy} · no lapse time shown
                  </p>
                </>
              ) : (
                <p className={styles.ctoValue}>
                  <StatusGlyph tone="neutral" />
                  None in force
                </p>
              )}
            </div>
            {ctoHistory.length > 0 ? (
              <div className={styles.group}>
                <h3 className={styles.groupLabel}>Earlier</h3>
                <ul className={styles.rows}>
                  {ctoHistory.map((row) => (
                    <li key={row.key} className={styles.docRow}>
                      <span className={styles.code}>{row.code}</span>
                      <span className={styles.docTitle}>
                        {row.title}
                        {row.source ? <span className={styles.sub}>{row.source}</span> : null}
                      </span>
                      <span className={styles.docDate}>{row.when}</span>
                      <Tag tone="closed">{row.status}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {documents.length > 0 ? (
            <Card aria-label="Community documents">
              <CardHead level={2} icon={FileText} title="Community documents" meta={String(documents.length)} />
              <ul className={cx(styles.rows, styles.docList)}>
                {documents.map((document) => (
                  <li key={document.id} className={styles.docRow}>
                    {document.code ? <span className={styles.code}>{document.code}</span> : null}
                    <span className={cx(styles.docTitle, !document.code && styles.docTitleWide)}>
                      {document.title}
                      <span className={styles.sub}>{document.source}</span>
                    </span>
                    <span className={styles.docDate}>{document.date}</span>
                    <Tag tone={DOC_TONE[document.status]}>{document.status}</Tag>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      {timeline.length > 0 ? (
        <Card aria-label="Hospital and community over time">
          <CardHead level={2} icon={History} title="Hospital and community" meta="Newest first" />
          <CareTimeline rows={timeline} />
        </Card>
      ) : null}
    </section>
  );
}
