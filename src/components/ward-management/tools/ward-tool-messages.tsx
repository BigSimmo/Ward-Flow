"use client";

import { Fragment, useReducer, useState } from "react";
import { ClipboardCopy } from "lucide-react";

import { Button, Segmented, type ChoiceItem } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { bedSummaryText, type BedSummaryInput } from "@/components/ward-management/tools/ward-bed-summary";
import { standingFigures } from "@/components/ward-management/ward-standing-strip";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates, readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { formatInstant, minutesUntil, splitDuration } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import {
  NO_BEDS_TEXT,
  occupancyPercent,
  occupiedBeds,
} from "@/components/ward-management/statistics/statistics-occupancy";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { releasedCountText } from "@/components/ward-management/statistics/statistics-small-numbers";
import styles from "./ward-tool-messages.module.css";

/**
 * Tools mock-up, Messages (Q318 + Q324): replaces "Copy bed summary". A segmented choice picks the
 * message, a preview card lays it out, and one Copy button puts the plain text on the clipboard.
 * Every figure comes from the derivations the screens already use; nothing is invented. "Summary"
 * keeps today's words exactly (`bedSummaryText`, and the executive desk's own text).
 */

type MessageId = "summary" | "escalation" | "meeting" | "ed";

const MESSAGE_ITEMS: ChoiceItem<MessageId>[] = [
  { id: "summary", label: "Summary" },
  { id: "escalation", label: "Escalation" },
  { id: "meeting", label: "Meeting" },
  { id: "ed", label: "ED" },
];

/** Who each message is for: one short line under the choice. */
const MESSAGE_FOR: Record<MessageId, string> = {
  summary: "Bed summary for email or Teams.",
  escalation: "To the executive on-call.",
  meeting: "Short update for the bed meeting.",
  ed: "Update for the emergency departments.",
};

const SYNTHETIC_FOOT = "Synthetic prototype data. Not for clinical use.";

/** A message: its plain text lines, grouped under short headings for the preview only. */
type Message = { title: string; groups: { heading: string; lines: string[] }[]; foot: string };

function plainText(message: Message): string {
  return [
    message.title,
    ...message.groups.flatMap((group) => group.lines),
    ...(message.foot ? [message.foot] : []),
  ].join("\n");
}

/** Groups today's bed summary lines under preview headings, leaving the copied text untouched. */
function summaryMessage(text: string): Message {
  const lines = text.split("\n");
  const headingFor = (line: string) =>
    /^Ready/.test(line)
      ? "Beds"
      : /^(Open ED|Still in ED)/.test(line)
        ? "ED"
        : /^Discharges/.test(line)
          ? "Discharges"
          : /^Flagged/.test(line)
            ? "Flagged"
            : "Network";
  const groups: Message["groups"] = [];
  for (const line of lines.slice(1, -1)) {
    const heading = headingFor(line);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.lines.push(line);
    else groups.push({ heading, lines: [line] });
  }
  return { title: lines[0] ?? "", groups, foot: lines.length > 1 ? lines[lines.length - 1]! : "" };
}

const listByService = (counts: ReadonlyMap<HealthService, number>) =>
  HEALTH_SERVICES.filter((service) => (counts.get(service) ?? 0) > 0)
    .map((service) => `${service} ${counts.get(service)}`)
    .join(", ");

