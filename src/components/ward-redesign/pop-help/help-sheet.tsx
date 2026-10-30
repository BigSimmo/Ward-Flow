"use client";

import { ArrowRight, ChevronDown, CircleHelp, Compass, Keyboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import { HelpSearch } from "@/components/ward-redesign/pop-help/help-search";
import local from "@/components/ward-redesign/pop-help/help.module.css";
import {
  ADMIN_SETTINGS_HELP,
  glossaryForSites,
  screenHelpFor,
} from "@/components/ward-management/help/ward-help-content";
import { useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import type { HelpView } from "@/components/ward-management/help/ward-help-events";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "@/components/ward-management/help/ward-help-guide";
import { useTourRole, type WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { useTourFacts } from "@/components/ward-management/help/ward-tour-facts";
import { WHATS_NEW } from "@/components/ward-management/help/ward-whats-new";
import styles from "@/components/ward-management/help/ward-help-sheet.module.css";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";

import { WardHelpGlossary } from "@/components/ward-management/help-content/ward-help-glossary-view";
import { WardHelpReference } from "@/components/ward-management/help-content/ward-help-reference-view";

const VIEWS: readonly { id: Exclude<HelpView, "tour">; label: string }[] = [
  { id: "desk", label: "Your desk" },
  { id: "screen", label: "This screen" },
  { id: "glossary", label: "Glossary" },
  { id: "new", label: "What's new" },
];

type GoLink = { href: string; label: string };

/**
 * Where a guide job's "Go to" link leads: the desk's own home, or a rail page this desk can open.
 * A page the desk cannot open gets no link, so Help never offers a door the guard would shut.
 */
function goLink(
  go: string,
  role: WardTourRole,
  home: { href: string | undefined; name: string },
  entries: readonly { id: string; href: string; label: string }[],
): GoLink | undefined {
  if (go === "home") return home.href ? { href: home.href, label: home.name } : undefined;
  const entry = entries.find((candidate) => candidate.id === go);
  const screen = entry ? screenForPath(entry.href)?.screen : undefined;
  if (!entry || !screen || !ROLE_SCREENS[role][screen]) return undefined;
  return { href: entry.href, label: entry.label };
}

/** "25 Oct" from "2026-10-25", without the time zone shifts a Date would bring. */
function formatNewDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[(month ?? 1) - 1] ?? ""}`.trim();
}

function deskLabel(role: WardTourRole): string {
  return role === "admin" ? "Access admin" : CHROME_ROLE_LABELS[role];
}

/**
 * HELP: the desk's own guide, what this screen is for and a glossary, in one sheet (fix plan item
 * 12; desk guide 24 Oct 2026), with the way into the desk's tour, which runs over the screen itself
 * (`ward-tour.tsx`). The glossary filter is held in this component only and is never saved.
 */
type WardHelpSheetProps = {
  view: HelpView;
  onView: (view: HelpView) => void;
  onClose: () => void;
  /** Redesign: Keyboard shortcuts is a button at the end of Help; it opens the shortcuts sheet. */
  onShortcuts: () => void;
};
const BASE_GLOSSARY = glossaryForSites([]);
export function HelpSheet(props: WardHelpSheetProps) {
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

  const latest = WHATS_NEW.at(-1);

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
        <p className={barStyles.activityFreshness}>Synthetic prototype, not approved for clinical use.</p>
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
          <span>Ward Flow guide · nothing typed here is saved</span>
          {/* Mock-up: the date opens What's new, so it does something rather than repeat that tab. A
              phone has the room for one line only, and the What's new tab sits at the top. */}
          {latest && view !== "new" && !phone ? (
            <button type="button" className={local.footLink} onClick={() => onView("new")}>
              What&rsquo;s new {formatNewDate(latest.date)}
            </button>
          ) : null}
        </div>
      }
      footerClassName={barStyles.drawerFooter}
    >
      <div className={styles.searchDock}>
        <HelpSearch role={role} home={deskHome ?? home} onNavigate={onClose} />
      </div>

      <div className={`${barStyles.segTrack} ${styles.views}`} role="group" aria-label="Help sections">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={barStyles.segBtn}
            aria-pressed={view === item.id}
            onClick={() => onView(item.id)}
            data-testid={`ward-help-view-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "desk" ? (
        <section className={styles.stack} aria-labelledby="ward-help-desk-title" data-testid="ward-help-desk">
          <h3 className={local.deskName}>{deskLabel(role)}</h3>
          <p className={styles.text}>{guide.summary}</p>
          <div className={styles.group}>
            <h3 id="ward-help-desk-title" className={styles.groupHeading}>
              Where you start
            </h3>
            <div className={styles.card}>
              <p className={styles.paragraph}>{guide.startsAt}</p>
            </div>
          </div>
          <div className={styles.group}>
            <h4 className={styles.groupHeading}>Jobs you do most</h4>
            <ol className={styles.card}>
              {guide.jobs.map((item, index) => {
                const link = goLink(item.go, role, { href: deskHome ?? home, name: guide.homeName }, entries);
                return (
                  <li key={item.job} className={styles.row}>
                    <span className={styles.step} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={styles.rowText}>
                      <strong>{item.job}</strong>
                      <span>{item.how}</span>
                      {link ? (
                        <Link
                          href={link.href}
                          className={styles.goLink}
                          onClick={onClose}
                          aria-label={`${item.job}: go to ${link.label}`}
                          data-testid="ward-help-go"
                        >
                          Go to {link.label}
                          <ArrowRight aria-hidden="true" strokeWidth={2} />
                        </Link>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <PointList heading="Good to know" points={guide.limits} />
          <PointList heading="Is it saved?" points={SAVED_OR_NOT} />
          <PointList heading="If Ward Flow is down" points={WHEN_IT_IS_DOWN} testId="ward-help-downtime" />
        </section>
      ) : null}

      {view === "screen" ? (
        help ? (
          <section className={styles.stack} aria-labelledby="ward-help-screen-title" data-testid="ward-help-screen">
            {/* Mock-up: a plain heading and line, not a card, for the screen this Help is about. */}
            <div className={`${styles.screenHead} ${local.screenHead}`}>
              <h3 id="ward-help-screen-title">{help.title}</h3>
              <p className={styles.text}>{help.purpose}</p>
            </div>
            <PointList heading="Main actions" points={phone ? (help.phoneActions ?? help.actions) : help.actions} />
            {help.questions?.length ? (
              <div className={styles.group}>
                <h4 className={styles.groupHeading}>Questions</h4>
                <Questions items={help.questions} />
              </div>
            ) : null}
          </section>
        ) : (
          <div className={styles.group} data-testid="ward-help-screen-none">
            <p className={styles.empty}>This screen has no help page of its own yet. Your desk guide covers it.</p>
            <button type="button" className={styles.linkButton} onClick={() => onView("desk")}>
              Open your desk guide
            </button>
          </div>
        )
      ) : null}

      {view === "new" ? (
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

      {view === "glossary" ? <WardHelpGlossary termsSource={termsSource} /> : null}

      {/* Mock-up: Reference (colour code, roles, more) is an extra, so it moves from above the content
          to the end of every view, just before the tour and the shortcuts. */}
      <div className={local.utilityRow}>
        <WardHelpReference role={role} onClose={onClose} />
      </div>

      {/* Redesign: the tour and the shortcuts are buttons at the end of every Help view. A phone has
          no keyboard, so it is not offered the shortcuts (HF-14). */}
      <div className={local.endRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => onView("tour")}
          data-testid="ward-help-view-tour"
        >
          <Compass aria-hidden="true" strokeWidth={1.75} />
          Take the tour
        </button>
        {phone ? null : (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onShortcuts}
            data-testid="ward-help-shortcuts"
          >
            <Keyboard aria-hidden="true" strokeWidth={1.75} />
            Keyboard shortcuts
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** A heading and a card of short points. Mock-up: the row dividers part them, so no dot as well. */
function PointList({ heading, points, testId }: { heading: string; points: readonly string[]; testId?: string }) {
  return (
    <div className={styles.group}>
      <h4 className={styles.groupHeading}>{heading}</h4>
      <ul className={styles.card} data-testid={testId}>
        {points.map((point) => (
          <li key={point} className={styles.row}>
            <span className={styles.text}>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Redesign: a screen's questions, each answer folded until asked for, one open at a time. */
function Questions({ items }: { items: readonly { question: string; answer: string }[] }) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className={`${styles.card} ${local.questions}`} data-testid="ward-help-questions">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <li key={item.question} className={local.question}>
            <button
              type="button"
              className={local.questionButton}
              aria-expanded={expanded}
              aria-controls={`${id}-${index}`}
              onClick={() => setOpen(expanded ? null : index)}
            >
              <span>{item.question}</span>
              <ChevronDown aria-hidden="true" className={local.questionCaret} strokeWidth={1.75} />
            </button>
            <p id={`${id}-${index}`} className={local.answer} hidden={!expanded}>
              {item.answer}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
