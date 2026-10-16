"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
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
  Map as MapIcon,
  MapPinned,
  Phone,
  Plus,
  Printer,
  Scale,
  Search,
  Tv,
  type LucideIcon,
} from "lucide-react";

import { useDueSoonThresholds, useWardFlow, useWardFlowClock, useWardNetwork } from "../ward-flow-provider";
import { WardRoleSwitcher } from "../ward-role-switcher";
import { contactForTeam } from "../community/community-team-contact-mapping";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF } from "../reports/report-routes";
import { handoverHref } from "../shell/ward-facade";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { WARD_BED_MEETING_TV_HREF } from "../ward-nav";
import { bedSummaryText } from "./ward-bed-summary";
import { WardBedFinder } from "./ward-bed-finder";
import { WardToolsContacts } from "./ward-tools-contacts";
import { WardDemoPanel } from "./ward-demo-panel";
import { WardFormTimes } from "./ward-form-times";
import { NetworkFigures } from "./ward-network-figures";
import { WardServiceNow } from "./ward-service-now";
import styles from "./ward-tools-sheet.module.css";

const WardCatchmentResolver = dynamic(() => import("./ward-catchment-resolver").then((m) => m.WardCatchmentResolver), {
  ssr: false,
});

const root = "/mockups/ward-flow";