/** The figures `bedSummaryText` counts, from the same derivations, plus occupancy and the longest wait. */
function operationalFigures(input: BedSummaryInput) {
  const { units, admissions, movements, referrals, bedReleases, leaveBeds, now, thresholds, network } = input;
  // D-115 item 3: a bed named for an open journey or accepted referral is not ready.
  const holds = [...movements, ...referrals];
  const ready = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let readyTotal = 0;
  let pending = 0;
  let confirmed = 0;
  let expected = 0;
  let heldUp = 0;
  // Pulled counts named holds (D-115 item 3), so a bed held by an accepted referral sits in Pulled
  // rather than dropping out of both lines; occupancy stays stay-only (CodeRabbit on #1637).
  let pulled = 0;
  for (const unit of units) {
    pulled += bedStates(unit, admissions, bedReleases, leaveBeds, holds).pulled;
    const capacity = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    const readyHere = readyBedsNow(unit, admissions, bedReleases, holds);
    const service = unitHealthService(unit);
    readyTotal += readyHere;
    if (service) ready.set(service, (ready.get(service) ?? 0) + readyHere);
    pending += bedsPendingPreparation(unit.id, bedReleases);
    confirmed += capacity.confirmedToday;
    expected += capacity.expectedToday;
    heldUp += capacity.blockedToday;
  }
  // Occupancy is Occupied + Pulled, the one figure every other page prints (L1, 12 Oct 2026).
  const occupied = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const waiting = openEdJourneys(movements, now);
  // The longest open wait, as All figures counts it (no record id or name in the text).
  const oldest = movements
    .filter(isOpen)
    .reduce<number | undefined>(
      (found, movement) => (found === undefined || movement.openedAt < found ? movement.openedAt : found),
      undefined,
    );
  const flagged = standingFigures(
    { movements, units, admissions, bedReleases, leaveBeds, now, chromeRole: "coordinator" },
    thresholds,
    network,
  ).filter((figure) => figure.flagged);
  return {
    at: formatInstant(now),
    beds: occupied.beds,
    occupancy: occupancyPercent(occupied),
    inUse: occupied.inUse,
    pulled,
    readyTotal,
    readyByService: listByService(ready),
    pending,
    confirmed,
    expected,
    heldUp,
    waiting,
    waitingByService: listByService(waiting.byService),
    longest: oldest === undefined ? null : splitDuration(Math.max(minutesUntil(now, oldest), 0)),
    flagged:
      flagged.length > 0 ? flagged.map((figure) => `${figure.value} ${figure.label.toLowerCase()}`).join(", ") : null,
  };
}

/** M121 (D-125): a group with no beds says so, never "0%". */
function occupancyLine(percent: number, inUse: number, beds: number): string {
  return beds > 0 ? `Occupancy: ${percent}% (${inUse} of ${beds} beds in use).` : `Occupancy: ${NO_BEDS_TEXT}.`;
}

function operationalMessage(id: Exclude<MessageId, "summary">, input: BedSummaryInput): Message {
  const f = operationalFigures(input);
  const readyLine = `Ready beds: ${f.readyTotal} of ${f.beds}${f.pending > 0 ? `, ${f.pending} pending preparation` : ""}.`;
  const readyByServiceLine = `Ready by service: ${f.readyByService || "none"}.`;
  const waitingLine = `Open ED movements: ${f.waiting.total}${f.waitingByService ? ` (${f.waitingByService})` : ""}.`;
  const stillLine = `Still in ED: ${f.waiting.stillInEd}. In transit or recorded departure: ${f.waiting.inTransit}.`;
  const longestLine = `Longest wait: ${f.longest ?? "none open"}.`;
  if (id === "escalation") {
    return {
      title: `Mental health bed escalation at ${f.at} AWST`,
      groups: [
        { heading: "Beds", lines: [occupancyLine(f.occupancy, f.inUse, f.beds), readyLine] },
        { heading: "ED", lines: [waitingLine, stillLine, longestLine] },
        { heading: "Flagged", lines: [`Flagged: ${f.flagged ?? "nothing"}.`] },
      ],
      foot: SYNTHETIC_FOOT,
    };
  }
  if (id === "meeting") {
    return {
      title: `Bed meeting update at ${f.at} AWST`,
      groups: [
        { heading: "Beds", lines: [readyLine, readyByServiceLine, `Pulled, awaiting arrival: ${f.pulled}.`] },
        {
          heading: "Discharges",
          lines: [`Today and tomorrow: ${f.confirmed} confirmed, ${f.expected} expected, ${f.heldUp} held up.`],
        },
        { heading: "ED", lines: [waitingLine, stillLine] },
      ],
      foot: SYNTHETIC_FOOT,
    };
  }
  return {
    title: `Mental health beds for ED at ${f.at} AWST`,
    groups: [
      {
        heading: "Beds",
        lines: [readyByServiceLine, ...(f.pending > 0 ? [`Pending preparation: ${f.pending}.`] : [])],
      },
      { heading: "ED", lines: [waitingLine, stillLine, longestLine] },
    ],
    foot: SYNTHETIC_FOOT,
  };
}

