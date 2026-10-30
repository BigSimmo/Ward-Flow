"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Children, type ReactNode, useEffect, useRef, useState, useReducer } from "react";
import {
  ArrowUpRight,
  BarChart3,
  BedDouble,
  BedSingle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  FileClock,
  FileText,
  FlaskConical,
  Inbox,
  Map as MapIcon,
  MapPinned,
  Phone,
  Plus,
  Printer,
  Scale,
  Search,
  type LucideIcon,
} from "lucide-react";

import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { WardRoleSwitcher } from "@/components/ward-management/ward-public-role-switcher";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF } from "@/components/ward-management/reports/report-routes";
import { handoverHref } from "@/components/ward-management/shell/ward-facade";
import { useAccessNavFilter, useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { WardBedFinder } from "@/components/ward-management/tools/ward-bed-finder";
import { WardToolsContacts } from "@/components/ward-management/tools/ward-tools-contacts";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFormTimes } from "@/components/ward-management/tools/ward-form-times";
import { NetworkFigures } from "@/components/ward-management/tools/ward-network-figures";
import styles from "@/components/ward-management/tools/ward-tools-sheet.module.css";
import local from "@/components/ward-redesign/pop-tools/tools.module.css";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { releasedCountText } from "@/components/ward-management/statistics/statistics-small-numbers";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";

const WardCatchmentResolver = dynamic(
  withLoadRetry(
    () => import("@/components/ward-management/tools/ward-catchment-resolver").then((m) => m.WardCatchmentResolver),
    "Catchment lookup did not load",
  ),
  { ssr: false },
);

// The synthetic hospital feed inbox (fix plan item 5) loads only when its row is opened.
const WardFeedInbox = dynamic(
  () => import("@/components/ward-management/tools/ward-feed-inbox").then((m) => m.WardFeedInbox),
  { ssr: false },
);

const root = "/ward-flow";

export type ToolsSheetToolId =
  "figures" | "update-bed" | "bed-finder" | "catchment" | "contacts" | "form-times" | "bed-summary" | "demo" | "feed";

export type WardToolsSheetProps = {
  isPhone: boolean;
  /** Who the screen is showing, in words ("Bed coordinator"). */
  roleLabel: string;
  /** Close the sheet; every link calls it as it navigates. */
  onNavigate: () => void;
  /** Opens the referral slide-out; the catchment result asks for the community destination. */
  onNewReferral: (destination?: "ward" | "community") => void;
  /** A tool to open on arrival, and a counter so the same request can be made again. */
  openRequest?: { tool: ToolsSheetToolId; seq: number };
  /** Called once the request is used, so the parent can clear it and a later open starts at the top. */
  onRequestHandled?: () => void;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  if (Children.count(children) === 0) return null;
  return (
    <section className={styles.group} aria-label={title}>
      <h3 className={styles.groupHeading}>{title}</h3>
      <div className={styles.card}>{children}</div>
    </section>
  );
}

function RowText({ icon: Icon, name, detail }: { icon: LucideIcon; name: string; detail: string }) {
  return (
    <>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon aria-hidden="true" strokeWidth={1.75} />
      </span>
      <span className={styles.rowText}>
        <strong>{name}</strong>
        <em>{detail}</em>
      </span>
    </>
  );
}

function LinkRow({
  href,
  icon,
  name,
  detail,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  name: string;
  detail: string;
  onNavigate: () => void;
}) {
  // DA-09 (design audit, 19 Oct 2026): a row is offered only to a desk that may open its page, by
  // the same role table the menu reads, so no Tools row ends at "Not part of your role".
  const canOpen = useCanOpenHref();
  if (!canOpen(href)) return null;
  return (
    <Link href={href} className={styles.row} onClick={onNavigate}>
      <RowText icon={icon} name={name} detail={detail} />
      {/* Redesign: a row that opens a page carries an arrow out; a row that opens here, a caret. */}
      <ArrowUpRight className={styles.rowChevron} aria-hidden="true" strokeWidth={1.75} />
      <span className="sr-only">, opens its page</span>
    </Link>
  );
}

