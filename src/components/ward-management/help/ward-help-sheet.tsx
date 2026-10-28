"use client";

import { ArrowRight, ChevronDown, CircleHelp, Compass, Keyboard, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { StatusGlyph, useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import { WardHelpAsk } from "./ward-help-ask";
import { WardHelpSearch } from "./ward-help-search";
import {
  ADMIN_SETTINGS_HELP,
  filterGlossary,
  glossaryForSites,
  KEYBOARD_SHORTCUTS,
  screenHelpFor,
} from "./ward-help-content";
import { useWardNetwork } from "../ward-flow-provider";
import type { HelpView } from "./ward-help-events";
import { COLOUR_LEGEND, COLOUR_LEGEND_NOTE } from "./ward-help-legend";
import { ROLE_REFERENCE } from "./ward-help-roles";
import { DESK_GUIDES, SAVED_OR_NOT, WHEN_IT_IS_DOWN } from "./ward-help-guide";
import { useTourRole, type WardTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { WHATS_NEW } from "./ward-whats-new";
import styles from "./ward-help-sheet.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";

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
  ask?: string;
  onView: (view: HelpView) => void;
  onClose: () => void;
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
  ask,
  onView,
  onClose,
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
  const [query, setQuery] = useState("");
  const terms = filterGlossary(query, termsSource);

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
          {latest ? <span>Updated {formatNewDate(latest.date)}</span> : null}
        </div>
      }
      footerClassName={barStyles.drawerFooter}
    >
      <section className={styles.desk} aria-labelledby="ward-help-intro-title" data-testid="ward-help-intro">
        <div className={styles.deskCard}>
          <div className={styles.deskText}>
            <span>Your desk</span>
            <h3 id="ward-help-intro-title">{deskLabel(role)}</h3>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onView("tour")}
            data-testid="ward-help-view-tour"
          >
            <Compass aria-hidden="true" strokeWidth={1.75} />
            Take the tour
          </button>
        </div>
        <p className={styles.note}>
          The tour starts by itself only once for each desk on this device. Open it again here or in Settings.
        </p>
      </section>

      <WardHelpSearch role={role} home={deskHome ?? home} />

      {ask !== undefined ? (
        <WardHelpAsk
          role={role}
          home={deskHome ?? home}
          initialQuery={ask}
          onClose={onClose}
          termsSource={termsSource}
        />
      ) : null}

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
            <div className={styles.card}>
              <div className={styles.screenHead}>
                <h3 id="ward-help-screen-title">{help.title}</h3>
                <p className={styles.text}>{help.purpose}</p>
              </div>
            </div>
            <PointList heading="Main actions" points={phone ? (help.phoneActions ?? help.actions) : help.actions} />
            {help.questions?.length ? (
              <div className={styles.group}>
                <h4 className={styles.groupHeading}>Questions</h4>
                <dl className={styles.card} data-testid="ward-help-questions">
                  {help.questions.map((item) => (
                    <div key={item.question} className={styles.entry}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {/* A phone has no keyboard, so its screen reader is not read a list of keys (HF-14). */}
            {phone ? null : (
              <details className={`${styles.card} ${styles.shortcuts}`} data-testid="ward-help-shortcuts">
                <summary>
                  <span className={styles.rowIcon} aria-hidden="true">
                    <Keyboard aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  Keyboard shortcuts
                  <ChevronDown aria-hidden="true" className={styles.caret} strokeWidth={1.75} />
                </summary>
                <dl className={styles.keys}>
                  {KEYBOARD_SHORTCUTS.map((item) => (
                    <div key={item.keys} className={styles.key}>
                      <dt>
                        <kbd>{item.keys}</kbd>
                      </dt>
                      <dd>{item.action}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
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

      {view === "glossary" ? (
        <section className={styles.group} aria-label="Glossary" data-testid="ward-help-glossary">
          <label htmlFor="ward-help-glossary-filter" className={styles.label}>
            Find a word or code
          </label>
          <div className={styles.searchField}>
            <Search aria-hidden="true" strokeWidth={1.75} />
            <input
              id="ward-help-glossary-filter"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              placeholder="For example Pulled, NIC or RPH"
              data-testid="ward-help-glossary-filter"
            />
          </div>
          <p className={styles.note}>{terms.length === 1 ? "1 word or code" : `${terms.length} words and codes`}</p>
          {terms.length === 0 ? (
            <p className={styles.empty}>No word or code matches. Try the first few letters.</p>
          ) : (
            <dl className={styles.card}>
              {terms.map((entry) => (
                <div key={entry.term} className={styles.entry}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className={styles.group} data-testid="ward-help-reference">
            <h3 className={styles.groupHeading}>Reference</h3>
            <h4 className={styles.groupHeading}>Colour code</h4>
            <dl className={styles.card} data-testid="ward-help-legend">
              {COLOUR_LEGEND.map((item) => (
                <div key={item.tone} className={`${styles.entry} ${styles.legendEntry}`}>
                  <dt>
                    <StatusGlyph tone={item.tone} size={12} />
                    {item.meaning}
                  </dt>
                  <dd>{item.shape}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.note}>{COLOUR_LEGEND_NOTE}</p>
            <h4 className={styles.groupHeading}>Roles</h4>
            <dl className={styles.card} data-testid="ward-help-roles">
              {ROLE_REFERENCE.map((item) => (
                <div key={item.id} className={styles.entry}>
                  <dt>{item.name}</dt>
                  <dd>{item.summary}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}
    </Sheet>
  );
}

/** A heading and a card of short points, each behind a quiet dot. */
function PointList({ heading, points, testId }: { heading: string; points: readonly string[]; testId?: string }) {
  return (
    <div className={styles.group}>
      <h4 className={styles.groupHeading}>{heading}</h4>
      <ul className={styles.card} data-testid={testId}>
        {points.map((point) => (
          <li key={point} className={styles.row}>
            <span className={styles.point} aria-hidden="true" />
            <span className={styles.text}>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
