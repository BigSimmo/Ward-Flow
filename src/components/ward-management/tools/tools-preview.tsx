"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  BedDouble,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileText,
  Mail,
  Moon,
  Phone,
  Search,
  Sun,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { standingFigures } from "../ward-standing-strip";
import { bedStates } from "../ward-bed-states";
import { bedsPendingPreparation, capacityBreakdown } from "../ward-bed-availability";
import { referralQueueOrder } from "../ward-referrals";
import { isOpen } from "../ward-derivations";
import { formatInstant, formatInstantWithDay, splitDuration } from "../ward-clock";
import { allEmergencyDepartments, wardSites } from "../ward-sites";
import { HEALTH_SERVICES } from "../ward-model";
import { REFERENCE_TEAM_NAMES, REFERENCE_TEAM_CAVEAT, referenceTeamDetail } from "../reference/ward-reference-teams";
import { edHref, handoverHref, movementHref, unitHref } from "../shell/ward-facade";
import styles from "./tools-preview.module.css";

const Catchment = dynamic(() => import("./ward-catchment-resolver").then((m) => m.WardCatchmentResolver), {
  loading: () => <p>Loading catchment lookup…</p>,
  ssr: false,
});
const Forms = dynamic(() => import("./ward-mha-calculator").then((m) => m.WardMhaCalculator), {
  loading: () => <p>Loading recorded form dates…</p>,
  ssr: false,
});
const sections = [
  ["overview", "Overview", Wrench],
  ["figures", "Figures", Activity],
  ["utilities", "Utilities", Calculator],
  ["directory", "Directory", BookOpen],
  ["coordination", "Coordination", ClipboardList],
] as const;
type Section = (typeof sections)[number][0];
type Metric = { label: string; value: string | number; note: string; tone?: "amber"; percent?: number };
type Contact = {
  id: string;
  name: string;
  category: string;
  detail: string;
  href?: string;
  phone?: string | null;
  email?: string | null;
  recordedOn?: string | null;
};
const contactTypes = ["All", "Wards", "Community", "ED", "Switchboards", "Bedflow", "Transport", "Escalation"];

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={styles.metric} data-tone={metric.tone} data-long={String(metric.value).length > 8}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      {metric.percent !== undefined && (
        <div
          className={styles.meter}
          role="meter"
          aria-label={metric.label}
          aria-valuenow={metric.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${metric.percent}%` }} />
        </div>
      )}
      <small>{metric.note}</small>
    </article>
  );
}

function Action({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={styles.action}>
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{children}</small>
      </span>
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}

export function ToolsPreview() {
  const state = useWardFlow();
  const { units, admissions, movements, referrals, bedReleases, leaveBeds } = state;
  const now = useWardFlowClock();
  const [section, setSection] = useState<Section>("overview");
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [section]);
  const [figureType, setFigureType] = useState("All figures");
  const [contactType, setContactType] = useState("All");
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(true);
  const [utility, setUtility] = useState("capacity");
  const [bedsInput, setBedsInput] = useState("24");
  const [occupiedInput, setOccupiedInput] = useState("20");
  const [minutes, setMinutes] = useState("90");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const figures = standingFigures({
    movements,
    units,
    admissions,
    bedReleases,
    leaveBeds,
    now,
    chromeRole: "coordinator",
  });
  const find = (key: string) => figures.find((f) => f.key === key);
  const states = units.map((unit) => bedStates(unit, admissions, bedReleases, leaveBeds));
  const sum = (key: keyof (typeof states)[number]) => states.reduce((total, row) => total + row[key], 0);
  const beds = units.reduce((total, unit) => total + unit.beds, 0);
  const occupied = sum("occupied");
  const occupancy = beds > 0 ? Math.round((occupied / beds) * 100) : null;
  const pending = units.reduce((total, unit) => total + bedsPendingPreparation(unit.id, bedReleases), 0);
  const breakdowns = units.map((unit) => capacityBreakdown(unit, bedReleases, leaveBeds, now));
  const fresh = units.filter(
    (unit) =>
      Number.isFinite(unit.allocatable.confirmedAt) &&
      unit.allocatable.confirmedAt <= now &&
      now - unit.allocatable.confirmedAt <= 60,
  ).length;
  const due = movements
    .flatMap((m) => (isOpen(m) && m.legalForm?.dueAt !== undefined ? [{ ...m, dueAt: m.legalForm.dueAt }] : []))
    .sort((a, b) => a.dueAt - b.dueAt);
  const groups: { name: string; description: string; metrics: Metric[] }[] = [
    {
      name: "Capacity",
      description: "The bed picture, right now",
      metrics: [
        {
          label: "Ready now",
          value: find("ready")?.value ?? "—",
          note: pending ? `${pending} pending preparation` : "Recorded allocatable beds",
        },
        {
          label: "Occupied",
          value: occupancy === null ? "—" : `${occupancy}%`,
          note: `${occupied} of ${beds} established beds`,
          ...(occupancy === null ? {} : { percent: occupancy }),
        },
        { label: "Established beds", value: beds, note: `Across ${units.length} wards` },
        { label: "Closed", value: sum("closed"), note: "Closed or unavailable beds" },
        { label: "Pending preparation", value: pending, note: "Included in ready; cannot pull yet" },
        { label: "On leave", value: sum("onLeave"), note: "Included in occupied beds" },
      ],
    },
    {
      name: "Flow",
      description: "Referrals, movement and releases",
      metrics: [
        { label: "Queued referrals", value: referralQueueOrder(referrals).length, note: "Waiting for a bed" },
        { label: "Open movements", value: find("waiting")?.value ?? "—", note: "All open movement stages" },
        { label: "Expected today", value: find("out-today")?.value ?? "—", note: "Recorded discharge plans" },
        {
          label: "Confirmed today",
          value: breakdowns.reduce((n, b) => n + b.confirmedToday, 0),
          note: "Confirmed release pipeline",
        },
        { label: "Pulled beds", value: sum("pulled"), note: "Awaiting arrival" },
        {
          label: "Longest open wait",
          value: find("longest")?.value.replace(/\s+waiting$/u, "") ?? "—",
          note: "Since movement was opened",
        },
      ],
    },
    {
      name: "Due & freshness",
      description: "Recorded deadlines and data age",
      metrics: [
        {
          label: "Deadline passed",
          value: find("passed")?.value ?? "—",
          note: "Open movements · recorded due time",
          ...(find("passed")?.flagged ? { tone: "amber" as const } : {}),
        },
        {
          label: find("within-hour")?.label ?? "Due soon",
          value: find("within-hour")?.value ?? "—",
          note: "Recorded due time on your current urgent default",
          ...(find("within-hour")?.flagged ? { tone: "amber" as const } : {}),
        },
        {
          label: "Recently confirmed",
          value: units.length ? `${Math.round((fresh / units.length) * 100)}%` : "—",
          note: `${fresh} of ${units.length} wards · last 60m`,
        },
        {
          label: "Blocked releases",
          value: breakdowns.reduce((n, b) => n + b.blockedToday, 0),
          note: "Today's release pipeline",
        },
      ],
    },
  ];
  const contacts: Contact[] = [
    ...units.map((unit) => ({
      id: `ward-${unit.id}`,
      name: unit.name,
      category: "Wards",
      detail: "Ward team · prototype location",
      href: unitHref(unit.id),
    })),
    ...REFERENCE_TEAM_NAMES.map((name) => {
      const detail = referenceTeamDetail(name)!;
      return {
        id: detail.referenceId,
        name,
        category: "Community",
        detail: [detail.hsp, detail.publishedHours, detail.address].filter(Boolean).join(" · "),
        phone: detail.publishedPhone,
        email: detail.referralEmail,
        recordedOn: detail.recordedOn,
      };
    }),
    ...allEmergencyDepartments().map((ed) => ({
      id: `ed-${ed.id}`,
      name: ed.name,
      category: "ED",
      detail: "Emergency department team",
      href: edHref(ed.id),
    })),
    ...wardSites.map((site) => ({
      id: `switch-${site.code}`,
      name: `${site.name} switchboard`,
      category: "Switchboards",
      detail: "Hospital switchboard · contact awaiting verification",
    })),
    ...HEALTH_SERVICES.flatMap((service) => [
      {
        id: `bedflow-${service}`,
        name: `${service} bedflow coordinator`,
        category: "Bedflow",
        detail: "Bed placement and flow coordination",
      },
      {
        id: `exec-${service}`,
        name: `${service} executive escalation`,
        category: "Escalation",
        detail: "Executive / after-hours escalation",
      },
    ]),
    {
      id: "transport",
      name: "Mental health transport coordination",
      category: "Transport",
      detail: "Transport bookings and transfer coordination",
    },
  ];
  const matches = contacts.filter(
    (c) =>
      (contactType === "All" || c.category === contactType) &&
      `${c.name} ${c.detail} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const numericBeds = Number(bedsInput),
    numericOccupied = Number(occupiedInput);
  const validCapacity =
    bedsInput.trim() !== "" &&
    occupiedInput.trim() !== "" &&
    Number.isInteger(numericBeds) &&
    Number.isInteger(numericOccupied) &&
    numericBeds > 0 &&
    numericOccupied >= 0 &&
    numericOccupied <= numericBeds;
  const validMinutes = minutes.trim() !== "" && Number.isInteger(Number(minutes)) && Number(minutes) >= 0;
  async function copySnapshot() {
    try {
      await navigator.clipboard.writeText(
        `Ward Flow · synthetic network snapshot · ${formatInstant(now)}\n${groups.flatMap((g) => g.metrics.map((m) => `${m.label}: ${m.value} (${m.note})`)).join("\n")}`,
      );
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Clipboard unavailable. Use the handover sheet to review and print figures.");
    }
  }

  return (
    <main
      id="main-content"
      className={styles.stage}
      data-preview-theme={dark ? "dark" : "light"}
      data-preview-open={open}
    >
      <div className={styles.stageIntro}>
        <span className={styles.kicker}>WARD FLOW / DESIGN PREVIEW</span>
        <h1>
          A quieter workspace.
          <br />A clearer picture.
        </h1>
        <p>
          Everyday tools, brought together.
          <br />
          One compact workspace for the whole network.
        </p>
        <button className={styles.reopen} onClick={() => setOpen(true)} type="button">
          <Wrench aria-hidden="true" />
          Open tools preview
        </button>
        <Link href="/mockups/ward-flow">
          Return to Ward Flow <ArrowUpRight aria-hidden="true" />
        </Link>
        <small>Interactive mockup · synthetic application data</small>
      </div>
      {open && (
        <section className={styles.drawer} data-section={section} aria-label="Tools design preview">
          <header className={styles.header}>
            <div className={styles.headerIcon}>
              <Wrench aria-hidden="true" />
            </div>
            <div>
              <div className={styles.titleLine}>
                <h2>Tools</h2>
                <span>Whole network</span>
              </div>
              <p>Your everyday coordination workspace.</p>
            </div>
            <button type="button" aria-label="Close tools preview" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </button>
          </header>
          <nav className={styles.nav} role="tablist" aria-label="Tools sections">
            {sections.map(([key, label, Icon]) => (
              <button
                key={key}
                id={`preview-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={section === key}
                tabIndex={section === key ? 0 : -1}
                aria-controls={`preview-${key}`}
                onClick={() => setSection(key)}
                onKeyDown={(event) => {
                  const index = sections.findIndex(([id]) => id === key);
                  let next: number;
                  if (event.key === "ArrowRight") next = (index + 1) % sections.length;
                  else if (event.key === "ArrowLeft") next = (index + sections.length - 1) % sections.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = sections.length - 1;
                  else return;
                  event.preventDefault();
                  setSection(sections[next][0]);
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
                }}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.body} ref={bodyRef}>
            <div className={styles.live}>
              <span>
                <i />
                Updating from application state
              </span>
              <time>{formatInstant(now)} AWST</time>
            </div>
            <div id={`preview-${section}`} role="tabpanel" aria-labelledby={`preview-tab-${section}`} tabIndex={0}>
              {section === "overview" && (
                <>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.kicker}>NETWORK PULSE</span>
                      <h3>The essentials, at a glance.</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSection("figures");
                        setFigureType("All figures");
                      }}
                    >
                      All figures <ArrowUpRight aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.pulse}>
                    <article className={styles.ready}>
                      <BedDouble aria-hidden="true" />
                      <span>Ready now</span>
                      <strong>{find("ready")?.value}</strong>
                      <small>
                        {pending > 0 ? `${pending} still being made ready` : `Across ${units.length} wards`}
                      </small>
                      <button
                        type="button"
                        onClick={() => {
                          setSection("figures");
                          setFigureType("Capacity");
                        }}
                      >
                        Explore capacity <ChevronRight aria-hidden="true" />
                      </button>
                    </article>
                    <div className={styles.pulseGrid}>
                      <MetricCard metric={groups[0].metrics[1]} />
                      <MetricCard metric={groups[1].metrics[0]} />
                      <MetricCard metric={groups[2].metrics[0]} />
                      <MetricCard metric={groups[2].metrics[1]} />
                    </div>
                  </div>
                  <div className={styles.twoColumn}>
                    <section className={styles.card}>
                      <div className={styles.cardHeading}>
                        <Clock3 aria-hidden="true" />
                        <h3>Coming up</h3>
                        <span>Recorded times</span>
                      </div>
                      {due.slice(0, 3).map((m) => (
                        <Link className={styles.dueRow} key={m.id} href={movementHref(m.id)}>
                          <span>
                            <strong>
                              {m.legalForm!.code} · {m.id}
                            </strong>
                            <small>
                              {m.dueAt < now ? "Recorded deadline passed" : `${splitDuration(m.dueAt - now)} remaining`}
                            </small>
                          </span>
                          <b>{formatInstantWithDay(m.dueAt, now)}</b>
                        </Link>
                      ))}
                      {!due.length && <p className={styles.note}>No recorded due times on open movements.</p>}
                      <button type="button" className={styles.textButton} onClick={() => setSection("coordination")}>
                        Open coordination <ArrowUpRight aria-hidden="true" />
                      </button>
                    </section>
                    <section className={styles.card}>
                      <div className={styles.cardHeading}>
                        <Wrench aria-hidden="true" />
                        <h3>Quick actions</h3>
                      </div>
                      <Action href={handoverHref()} icon={<FileText aria-hidden="true" />} title="Handover sheet">
                        Review and print this shift
                      </Action>
                      <Action
                        href="/mockups/ward-flow/referrals/new"
                        icon={<Users aria-hidden="true" />}
                        title="Raise a referral"
                      >
                        Start a placement request
                      </Action>
                      <button type="button" className={styles.action} onClick={() => setSection("directory")}>
                        <BookOpen aria-hidden="true" />
                        <span>
                          <strong>Find a contact</strong>
                          <small>Teams, switchboards and support</small>
                        </span>
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                    </section>
                  </div>
                  <section className={`${styles.card} ${styles.appearance}`}>
                    <span>
                      <Sun aria-hidden="true" />
                      <strong>Appearance</strong>
                      <small>Preview your preferred finish</small>
                    </span>
                    <div role="group" aria-label="Preview appearance">
                      <button type="button" aria-pressed={!dark} onClick={() => setDark(false)}>
                        <Sun aria-hidden="true" />
                        Light
                      </button>
                      <button type="button" aria-pressed={dark} onClick={() => setDark(true)}>
                        <Moon aria-hidden="true" />
                        Dark
                      </button>
                    </div>
                  </section>
                </>
              )}
              {section === "figures" && (
                <>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.kicker}>WHOLE NETWORK</span>
                      <h3>Figures that inform the shift.</h3>
                    </div>
                    <Activity aria-hidden="true" />
                  </div>
                  <div className={styles.filters} role="group" aria-label="Figure types">
                    {["All figures", ...groups.map((g) => g.name)].map((label) => (
                      <button
                        type="button"
                        aria-pressed={figureType === label}
                        key={label}
                        onClick={() => setFigureType(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {groups
                    .filter((g) => figureType === "All figures" || figureType === g.name)
                    .map((group) => (
                      <section key={group.name} className={styles.figureGroup}>
                        <div className={styles.groupHeading}>
                          <h4>{group.name}</h4>
                          <small>{group.description}</small>
                        </div>
                        <div className={styles.metricGrid}>
                          {group.metrics.map((metric) => (
                            <MetricCard key={metric.label} metric={metric} />
                          ))}
                        </div>
                      </section>
                    ))}
                  <p className={styles.note}>
                    Derived from shared synthetic records. Ready includes pending preparation. Occupancy uses
                    established beds, including closed beds, as its denominator. Recorded due times do not verify legal
                    limits.
                  </p>
                </>
              )}
              {section === "directory" && (
                <>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.kicker}>PEOPLE & SERVICES</span>
                      <h3>The right team, within reach.</h3>
                    </div>
                    <BookOpen aria-hidden="true" />
                  </div>
                  <label className={styles.search}>
                    <Search aria-hidden="true" />
                    <input
                      aria-label="Search contacts"
                      placeholder="Search teams, hospitals, numbers or email…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                        <X aria-hidden="true" />
                      </button>
                    )}
                  </label>
                  <div className={styles.filters} role="group" aria-label="Contact types">
                    {contactTypes.map((type) => (
                      <button
                        type="button"
                        key={type}
                        aria-pressed={contactType === type}
                        onClick={() => setContactType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className={styles.resultLine} role="status">
                    <strong>{matches.length} synthetic records</strong>
                    <span>Network directory</span>
                  </div>
                  <p className={styles.note}>
                    Published community details are reference information, not call-tested. Other contact fields await a
                    verified service directory.
                  </p>
                  <ul className={styles.contacts} aria-label="Contact results">
                    {matches.map((c) => (
                      <li className={styles.contact} key={c.id}>
                        <div className={styles.contactTop}>
                          <span className={styles.contactIcon}>
                            {c.category === "Community" ? <Users aria-hidden="true" /> : <Phone aria-hidden="true" />}
                          </span>
                          <div>
                            <small>{c.category}</small>
                            {c.href ? (
                              <Link href={c.href}>
                                {c.name}
                                <ArrowUpRight aria-hidden="true" />
                              </Link>
                            ) : (
                              <strong>{c.name}</strong>
                            )}
                          </div>
                        </div>
                        <p>{c.detail}</p>
                        <div className={styles.contactDetails}>
                          {c.phone ? (
                            <a href={`tel:${c.phone.replace(/\s/g, "")}`}>
                              <Phone aria-hidden="true" />
                              {c.phone}
                            </a>
                          ) : (
                            <span>
                              <Phone aria-hidden="true" />
                              Number not supplied
                            </span>
                          )}
                          {c.email ? (
                            <a href={`mailto:${c.email}`}>
                              <Mail aria-hidden="true" />
                              {c.email}
                            </a>
                          ) : (
                            <span>
                              <Mail aria-hidden="true" />
                              Email not supplied
                            </span>
                          )}
                        </div>
                        {c.recordedOn ? (
                          <details>
                            <summary>Published reference · recorded {c.recordedOn}</summary>
                            <p>{REFERENCE_TEAM_CAVEAT}</p>
                          </details>
                        ) : (
                          <small className={styles.unverified}>Awaiting verified contact details</small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!matches.length && (
                    <div className={styles.empty}>
                      <Search aria-hidden="true" />
                      <h4>No matching contacts</h4>
                      <p>Try a team name, another category or a shorter search.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setContactType("All");
                        }}
                      >
                        Reset search
                      </button>
                    </div>
                  )}
                </>
              )}
              {section === "utilities" && (
                <>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.kicker}>EVERYDAY HELPERS</span>
                      <h3>Small tools. Useful answers.</h3>
                    </div>
                    <Calculator aria-hidden="true" />
                  </div>
                  <div className={styles.utilityGrid}>
                    {[
                      ["capacity", "Capacity calculator", "Beds, occupancy and headroom", BedDouble],
                      ["duration", "Duration converter", "Minutes into hours and days", Clock3],
                      ["catchment", "Catchment lookup", "Existing reviewed WA reference", Search],
                      ["forms", "Form date review", "Review recorded dates and cover", FileText],
                    ].map(([id, title, subtitle, Icon]) => {
                      const Glyph = Icon as typeof BedDouble;
                      return (
                        <button
                          type="button"
                          key={String(id)}
                          aria-pressed={utility === id}
                          onClick={() => setUtility(String(id))}
                        >
                          <Glyph aria-hidden="true" />
                          <strong>{String(title)}</strong>
                          <small>{String(subtitle)}</small>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                  <section className={styles.card}>
                    {utility === "capacity" && (
                      <>
                        <div className={styles.cardHeading}>
                          <BedDouble aria-hidden="true" />
                          <h3>Capacity calculator</h3>
                          <span>Scratchpad</span>
                        </div>
                        <div className={styles.inputs}>
                          <label>
                            Established beds
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={bedsInput}
                              onChange={(e) => setBedsInput(e.target.value)}
                            />
                          </label>
                          <label>
                            Occupied beds
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={occupiedInput}
                              onChange={(e) => setOccupiedInput(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className={styles.calculation} role="status">
                          {validCapacity ? (
                            <>
                              <strong>
                                {Math.round((numericOccupied / numericBeds) * 100)}%<small>occupancy</small>
                              </strong>
                              <strong>
                                {numericBeds - numericOccupied}
                                <small>unoccupied beds</small>
                              </strong>
                            </>
                          ) : (
                            <p>Enter whole bed counts; occupied must be between zero and established beds.</p>
                          )}
                        </div>
                        <p className={styles.note}>
                          Planning scratchpad only. Unoccupied beds may be closed or unavailable; this does not update
                          capacity records.
                        </p>
                      </>
                    )}
                    {utility === "duration" && (
                      <>
                        <div className={styles.cardHeading}>
                          <Clock3 aria-hidden="true" />
                          <h3>Duration converter</h3>
                        </div>
                        <div className={styles.inputs}>
                          <label>
                            Minutes
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={minutes}
                              onChange={(e) => setMinutes(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className={styles.calculation} role="status">
                          <strong>
                            {validMinutes ? splitDuration(Number(minutes)) : "Enter a whole, non-negative duration"}
                          </strong>
                        </div>
                      </>
                    )}
                    {utility === "catchment" && (
                      <>
                        <h3>Catchment lookup</h3>
                        <Catchment />
                      </>
                    )}
                    {utility === "forms" && (
                      <>
                        <h3>Form date review</h3>
                        <Forms />
                      </>
                    )}
                  </section>
                  <Action
                    href={handoverHref()}
                    icon={<FileText aria-hidden="true" />}
                    title="Prepare the shift handover"
                  >
                    Open the existing handover and print workflow
                  </Action>
                </>
              )}
              {section === "coordination" && (
                <>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.kicker}>SHIFT COMPANION</span>
                      <h3>Keep the next steps in view.</h3>
                    </div>
                    <ClipboardList aria-hidden="true" />
                  </div>
                  <div className={styles.metricGrid}>
                    {[groups[2].metrics[0], groups[2].metrics[1], groups[1].metrics[2]].map((m) => (
                      <MetricCard key={m.label} metric={m} />
                    ))}
                  </div>
                  <section className={styles.card}>
                    <div className={styles.cardHeading}>
                      <Clock3 aria-hidden="true" />
                      <h3>Recorded due times</h3>
                      <span>{due.length} open</span>
                    </div>
                    {due.map((m) => (
                      <Link className={styles.dueRow} key={m.id} href={movementHref(m.id)}>
                        <span>
                          <strong>
                            {m.legalForm!.code} · {m.id}
                          </strong>
                          <small>
                            {m.dueAt < now ? "Deadline passed" : `${splitDuration(m.dueAt - now)} remaining`}
                          </small>
                        </span>
                        <b>{formatInstantWithDay(m.dueAt, now)}</b>
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    ))}
                    {!due.length && <p className={styles.note}>No recorded due times on open movements.</p>}
                  </section>
                  <div className={styles.twoColumn}>
                    <Action href={handoverHref()} icon={<FileText aria-hidden="true" />} title="Shift handover">
                      Review, print and share
                    </Action>
                    <Action href="/mockups/ward-flow/delays" icon={<Users aria-hidden="true" />} title="Delays">
                      Review recorded delays
                    </Action>
                  </div>
                  <button type="button" className={styles.copyButton} onClick={copySnapshot}>
                    {copied ? <Check aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
                    {copied ? "Snapshot copied · copy again" : "Copy network snapshot"}
                  </button>
                  <p className={styles.note} role="status">
                    {copyError || "Copies aggregate synthetic figures with their timestamp. No patient details."}
                  </p>
                </>
              )}
            </div>
          </div>
          <footer className={styles.footer}>
            <span>
              <i />
              Synthetic data
            </span>
            <span>Design preview · not a clinical record</span>
          </footer>
        </section>
      )}
    </main>
  );
}
