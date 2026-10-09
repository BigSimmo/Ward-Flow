"use client";

import { Copy, Flag, Mail, PhoneCall, Star, X } from "lucide-react";
import Link from "next/link";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import { wardSites } from "@/components/ward-management/ward-sites";
import { Badge, Button, Icon, StatusGlyph, cx, durMinutes } from "@/components/wf";
import {
  CHECK_DUE_DAYS,
  SERVICE_META,
  availability,
  escalationChain,
  hhmm,
  isAnswering,
  lineAt,
  numberAt,
  windowText,
  type ContactWindow,
  type DirectoryEntry,
  type DirectoryService,
} from "./on-call-directory";

import styles from "./on-call.module.css";

/** What a row or card can ask the screen to do. One set of handlers serves desktop and phone. */
export type ContactActions = {
  minute: number;
  day: number;
  entries: readonly DirectoryEntry[];
  favourites: readonly string[];
  onPick: (id: string) => void;
  onToggleFavourite: (id: string) => void;
  onCopy: (text: string, label: string) => void;
  onCall: (entry: DirectoryEntry) => void;
};

export const NOT_WIRED = "Not wired in this prototype.";

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** A ward's two rows carry the ward name; every other row is a role, line or team. */
export const isWardRow = (entry: DirectoryEntry) => entry.kind === "nurseInCharge" || entry.kind === "referralInbox";

export function placeOf(entry: DirectoryEntry): string {
  if (isWardRow(entry))
    return `${entry.kind === "nurseInCharge" ? "Nurse in charge" : "Referral inbox"}, ${entry.groupTitle}`;
  return entry.place;
}

/** Service colour as a dot, with the short name when asked. Colour is never the only signal. */
export function ServiceTag({
  service,
  label,
  strong,
}: {
  service: DirectoryService;
  label?: string;
  strong?: boolean;
}) {
  const meta = SERVICE_META[service];
  return (
    <span className={cx(styles.svc, strong && styles.svcStrong)} data-tone={meta.tone}>
      <span className={styles.svcDot} aria-hidden="true" />
      {label === undefined ? meta.short : label}
    </span>
  );
}

