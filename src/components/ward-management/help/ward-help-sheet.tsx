"use client";

import { CircleHelp, Keyboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";

import { WardHelpAsk } from "./ward-help-ask";
import { WardHelpSearch } from "./ward-help-search";
import { ADMIN_SETTINGS_HELP, glossaryForSites, screenHelpFor } from "./ward-help-content";
import { useWardNetwork } from "../ward-flow-provider";
import type { HelpView } from "./ward-help-events";
import { PointCard, WardHelpTasks } from "./ward-help-task-list";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "./ward-help-guide";
import { helpDeskLabel } from "./ward-help-roles";
import { useTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { WHATS_NEW } from "./ward-whats-new";
import styles from "./ward-help-sheet.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";

import { WardHelpGlossary } from "../help-content/ward-help-glossary-view";
import { WardHelpReference } from "../help-content/ward-help-reference-view";

type HelpTab = "tasks" | "glossary" | "new";

/**
 * Three sections (Josh, 31 Oct 2026): How do I… (with this screen and the desk folded in), Words
 * (the glossary, colour code and reference) and What's new. Older ways in still arrive: "screen"
 * and "desk" open How do I…, "glossary" opens Words.
 */
const VIEWS: readonly { id: HelpTab; label: string }[] = [
  { id: "tasks", label: "How do I…" },
  { id: "glossary", label: "Words" },
  { id: "new", label: "What's new" },
];

function tabFor(view: HelpView): HelpTab {
  return view === "glossary" || view === "new" ? view : "tasks";
}

/** "25 Oct" from "2026-10-25", without the time zone shifts a Date would bring. */
function formatNewDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[(month ?? 1) - 1] ?? ""}`.trim();
}

/**
 * HELP: the desk's tasks, what this screen is for, the words the app uses and what changed, in one
 * sheet (fix plan item 12; desk guide 24 Oct 2026; Josh 31 Oct 2026: opens on How do I…, one search
 * box, three sections, only what this login can use). The tour runs over the screen itself
 * (`ward-tour.tsx`) and starts only when chosen. Nothing typed here is saved.
 */
type WardHelpSheetProps = {
  view: HelpView;
  /** A how-to to open in How do I… on arrival (Show me's Back to Help). */
  task?: string;
  ask?: string;
  /** Show me plays (the help-ask flag); without it a task offers its answer and Go there only. */
  showMeOn?: boolean;
  onView: (view: HelpView) => void;
  onClose: () => void;
  /** Keyboard shortcuts at the foot of every view opens the shortcuts sheet in Help's place. */
  onShortcuts?: () => void;
};
const BASE_GLOSSARY = glossaryForSites([]);
export function WardHelpSheet(props: WardHelpSheetProps) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveHelpSheet {...props} />
  ) : (
    <OperationalHelpSheet {...props} />
  );
}
function ExecutiveHelpSheet(props: WardHelpSheetProps) {
  const report = useExecutiveStatistics();
  const terms = useMemo(
    () =>
      [
        ...BASE_GLOSSARY,
        ...(report?.catalogue.sites.map((site) => ({ term: site.code, meaning: site.name })) ?? []),
      ].toSorted((a, b) => a.term.localeCompare(b.term, "en-AU")),
    [report],
  );
  return <WardHelpSheetView {...props} termsSource={terms} />;
}
function OperationalHelpSheet(props: WardHelpSheetProps) {
  const { sites } = useWardNetwork();
  return <WardHelpSheetView {...props} termsSource={glossaryForSites(sites)} />;
}
function WardHelpSheetView({
  view,
  task,
  ask,
  showMeOn = false,
  onView,
  onClose,
  onShortcuts,
  termsSource,
}: WardHelpSheetProps & { termsSource: ReturnType<typeof glossaryForSites> }) {
  const pathname = usePathname() ?? "";
  const role = useTourRole();
  const guide = DESK_GUIDES[role];
  const { home, deskHome } = useTourFacts(role);
  // Home's address prefixes every page, so it matches only itself: Settings must not show Home's help.
  const entries = useMemo(() => railEntries(), []);
  const help = useMemo(() => {
    const shown = screenHelpFor(
      pathname,
      entries.filter((entry) => entry.href !== WARD_HOME_HREF || pathname === WARD_HOME_HREF),
      role === "admin" ? undefined : role,
    );
    return role === "admin" && shown?.id === "settings" ? ADMIN_SETTINGS_HELP : shown;
  }, [entries, pathname, role]);
  const phone = useIsPhone();
  const tab = tabFor(view);
  const asked = ask?.trim() ? ask : undefined;

  const latest = WHATS_NEW.at(-1);
  const deskHref = deskHome ?? home;
  // Settings' "Open Help" asks for the desk: How do I… with About your desk open and in view.
  useEffect(() => {
    if (view === "desk") document.getElementById("ward-help-desk")?.scrollIntoView?.({ block: "start" });
  }, [view]);

  return (
    <Sheet
      id="ward-help-sheet"
      testId="ward-help-sheet"
      open
      onClose={onClose}
      title="Help"
      headerLeading={
        <span className={barStyles.drawerTile} aria-hidden="true">
          <CircleHelp aria-hidden="true" className={barStyles.drawerHeadingIcon} strokeWidth={1.75} />
        </span>
      }
      headerActions={
        phone ? undefined : (
          <kbd className={barStyles.escKbd} aria-hidden="true">
            Esc
          </kbd>
        )
      }
      descriptionContent={
        <p className={styles.context} data-testid="ward-help-context">
          {helpDeskLabel(role)}
          {help ? ` · this screen: ${help.title}` : ""}
        </p>
      }
      placement="right"
      desktopBackdropClassName={barStyles.drawerBackdrop}
      contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetWide}`}
      headerClassName={barStyles.drawerHeader}
      titleClassName={barStyles.drawerTitle}
      closeButtonClassName={barStyles.drawerClose}
      bodyClassName={`${barStyles.drawerBody} ${styles.body}`}
      footer={
        <div className={barStyles.drawerFoot}>
          {/* The sheet's one synthetic line (Josh, 31 Oct 2026). */}
          <span data-testid="ward-help-synthetic">Synthetic prototype, not for clinical use</span>
          {/* Round 2 (#1118): the date opens What's new, so it does something rather than repeat that
              tab. A phone has room for one line only, and What's new is a tab at the top. */}
          {latest && tab !== "new" && !phone ? (
            <button
              type="button"
              className={styles.footLink}
              onClick={() => onView("new")}
              data-testid="ward-help-foot-new"
            >
              What&rsquo;s new {formatNewDate(latest.date)}
            </button>
          ) : null}
        </div>
      }
      footerClassName={barStyles.drawerFooter}
    >
      {/* One search box (Josh, 31 Oct 2026). A question handed over from the header search fills the
          Ask box, which then stands in for the search field rather than adding a second box. */}
      <div className={styles.searchDock}>
        {asked ? (
          <WardHelpAsk role={role} home={deskHref} initialQuery={asked} onClose={onClose} termsSource={termsSource} />
        ) : (
          <WardHelpSearch role={role} home={deskHref} onNavigate={onClose} />
        )}
      </div>

      <div className={`${barStyles.segTrack} ${styles.views}`} role="group" aria-label="Help sections">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={barStyles.segBtn}
            aria-pressed={tab === item.id}
            onClick={() => onView(item.id)}
            data-testid={`ward-help-view-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "tasks" ? (
        <>
          <WardHelpTasks
            key={task ?? ""}
            role={role}
            home={deskHref}
            pathname={pathname}
            onClose={onClose}
            showMeOn={showMeOn}
            openTask={task}
            screen={help}
            onTour={() => onView("tour")}
          />
          <details
            id="ward-help-desk"
            className={styles.referenceSection}
            open={view === "desk" ? true : undefined}
            data-testid="ward-help-desk"
          >
            <summary>About your desk: {helpDeskLabel(role)}</summary>
            <div className={styles.stack}>
              <p className={styles.text}>{guide.summary}</p>
              <p className={styles.text}>{guide.startsAt}</p>
              <h4 className={styles.groupHeading}>Good to know</h4>
              <PointCard points={guide.limits} />
              <h4 className={styles.groupHeading}>Is it saved?</h4>
              <PointCard points={SAVED_OR_NOT} />
              <h4 className={styles.groupHeading}>If Ward Flow is down</h4>
              <PointCard points={WHEN_IT_IS_DOWN} testId="ward-help-downtime" />
            </div>
          </details>
        </>
      ) : null}

      {tab === "new" ? (
        <section className={styles.group} aria-labelledby="ward-help-new-title" data-testid="ward-help-new">
          <h3 id="ward-help-new-title" className={styles.groupHeading}>
            Recent changes
          </h3>
          <ul className={styles.card}>
            {WHATS_NEW.toReversed().map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.date}>{formatNewDate(entry.date)}</span>
                <span className={styles.text}>{entry.line}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>Newest first. The live site updates once a day, early in the morning.</p>
        </section>
      ) : null}

      {tab === "glossary" ? (
        <>
          <WardHelpGlossary termsSource={termsSource} />
          <WardHelpReference role={role} onClose={onClose} />
        </>
      ) : null}

      {/* The shortcuts sheet is the one list of keys, filtered by desk. A phone has no keyboard, so
          it is not offered the shortcuts (HF-14). */}
      {phone || !onShortcuts ? null : (
        <div className={styles.endRow} data-testid="ward-help-end">
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onShortcuts}
            data-testid="ward-help-shortcuts"
          >
            <Keyboard aria-hidden="true" strokeWidth={1.75} />
            Keyboard shortcuts
          </button>
        </div>
      )}
    </Sheet>
  );
}