export type ToolsSheetToolId =
  "figures" | "bed-finder" | "catchment" | "contacts" | "form-times" | "bed-summary" | "demo";

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
  return (
    <Link href={href} className={styles.row} onClick={onNavigate}>
      <RowText icon={icon} name={name} detail={detail} />
      <ChevronRight className={styles.rowChevron} aria-hidden="true" strokeWidth={1.75} />
    </Link>
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
  const { units, admissions, movements, bedReleases, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const text = bedSummaryText({ units, admissions, movements, bedReleases, leaveBeds, now, thresholds, network });
  const [status, setStatus] = useState("");
  return (
    <div className={styles.toolBody} data-testid="ward-tools-bed-summary">
      <pre className={styles.summaryText}>{text}</pre>
      <div className={styles.demoRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
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
        {status}
      </p>
    </div>
  );
}

/**
 * The Tools sheet, rebuilt from the 15 Oct 2026 Tools review (`/mnt/project-files/reviews/
 * tools-sidebar-review-2026-10-15.md`): one scrolling sheet instead of five tabs. Service now (the
 * network figures at a glance, with All figures below), then Do now, Look up, Print and share, More
 * pages and Demo at the foot. Appearance, Settings, the Digest and the repeated shortcut grids are
 * gone because the rail already carries them. Phone uses the same sheet; Bed meeting TV stays
 * desktop only and shows while its `bed-meeting-tv` flag is on.
 */
export function WardToolsSheet({
  isPhone,
  roleLabel,
  onNavigate,
  onNewReferral,
  openRequest,
  onRequestHandled,
}: WardToolsSheetProps) {
  const bedMeetingTvOn = useWardFeatureFlag("bed-meeting-tv");
  const [open, setOpen] = useState<ReadonlySet<ToolsSheetToolId>>(() => new Set());
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
        rows.current.get(openRequest.tool)?.scrollIntoView({ block: "start", behavior: "smooth" });
        onRequestHandled?.();
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(scroll);
    };
  }, [openRequest, onRequestHandled]);

  const tool = (id: ToolsSheetToolId, icon: LucideIcon, name: string, detail: string, body: ReactNode) => (
    <ToolRow
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
  );

  return (
    <div className={styles.sheet} data-testid="ward-tools-sheet-v2">
      <div className={styles.viewingAs}>
        <span className={styles.viewingText}>
          <span>Viewing as</span>
          <strong>{roleLabel}</strong>
        </span>
        <span className={styles.changeView}>
          Change view
          <WardRoleSwitcher />
        </span>
      </div>

      <Group title="Service now">
        <WardServiceNow />
        {tool(
          "figures",
          BarChart3,
          "All figures",
          "Beds, flow and waits across the network",
          <NetworkFigures onNavigate={onNavigate} />,
        )}
      </Group>

      <Group title="Do now">
        <button type="button" className={styles.row} onClick={() => onNewReferral()}>
          <RowText icon={Plus} name="New referral" detail="Review details and choose a destination" />
          <ChevronRight className={styles.rowChevron} aria-hidden="true" strokeWidth={1.75} />
        </button>
        <LinkRow
          href={`${root}/delays`}
          icon={Clock3}
          name="Log a delay"
          detail="Choose the patient, then the reason"
          onNavigate={onNavigate}
        />
        <LinkRow
          href={`${root}/wards`}
          icon={BedSingle}
          name="Update a bed"
          detail="Open, close or hold a bed"
          onNavigate={onNavigate}
        />
        <LinkRow
          href={handoverHref()}
          icon={FileText}
          name="Handover sheet"
          detail="Review and print the current handover"
          onNavigate={onNavigate}
        />
        {tool(
          "bed-finder",
          BedDouble,
          "Find a bed",
          "Ready beds that fit this patient",
          <WardBedFinder onNavigate={onNavigate} />,
        )}
      </Group>

      <Group title="Look up">
        {tool(
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
                      ? `${result.communityClinic} clinic ${clinic.publishedPhone}, published number, not call-tested`
                      : `${result.communityClinic} clinic number not recorded`}
                  </span>
                  {/* Opens a community referral. The slide-out has no clinic field to prefill, so the
                      label promises only what it does. */}
                  <button type="button" className={styles.primaryButton} onClick={() => onNewReferral("community")}>
                    Start a community referral
                  </button>
                </>
              );
            }}
          />,
        )}
        {tool(
          "contacts",
          Search,
          "Contacts",
          "Who is on now, key lines and My list",
          <WardToolsContacts onNavigate={onNavigate} />,
        )}
        {tool(
          "form-times",
          CalendarClock,
          "Form times",
          "Check a time written on a form",
          <>
            <WardFormTimes />
            <Link className={styles.moreLink} href={`${root}/legal-forms`} onClick={onNavigate}>
              See every open form on Legal forms
            </Link>
          </>,
        )}
      </Group>

      <Group title="Print and share">
        {tool(
          "bed-summary",
          ClipboardCopy,
          "Copy bed summary",
          "Text for the exec on-call email or Teams",
          <BedSummary />,
        )}
        {bedMeetingTvOn && !isPhone ? (
          <LinkRow
            href={WARD_BED_MEETING_TV_HREF}
            icon={Tv}
            name="Bed meeting TV"
            detail="Read only view for the meeting room screen"
            onNavigate={onNavigate}
          />
        ) : null}
        <LinkRow
          href={DOWNTIME_PACK_HREF}
          icon={Printer}
          name="Downtime pack"
          detail="Print a snapshot now"
          onNavigate={onNavigate}
        />
        <LinkRow
          href={PATIENT_CHRONOLOGY_HREF}
          icon={FileClock}
          name="Patient chronology"
          detail="PIR export"
          onNavigate={onNavigate}
        />
      </Group>

      <Group title="More pages">
        <LinkRow
          href={`${root}/legal-forms`}
          icon={Scale}
          name="Legal forms"
          detail="Every open move that carries a form"
          onNavigate={onNavigate}
        />
        <LinkRow
          href={`${root}/out-of-area`}
          icon={MapPinned}
          name="Out of area"
          detail="Who is in a bed far from home"
          onNavigate={onNavigate}
        />
      </Group>

      <section className={`${styles.group} ${styles.demoGroup}`} aria-label="Demo">
        <div className={styles.card}>
          {tool("demo", FlaskConical, "Demo", "Scenario, clock and reset. Synthetic data only.", <WardDemoPanel />)}
        </div>
      </section>
    </div>
  );
}