export function FavouriteButton({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  const on = actions.favourites.includes(entry.id);
  return (
    <button
      type="button"
      className={cx(styles.favouriteButton, on && styles.favouriteOn)}
      aria-pressed={on}
      aria-label={`${on ? "Remove" : "Add"} ${entry.name}${entry.siteCode ? `, ${entry.siteCode}` : ""} ${on ? "from" : "to"} My list`}
      onClick={(event) => {
        event.stopPropagation();
        actions.onToggleFavourite(entry.id);
      }}
    >
      <Icon icon={Star} size={14} />
    </button>
  );
}

/** "Until 08:00, then bed flow office" or "Opens 08:00, now: executive on call". */
export function UntilCell({
  entry,
  actions,
  compact,
}: {
  entry: DirectoryEntry;
  actions: ContactActions;
  compact?: boolean;
}) {
  const now = availability(entry, actions.minute, actions.day);
  if (now.kind === "none") return null;
  if (now.kind === "on" && now.allDay) {
    return (
      <span className={styles.until}>
        <span className={styles.untilMain}>
          <StatusGlyph tone="success" size={10} />
          {now.email ? "Inbox open" : "24 hours"}
        </span>
        {compact ? null : <span className={styles.untilSub}>{now.email ? "Read all day" : "Always answered"}</span>}
      </span>
    );
  }
  if (now.kind === "on") {
    const then = now.email ? "inbox closes" : now.then ? `then ${lower(now.then.label)}` : "then closed";
    return (
      <span className={cx(styles.until, now.soon && styles.untilSoon)}>
        <span className={styles.untilMain}>
          <StatusGlyph tone={now.soon ? "warning" : "success"} size={10} />
          Until <span className={styles.mono}>{hhmm(now.until)}</span>
        </span>
        {compact ? null : <span className={styles.untilSub}>{then}</span>}
      </span>
    );
  }
  const alternative = now.email
    ? actions.entries.find(
        (item) => item.kind === "nurseInCharge" && item.group === entry.group && item.name === entry.name,
      )
    : escalationChain(entry, actions.entries).find((item) => isAnswering(item, actions.minute, actions.day));
  return (
    <span className={cx(styles.until, styles.untilOff)}>
      <span className={styles.untilMain}>
        <StatusGlyph tone="neutral" size={10} />
        Opens <span className={styles.mono}>{hhmm(now.opens)}</span>
      </span>
      {compact ? null : (
        <span className={styles.untilSub}>
          {alternative
            ? `Now: ${alternative.kind === "nurseInCharge" ? "nurse in charge" : lower(alternative.name)}`
            : "No one covers now"}
        </span>
      )}
    </span>
  );
}

/** The number to ring now, its line, and how many other lines it has. */
export function NumberCell({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  if (entry.lines.length === 0) return entry.email ? <span className={styles.cellSub}>Email only</span> : null;
  const now = availability(entry, actions.minute, actions.day);
  const shown = (now.kind === "on" ? now.line : now.kind === "off" ? now.next : null) ?? entry.lines[0]!;
  return (
    <span className={cx(styles.numberCell, now.kind === "off" && styles.numberOff)}>
      <span className={styles.number}>{shown.number ?? "Not held"}</span>
      <span className={styles.cellSub}>
        {shown.label}
        {entry.lines.length > 1 ? <span className={styles.mono}> +{entry.lines.length - 1}</span> : null}
      </span>
    </span>
  );
}

function segments(window: ContactWindow | null): [number, number][] {
  if (window === null) return [[0, 1440]];
  return window[0] < window[1]
    ? [[window[0], window[1]]]
    : [
        [0, window[1]],
        [window[0], 1440],
      ];
}

/** One day of a contact's lines, the line answering now drawn solid, with a marker at the shown time. */
export function DayBar({ entry, minute, day = 1, ticks = true }: { entry: DirectoryEntry; minute: number; day?: number; ticks?: boolean }) {
  const lines = entry.lines.length
    ? entry.lines.map((item) => ({ label: item.label, window: item.window }))
    : entry.email
      ? [{ label: "Inbox", window: entry.emailWindow }]
      : [];
  const current = entry.lines.length ? lineAt(entry, minute, day)?.label : isAnswering(entry, minute, day) ? "Inbox" : undefined;
  return (
    <div className={styles.dayBar} aria-hidden="true">
      <div className={styles.dayTrack}>
        {lines.flatMap((item) =>
          segments(item.window).map(([from, to]) => (
            <i
              key={`${item.label}-${from}`}
              className={cx(styles.daySeg, item.label === current && styles.daySegNow)}
              style={{ left: `${from / 14.4}%`, width: `${(to - from) / 14.4}%` }}
            />
          )),
        )}
        <span className={styles.dayNow} style={{ left: `${minute / 14.4}%` }} />
      </div>
      {ticks ? (
        <div className={styles.dayTicks}>
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
      ) : null}
    </div>
  );
}

function StatusBlock({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  const now = availability(entry, actions.minute, actions.day);
  if (now.kind === "none") return null;
  if (now.kind === "on" && now.allDay) {
    return (
      <div className={styles.status}>
        <span className={styles.statusCap}>
          <StatusGlyph tone="success" size={12} />
          <b>{now.email ? "Inbox open" : "Answered day and night"}</b>
        </span>
        <span className={styles.statusNext}>No change today</span>
      </div>
    );
  }
  if (now.kind === "on") {
    return (
      <div className={cx(styles.status, now.soon && styles.statusSoon)}>
        <span className={styles.statusCap}>
          <StatusGlyph tone={now.soon ? "warning" : "success"} size={12} />
          <b>
            {now.email ? "Inbox read" : "Answering"} until <span className={styles.mono}>{hhmm(now.until)}</span>
          </b>
        </span>
        <span className={styles.statusLeft}>{durMinutes(now.left)} left</span>
        <span className={styles.statusNext}>
          {now.email ? (
            "Inbox closes"
          ) : now.then ? (
            <>
              Then {lower(now.then.label)}, <span className={styles.mono}>{now.then.number ?? "Not held"}</span>
            </>
          ) : (
            "Then closed"
          )}
        </span>
      </div>
    );
  }
  const alternative = now.email
    ? actions.entries.find(
        (item) => item.kind === "nurseInCharge" && item.group === entry.group && item.name === entry.name,
      )
    : escalationChain(entry, actions.entries).find((item) => isAnswering(item, actions.minute, actions.day));
  return (
    <div className={cx(styles.status, styles.statusOff)}>
      <span className={styles.statusCap}>
        <StatusGlyph tone="neutral" size={12} />
        <b>
          Closed, opens <span className={styles.mono}>{hhmm(now.opens)}</span>
        </b>
      </span>
      <span className={styles.statusLeft}>in {durMinutes(now.wait)}</span>
      <span className={styles.statusNext}>
        {alternative ? (
          <>
            Call now:{" "}
            <button type="button" className={styles.textLink} onClick={() => actions.onPick(alternative.id)}>
              {alternative.kind === "nurseInCharge" ? `${alternative.name} nurse in charge` : alternative.name}
            </button>{" "}
            <span className={styles.mono}>{numberAt(alternative, actions.minute, actions.day) ?? ""}</span>
          </>
        ) : (
          "No one covers now"
        )}
      </span>
    </div>
  );
}

function LinesBlock({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  if (!entry.lines.length) return null;
  const now = availability(entry, actions.minute, actions.day);
  return (
    <section className={styles.section} aria-label="Numbers">
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Numbers</span>
        <span className={styles.sectionMeta}>
          {entry.lines.length} {entry.lines.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <ul className={styles.lines}>
        {entry.lines.map((item) => {
          const current = now.kind === "on" && now.line === item;
          const next = !current && now.kind === "off" && now.next === item;
          return (
            <li key={item.label} className={cx(styles.lineRow, current && styles.lineNow)}>
              <span className={styles.lineLabel}>
                <b>{item.label}</b>
                <span className={styles.mono}>{windowText(item.window)}</span>
              </span>
              <span className={styles.lineNumber}>{item.number ?? "Not held"}</span>
              <span className={cx(styles.lineState, !current && styles.lineStateOff)}>
                <StatusGlyph tone={current ? "success" : "neutral"} size={9} />
                {current ? "Now" : next ? "Next" : "Off"}
              </span>
              {item.number ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Copy ${lower(item.label)} number`}
                  onClick={() => actions.onCopy(item.number!, "Number copied")}
                >
                  <Icon icon={Copy} size={14} />
                </button>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ul>
      <DayBar entry={entry} minute={actions.minute} day={actions.day} />
    </section>
  );
}

function EmailBlock({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  if (!entry.email) return null;
  const window = entry.emailWindow;
  return (
    <section className={styles.section} aria-label="Referral email">
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>Referral email</span>
        <span className={styles.sectionMeta}>
          {window ? (
            <>
              Read <span className={styles.mono}>{windowText(window)}</span> weekdays
            </>
          ) : (
            "Read daily"
          )}
        </span>
      </div>
      <div className={styles.emailRow}>
        <span className={styles.emailText}>{entry.email}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Copy referral email"
          onClick={() => actions.onCopy(entry.email!, "Email copied")}
        >
          <Icon icon={Copy} size={14} />
        </button>
      </div>
      {entry.sendWith.length ? (
        <div className={styles.sendWith}>
          <span className={styles.sectionMeta}>Send with</span>
          <ul>
            {entry.sendWith.map((item) => (
              <li key={item}>
                <StatusGlyph tone="success" size={10} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const WAITS = ["After 10 min", "After 20 min", "After 30 min"];

/**
 * If no answer: who to try next. The ladder ends at the governance lead, the statewide Tier 3
 * escalation desk. A preview order, labelled so; nothing here is a ratified escalation policy.
 */
function LadderBlock({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  const chain = escalationChain(entry, actions.entries);
  if (!chain.length) return null;
  return (
    <section className={styles.section} aria-label="If no answer">
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>If no answer</span>
        <Badge size="sm" variant="plain">
          Preview order
        </Badge>
      </div>
      <ol className={styles.ladder}>
        {chain.map((item, index) => {
          const now = availability(item, actions.minute, actions.day);
          return (
            <li key={item.id}>
              <button type="button" className={styles.ladderRow} onClick={() => actions.onPick(item.id)}>
                <span className={styles.ladderStep}>{index + 1}</span>
                <span className={styles.ladderRole}>
                  <b>{item.name}</b>
                  <span>
                    {WAITS[index] ?? WAITS[2]}, {item.place}
                  </span>
                </span>
                <span className={styles.ladderEnd}>
                  <span className={styles.number}>{numberAt(item, actions.minute, actions.day) ?? "Email"}</span>
                  <span className={styles.cellSub}>
                    {now.kind === "on"
                      ? now.allDay
                        ? "24 hours"
                        : `Until ${hhmm(now.until)}`
                      : now.kind === "off"
                        ? `Opens ${hhmm(now.opens)}`
                        : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SiteBlock({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  const siblings = actions.entries
    .filter((item) => item.group === entry.group && item.id !== entry.id && item.kind !== "referralInbox")
    .slice(0, 8);
  if (!siblings.length) return null;
  return (
    <section
      className={styles.section}
      aria-label={entry.siteCode ? `Also at ${entry.siteCode}` : "Also in this group"}
    >
      <div className={styles.sectionHead}>
        <span className={styles.eyebrow}>{entry.siteCode ? `Also at ${entry.siteCode}` : "Also in this group"}</span>
        <span className={styles.sectionMeta}>{siblings.length}</span>
      </div>
      <div className={styles.siblings}>
        {siblings.map((item) => (
          <button key={item.id} type="button" className={styles.sibling} onClick={() => actions.onPick(item.id)}>
            <b>{item.name}</b>
            <span className={styles.number}>{numberAt(item, actions.minute, actions.day) ?? "Email"}</span>
            <StatusGlyph tone={isAnswering(item, actions.minute, actions.day) ? "success" : "neutral"} size={9} />
          </button>
        ))}
      </div>
    </section>
  );
}

function RecordFoot({ entry }: { entry: DirectoryEntry }) {
  const due = entry.checkedDaysAgo > CHECK_DUE_DAYS;
  return (
    <div className={styles.recordFoot}>
      <StatusGlyph tone={due ? "warning" : "success"} size={10} />
      <span className={styles.recordText}>
        Synthetic record, checked {entry.checkedDaysAgo} {entry.checkedDaysAgo === 1 ? "day" : "days"} ago
      </span>
      <Badge size="sm" variant="plain">
        Not verified
      </Badge>
      <Button variant="ghost" size="sm" icon={Flag} disabledReason={NOT_WIRED} reasonDisplay="tooltip">
        Report change
      </Button>
    </div>
  );
}

/** Call, copy and email for one contact. Calling never dials: it copies and says so. */
export function CallRow({ entry, actions }: { entry: DirectoryEntry; actions: ContactActions }) {
  const number = numberAt(entry, actions.minute, actions.day);
  return (
    <div className={styles.callRow}>
      {number ? (
        <>
          <Button variant="pri" icon={PhoneCall} className={styles.callButton} onClick={() => actions.onCall(entry)}>
            Call <span className={styles.mono}>{number}</span>
          </Button>
          <Button
            variant="sec"
            icon={Copy}
            iconOnly
            aria-label="Copy number"
            onClick={() => actions.onCopy(number, "Number copied")}
          />
        </>
      ) : null}
      {entry.email && number ? (
        <Button
          variant="sec"
          icon={Mail}
          iconOnly
          aria-label="Copy referral email"
          onClick={() => actions.onCopy(entry.email!, "Email copied")}
        />
      ) : null}
      {entry.email && !number ? (
        <Button
          variant="pri"
          icon={Mail}
          className={styles.callButton}
          onClick={() => actions.onCopy(entry.email!, "Email copied")}
        >
          Copy referral email
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The contact card: who, whether they answer and until when, how to reach them, what to send, who
 * to try next and who else is at the site. The desktop panel and the phone sheet both render it.
 */
export function ContactCard({
  entry,
  actions,
  headingId,
  onClose,
  showHead = true,
  showCall = true,
}: {
  entry: DirectoryEntry;
  actions: ContactActions;
  headingId?: string;
  onClose?: () => void;
  showHead?: boolean;
  showCall?: boolean;
}) {
  return (
    <>
      {showHead ? (
        <div className={styles.cardHead}>
          <div className={styles.cardWho}>
            <span className={styles.cardEyebrow}>
              <ServiceTag service={entry.service} label={SERVICE_META[entry.service].name} />
              {entry.siteCode ? <span className={styles.code}>{entry.siteCode}</span> : null}
            </span>
            <h2 id={headingId} className={styles.cardTitle}>
              {entry.name}
            </h2>
            <span className={styles.cardPlace}>{placeOf(entry)}</span>
            {entry.siteCode && wardSites.find((site) => site.code === entry.siteCode)?.emergencyDepartment ? (
              <Link
                href={edHref(wardSites.find((site) => site.code === entry.siteCode)!.emergencyDepartment!.id)}
                prefetch={false}
                className={styles.cardPlace}
              >
                Open ED workspace
              </Link>
            ) : null}
          </div>
          <FavouriteButton entry={entry} actions={actions} />
          {onClose ? <Button variant="ghost" size="sm" icon={X} iconOnly aria-label="Close" onClick={onClose} /> : null}
        </div>
      ) : null}
      <StatusBlock entry={entry} actions={actions} />
      {showCall ? <CallRow entry={entry} actions={actions} /> : null}
      {entry.note ? <p className={styles.note}>{entry.note}</p> : null}
      <LinesBlock entry={entry} actions={actions} />
      <EmailBlock entry={entry} actions={actions} />
      <LadderBlock entry={entry} actions={actions} />
      <SiteBlock entry={entry} actions={actions} />
      <RecordFoot entry={entry} />
    </>
  );
}