type ExecutiveReport = NonNullable<ReturnType<typeof useExecutiveStatistics>>;

/** The executive desk reads its released report only, so its small numbers stay hidden. */
function executiveMessage(id: MessageId, report: ExecutiveReport): Message {
  const { network } = report;
  const scope = network.scope.kind === "service" ? network.scope.service : "Whole network";
  const services = report.services.filter(
    (service) => network.scope.kind === "statewide" || service.service === network.scope.service,
  );
  if (id === "summary") {
    // Today's executive bed summary, word for word (the sheet's ExecutiveBedSummary).
    const preparing = (beds: { beingMadeReady: number }) =>
      beds.beingMadeReady > 0
        ? ` (${beds.beingMadeReady} of the ready ${beds.beingMadeReady === 1 ? "bed is" : "beds are"} still being made ready)`
        : "";
    return {
      title: `${scope} · synthetic prototype`,
      groups: [
        {
          heading: "Beds",
          lines: [
            `${network.beds.ready} beds ready${preparing(network.beds)}, ${network.beds.occupied} occupied, ${network.beds.pulled} pulled.`,
          ],
        },
        {
          heading: "By service",
          lines: services.map(
            (service) =>
              `${service.service}: ${service.beds.ready} beds ready${preparing(service.beds)}, ${releasedCountText(service.waiting)} waiting in ED`,
          ),
        },
      ],
      foot: "",
    };
  }
  // The released report's own clock is the executive desk's present, so its time is today's.
  const now = network.asAt.now;
  const at = formatInstant(now);
  const pending = report.capacity.pendingPreparation;
  const readyLine = `Ready beds: ${network.beds.ready} of ${network.beds.total}${pending > 0 ? `, ${pending} pending preparation` : ""}.`;
  // No typed hour window here: a wait threshold needs a named source (invented-figures guard).
  const waitingLines = [`Waiting in ED: ${releasedCountText(network.people.waitingInEd)}.`];
  const byService = services.map(
    (service) =>
      `${service.service}: ${service.beds.ready} ready, ${releasedCountText(service.waiting)} waiting in ED.`,
  );
  if (id === "escalation") {
    const occupancy = occupancyPercent({ beds: network.beds.total, inUse: network.beds.inUse });
    const occupancyLineText = occupancyLine(occupancy, network.beds.inUse, network.beds.total);
    return {
      title: `${scope} bed escalation at ${at} AWST`,
      groups: [
        {
          heading: "Beds",
          lines: [occupancyLineText, readyLine],
        },
        { heading: "ED", lines: waitingLines },
      ],
      foot: SYNTHETIC_FOOT,
    };
  }
  if (id === "meeting") {
    return {
      title: `${scope} bed meeting update at ${at} AWST`,
      groups: [
        { heading: "Beds", lines: [readyLine, `Pulled, awaiting arrival: ${network.beds.pulled}.`] },
        { heading: "By service", lines: byService },
      ],
      foot: SYNTHETIC_FOOT,
    };
  }
  return {
    title: `${scope} beds for ED at ${at} AWST`,
    groups: [
      { heading: "By service", lines: byService },
      { heading: "ED", lines: waitingLines },
    ],
    foot: SYNTHETIC_FOOT,
  };
}

/** A figure with its unit (85%, 13h 05m, 2d 4h). Times of day stay in the words. */
const FIGURE = /(?<![\d:])(\d+(?:%|d|h|m)?(?: \d+(?:h|m))?)(?![\d:])/g;