/** P023: the wards a desk may open, each to its own page, under "Choose a ward". */
function UpdateBedWards({ onNavigate }: { onNavigate: () => void }) {
  const { units } = useWardFlowSelect("units");
  const canOpen = useCanOpenHref();
  const wards = units.filter((unit) => canOpen(`${root}/ward/${unit.id}`));
  return (
    <>
      <h3 id="ward-tools-update-bed-heading" className={styles.choiceLabel}>
        Choose a ward
      </h3>
      <ul className={styles.contactList} aria-labelledby="ward-tools-update-bed-heading">
        {wards.map((unit) => (
          <li key={unit.id}>
            <Link href={`${root}/ward/${unit.id}`} className={styles.matchRow} onClick={onNavigate}>
              <span>{unit.name}</span>
              <ChevronRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function ToolRow({
  id,
  icon,
  name,
  detail,
  open,
  onToggle,
  children,
  rowRef,
}: {
  id: ToolsSheetToolId;
  icon: LucideIcon;
  name: string;
  detail: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  rowRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className={styles.tool} data-open={open || undefined} ref={rowRef}>
      <button
        type="button"
        className={styles.row}
        aria-expanded={open}
        aria-controls={`ward-tools-${id}`}
        data-testid={`ward-tools-toggle-${id}`}
        onClick={onToggle}
      >
        <RowText icon={icon} name={name} detail={detail} />
        <ChevronDown className={styles.rowCaret} aria-hidden="true" strokeWidth={1.75} />
      </button>
      {open ? (
        <div id={`ward-tools-${id}`} className={styles.toolPanel}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function BedSummary() {
  return useExecutiveStatisticsControl().executive ? <ExecutiveBedSummary /> : <OperationalBedSummary />;
}
function ExecutiveBedSummary() {
  const report = useExecutiveStatistics();
  const [status, setStatus] = useState("");
  if (!report) return <p role="status">Bed summary is unavailable until this report is ready.</p>;
  // C04, the 5 Sep 2026 ruling: a ready figure says how many of those beds are still being made
  // ready, in the other screens' words. The figure itself is unchanged, and a zero says nothing.
  const preparing = (beds: { beingMadeReady: number }) =>
    beds.beingMadeReady > 0
      ? ` (${beds.beingMadeReady} of the ready ${beds.beingMadeReady === 1 ? "bed is" : "beds are"} still being made ready)`
      : "";
  const text = `${report.network.scope.kind === "service" ? report.network.scope.service : "Whole network"} · synthetic prototype\n${report.network.beds.ready} beds ready${preparing(report.network.beds)}, ${report.network.beds.occupied} occupied, ${report.network.beds.pulled} pulled.\n${report.services
    .filter((service) => report.network.scope.kind === "statewide" || service.service === report.network.scope.service)
    .map(
      (service) =>
        `${service.service}: ${service.beds.ready} beds ready${preparing(service.beds)}, ${releasedCountText(service.waiting)} waiting in ED`,
    )
    .join("\n")}`;
  return (
    <div className={styles.toolBody} data-testid="ward-tools-bed-summary">
      <pre className={styles.summaryText}>{text}</pre>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={async () => {
          try {
            await copyTextToClipboard(text);
            setStatus("Bed summary copied. Paste it into the email or Teams message.");
          } catch {
            setStatus("Copy is unavailable in this browser. Select the text instead.");
          }
        }}
      >
        Copy bed summary
      </button>
      <p className={styles.liveNote} role="status">
        {status}
      </p>
    </div>
  );
}
function OperationalBedSummary() {
  const { units, admissions, movements, bedReleases, leaveBeds } = useWardFlowSelect(
    "units",
    "admissions",
    "movements",
    "bedReleases",
    "leaveBeds",
  );
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const text = bedSummaryText({ units, admissions, movements, bedReleases, leaveBeds, now, thresholds, network });
  const [status, setStatus] = useReducer(
    (previous: { text: string; revision: number }, text: string) => ({ text, revision: previous.revision + 1 }),
    { text: "", revision: 0 },
  );
  return (
    <div className={styles.toolBody} data-testid="ward-tools-bed-summary">
      <pre className={styles.summaryText}>{text}</pre>
      <div className={styles.demoRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={async () => {
            try {
              await copyTextToClipboard(text);
              setStatus("Bed summary copied. Paste it into the email or Teams message.");
            } catch {
              setStatus("Copy is unavailable in this browser. Select the text instead.");
            }
          }}
        >
          <ClipboardCopy aria-hidden="true" strokeWidth={1.75} />
          Copy bed summary
        </button>
      </div>
      <p className={styles.liveNote} role="status">
        <span key={status.revision}>{status.text}</span>
      </p>
    </div>
  );
}

/** Redesign: one entry in a Tools group, with the words the search box matches. */
type ToolsEntry = { key: string; name: string; detail: string; href?: string; show?: boolean; node: ReactNode };

/**
 * The Tools sheet mock-up, forked from `WardToolsSheet`. Redesign (Tools review notes): three groups
 * (Do now, Look up, Print and share) under a search box, and the end of each row says what it does:
 * an arrow out opens the tool's page, a caret opens the tool here. Every tool and Change view stay.
 */
export function ToolsSheet({
  isPhone,
  roleLabel,
  onNavigate,
  onNewReferral,
  openRequest,
  onRequestHandled,
}: WardToolsSheetProps) {
  // DA-09: a ward desk updates its own ward's beds; the statewide list is not part of that desk.
  const accessNav = useAccessNavFilter();
  const updateBedHref = accessNav([{ id: "wards", href: `${root}/wards`, label: "Update a bed" }])[0]?.href;
  const canOpen = useCanOpenHref();
  const executive = useExecutiveStatisticsControl().executive;
  const canRefer = canOpen(WARD_REFERRAL_INTAKE_HREF);
  const [open, setOpen] = useState<ReadonlySet<ToolsSheetToolId>>(() => new Set());
  const [query, setQuery] = useState("");
  const rows = useRef(new Map<ToolsSheetToolId, HTMLDivElement>());
  const toggle = (id: ToolsSheetToolId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const rowRef = (id: ToolsSheetToolId) => (node: HTMLDivElement | null) => {
    if (node) rows.current.set(id, node);
    else rows.current.delete(id);
  };

  useEffect(() => {
    if (!openRequest) return;
    let scroll = 0;
    const frame = window.requestAnimationFrame(() => {
      setOpen((current) => new Set(current).add(openRequest.tool));
      scroll = window.requestAnimationFrame(() => {
        rows.current.get(openRequest.tool)?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() });
        onRequestHandled?.();
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(scroll);
    };
  }, [openRequest, onRequestHandled]);

  const tool = (id: ToolsSheetToolId, icon: LucideIcon, name: string, detail: string, body: ReactNode): ToolsEntry => ({
    key: id,
    name,
    detail,
    node: (
      <ToolRow
        key={id}
        id={id}
        icon={icon}
        name={name}
        detail={detail}
        open={open.has(id)}
        onToggle={() => toggle(id)}
        rowRef={rowRef(id)}
      >
        {body}
      </ToolRow>
    ),
  });
  const link = (href: string, icon: LucideIcon, name: string, detail: string): ToolsEntry => ({
    key: href,
    name,
    detail,
    href,
    node: <LinkRow key={href} href={href} icon={icon} name={name} detail={detail} onNavigate={onNavigate} />,
  });

  const doNow: ToolsEntry[] = [
    {
      key: "new-referral",
      name: "New referral",
      detail: "Review details and choose a destination",
      show: isPhone && canRefer,
      node: (
        <button key="new-referral" type="button" className={styles.row} onClick={() => onNewReferral()}>
          <RowText icon={Plus} name="New referral" detail="Review details and choose a destination" />
          <ArrowUpRight className={styles.rowChevron} aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only">, opens the referral form</span>
        </button>
      ),
    },
    link(`${root}/waiting`, Clock3, "Log a delay", "Choose the patient, then the reason"),
    ...(updateBedHref === `${root}/wards`
      ? [
          // P023 (Josh, 27 Oct 2026): a network desk chooses the ward here, not on the Wards list.
          tool(
            "update-bed",
            BedSingle,
            "Update a bed",
            "Open, close or hold a bed",
            <UpdateBedWards onNavigate={onNavigate} />,
          ),
        ]
      : updateBedHref
        ? [link(updateBedHref, BedSingle, "Update a bed", "Open, close or hold a bed")]
        : []),
    tool("bed-finder", BedDouble, "Find a bed", "Ready beds by ward", <WardBedFinder onNavigate={onNavigate} />),
    tool(
      "feed",
      Inbox,
      "Hospital feed",
      "Invented admissions and discharges to confirm or reject.",
      executive ? <p role="status">Individual feed records are unavailable for this desk.</p> : <WardFeedInbox />,
    ),
  ];

  const lookUp: ToolsEntry[] = [
    tool(
      "figures",
      BarChart3,
      "All figures",
      "Beds, flow and waits across the network",
      <NetworkFigures onNavigate={onNavigate} />,
    ),
    tool(
      "catchment",
      MapIcon,
      "Catchment lookup",
      "Suburb or postcode to service and clinic",
      <WardCatchmentResolver
        compact
        renderActions={(result) => {
          const clinic = contactForTeam(result.communityClinic);
          return (
            <>
              <span className={styles.clinicPhone}>
                <Phone aria-hidden="true" strokeWidth={1.75} />
                {clinic?.publishedPhone
                  ? `${result.communityClinic} clinic ${clinic.publishedPhone}, invented demo number`
                  : `${result.communityClinic} clinic number not recorded`}
              </span>
              {canRefer && (
                <button type="button" className={styles.primaryButton} onClick={() => onNewReferral("community")}>
                  Start a community referral
                </button>
              )}
            </>
          );
        }}
      />,
    ),
    tool(
      "contacts",
      Search,
      "On-call",
      "Who is on now, key lines and My list",
      <WardToolsContacts onNavigate={onNavigate} />,
    ),
    tool(
      "form-times",
      CalendarClock,
      "Form times",
      "Check a time written on a form",
      <>
        <WardFormTimes />
        {canOpen(`${root}/legal-forms`) && (
          <Link className={styles.moreLink} href={`${root}/legal-forms`} onClick={onNavigate}>
            See every open form on Legal forms
          </Link>
        )}
      </>,
    ),
    link(`${root}/legal-forms`, Scale, "Legal forms", "Every open move that carries a form"),
    { ...link(`${root}/out-of-area`, MapPinned, "Out of area", "Who is in a bed far from home"), show: isPhone },
  ];

  const printAndShare: ToolsEntry[] = [
    tool(
      "bed-summary",
      ClipboardCopy,
      "Copy bed summary",
      "Text for the executive on-call email or Teams",
      <BedSummary />,
    ),
    { ...link(handoverHref(), FileText, "Handover sheet", "Review and print the current handover"), show: isPhone },
    link(DOWNTIME_PACK_HREF, Printer, "Downtime pack", "Print a snapshot now"),
    link(PATIENT_CHRONOLOGY_HREF, FileClock, "Patient chronology", "PIR export"),
  ];

  const words = query.trim().toLowerCase();
  const visible = (entries: ToolsEntry[]) =>
    entries
      .filter((entry) => entry.show !== false && (entry.href === undefined || canOpen(entry.href)))
      .filter((entry) => !words || `${entry.name} ${entry.detail}`.toLowerCase().includes(words));
  const groups = [
    { title: "Do now", entries: visible(doNow) },
    { title: "Look up", entries: visible(lookUp) },
    { title: "Print and share", entries: visible(printAndShare) },
  ];
  const matches = groups.reduce((total, group) => total + group.entries.length, 0);

  return (
    <div className={styles.sheet} data-testid="ward-tools-sheet-v2">
      <div className={styles.viewingAs}>
        <span className={styles.viewingText}>
          <span>Viewing as</span>
          <strong>{roleLabel}</strong>
        </span>
        <WardRoleSwitcher withWords />
      </div>

      <div className={local.find}>
        <label className={`${styles.search} ${local.search}`}>
          <Search aria-hidden="true" strokeWidth={1.75} />
          <input
            type="search"
            aria-label="Search tools"
            placeholder="Search tools"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className={local.key}>
          <span>
            <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
            opens its page
          </span>
          <span>
            <ChevronDown aria-hidden="true" strokeWidth={1.75} />
            opens here
          </span>
        </p>
      </div>

      {matches === 0 ? (
        <div className={local.none} role="status">
          <p>No tool matches “{query.trim()}”.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <Group key={group.title} title={group.title}>
            {group.entries.map((entry) => entry.node)}
          </Group>
        ))
      )}

      {/* The phone has no Synthetic pill, so it keeps the Demo controls at the foot, as now. */}
      {isPhone && !words ? (
        <section className={`${styles.group} ${styles.demoGroup}`} aria-label="Demo">
          <div className={styles.card}>
            {
              tool("demo", FlaskConical, "Demo", "Scenario, clock and reset. Synthetic data only.", <WardDemoPanel />)
                .node
            }
          </div>
        </section>
      ) : null}
    </div>
  );
}