/** One line of the preview: its label quiet, its figures bold in mono, the words as copied. */
function PreviewLine({ line, heading }: { line: string; heading: string }) {
  const colon = line.indexOf(": ");
  const found = colon > 0 && colon < 40 ? line.slice(0, colon) : null;
  // A label that only repeats its heading ("Flagged" under FLAGGED) is not drawn twice.
  const label = found && found.toLowerCase() !== heading.toLowerCase() ? found : null;
  const parts = (found ? line.slice(colon + 2) : line).split(FIGURE);
  return (
    <p className={styles.line}>
      {label ? <span className={styles.label}>{`${label}: `}</span> : null}
      <span className={styles.value}>
        {parts.map((part, index) =>
          index % 2 === 1 ? (
            <strong key={index} className={styles.figure}>
              {part}
            </strong>
          ) : (
            <Fragment key={index}>{part}</Fragment>
          ),
        )}
      </span>
    </p>
  );
}

function MessagesView({
  message,
  choice,
  onChoice,
}: {
  message: Message;
  choice: MessageId;
  onChoice: (id: MessageId) => void;
}) {
  const text = plainText(message);
  const [status, setStatus] = useReducer(
    (previous: { text: string; revision: number }, next: string) => ({ text: next, revision: previous.revision + 1 }),
    { text: "", revision: 0 },
  );
  return (
    <div className={styles.tool} data-testid="ward-tools-messages">
      <div className={styles.choose}>
        <Segmented
          items={MESSAGE_ITEMS}
          value={choice}
          onChange={(id) => {
            onChoice(id);
            setStatus("");
          }}
          label="Message"
          className={styles.segmented}
        />
        <p className={styles.forWho}>{MESSAGE_FOR[choice]}</p>
      </div>
      <article className={styles.preview} aria-label="Message preview" data-testid="ward-tools-messages-preview">
        <h3 className={styles.title}>{message.title}</h3>
        {message.groups
          .filter((group) => group.lines.length > 0)
          .map((group) => (
            <section key={group.heading} className={styles.group} aria-label={group.heading}>
              <h4 className={styles.heading}>{group.heading}</h4>
              {group.lines.map((line, index) => (
                <PreviewLine key={index} line={line} heading={group.heading} />
              ))}
            </section>
          ))}
        {message.foot ? <p className={styles.foot}>{message.foot}</p> : null}
      </article>
      <div className={styles.dock}>
        <Button
          variant="pri"
          icon={ClipboardCopy}
          className={styles.copy}
          data-testid="ward-tools-messages-copy"
          onClick={async () => {
            try {
              await copyTextToClipboard(text);
              setStatus("Copied. Paste it into the email or Teams message.");
            } catch {
              setStatus("Copy is unavailable in this browser. Select the text instead.");
            }
          }}
        >
          Copy
        </Button>
        <p className={styles.status} role="status">
          <span key={status.revision}>{status.text}</span>
        </p>
      </div>
    </div>
  );
}

function OperationalMessages() {
  const { units, admissions, movements, referrals, bedReleases, leaveBeds } = useWardFlowSelect(
    "units",
    "admissions",
    "movements",
    "referrals",
    "bedReleases",
    "leaveBeds",
  );
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const [choice, setChoice] = useState<MessageId>("summary");
  const input: BedSummaryInput = {
    units,
    admissions,
    movements,
    referrals,
    bedReleases,
    leaveBeds,
    now,
    thresholds,
    network,
  };
  const message = choice === "summary" ? summaryMessage(bedSummaryText(input)) : operationalMessage(choice, input);
  return <MessagesView message={message} choice={choice} onChoice={setChoice} />;
}

function ExecutiveMessages() {
  const report = useExecutiveStatistics();
  const [choice, setChoice] = useState<MessageId>("summary");
  if (!report) return <p role="status">Messages are unavailable until this report is ready.</p>;
  return <MessagesView message={executiveMessage(choice, report)} choice={choice} onChoice={setChoice} />;
}

export function ToolMessages({ onNavigate }: { onNavigate: () => void }) {
  void onNavigate;
  return useExecutiveStatisticsControl().executive ? <ExecutiveMessages /> : <OperationalMessages />;
}
