/*
 * The community team screen's desktop hero (team name, counts, tabs, team actions, figure strip
 * and the other-teams switcher), and the Switch team drawer, which both trees open.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import Link from "next/link";
import { ChevronDown, FileText, Phone, Plus, Search, Users } from "lucide-react";
import { Button, CheckingFoot, Count, Hero, Icon, Menu, Drawer, Popover, SrOnly, TextInput } from "@/components/wf";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityTeamSuburbCounts } from "@/components/ward-management/community/community-vocabulary";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import styles from "./community.module.css";
import v6 from "./community-team-v6.module.css";
import { communitySearchRenderer } from "./community-screen-panels";
import type { CommunityScreenView } from "./community-screen";

/**
 * The hero's five lists, in the mockup's order. Sent comes first (D-77 group A, approved 21 Oct 2026). Ids are the panels' own. The team's own facts (how
 * to reach it, the sample deployment) are no longer a fifth tab: the v6 page keeps them in view
 * under every list, as the mockup's side column does.
 */
const TEAM_TABS = [
  { id: "tab-sent", buttonId: "tabBtn-sent", label: "Sent", section: "ward-community-sent" },
  { id: "tab-triage", buttonId: "tabBtn-triage", label: "Waiting answer", section: "ward-community-waiting" },
  { id: "tab-inpatients", buttonId: "tabBtn-inpatients", label: "In a bed", section: "ward-community-admitted" },
  { id: "tab-egress", buttonId: "tabBtn-egress", label: "Expected back", section: "ward-community-expected-back" },
  { id: "tab-caseload", buttonId: "tabBtn-caseload", label: "Caseload and CTOs", section: "section-caseload" },
] as const;

/** The desktop hero band, figure strip and other-teams switcher. */
export function CommunityScreenDesktopHero({ view }: { view: CommunityScreenView }) {
  const {
    now,
    identityOf,
    team,
    openNewReferral,
    setActiveTab,
    setActiveDrawer,
    setActiveModalType,
    switchOpen,
    setSwitchOpen,
    switchTriggerRef,
    isDemoMode,
    scrollToSection,
    teamConfig,
    lists,
    waitingReferrals,
    waitingCount,
    urgentAnswerCount,
    caseloadRows,
    inBedCount,
    bedPulledCount,
    pastPlannedDateCount,
    admittedWhileAlreadyWithTeam,
    activeTab,
    sentReferrals,
    ownTeamOnly,
  } = view;
  const renderSearch = communitySearchRenderer(view);
  return (
    <div className={v6.standing}>
      {/*
       * THE V6 HERO, 7 October 2026 — `design/pages-v6/CommunityTeam.png`. One band carries the
       * team's name with its team menu, the six counts, the four tabs and the four team actions.
       * It replaces the inner header (whose Activity, Tasks, Tools and Theme buttons repeated the
       * shell's own), the action bar and the telemetry ribbon. Every count reads the same
       * expression the ribbon and tab badges read, so no figure changed.
       */}
      <Hero
        level={1}
        eyebrow="Community team"
        title={team.name}
        titleMeta={
          <>
            <span className={v6.heroAnswer} data-testid="ward-community-hero-answer">
              <b>{isDemoMode ? teamConfig.caseload : caseloadRows.length}</b> on the caseload
            </span>
            {/* A community team desk opens its own team only, so it has no way across. */}
            {ownTeamOnly ? null : (
              <button
                ref={switchTriggerRef}
                type="button"
                className={v6.heroMenuButton}
                aria-label="Change team"
                title="Switch community team"
                aria-haspopup="dialog"
                aria-expanded={switchOpen}
                onClick={() => setSwitchOpen(true)}
                data-testid="ward-community-switch-team"
              >
                <Icon icon={ChevronDown} size={14} />
              </button>
            )}
          </>
        }
        // Device audit option A (11 Oct 2026): one switch. The tabs below the title are the
        // lists; the four hero chips that repeated them are gone.
        foot={
          <CheckingFoot
            items={[
              // A community team desk: the title already says how many are on the caseload.
              ...(ownTeamOnly
                ? []
                : [
                    {
                      id: "caseload",
                      label: "Caseload",
                      value: isDemoMode ? teamConfig.caseload : caseloadRows.length,
                    },
                  ]),
              {
                id: "urgent",
                label: "Urgent answers",
                value: urgentAnswerCount,
                tone: urgentAnswerCount > 0 ? "danger" : undefined,
              },
              ...(isDemoMode
                ? [{ id: "crisis", label: "Crisis open", value: teamConfig.crisis }]
                : [{ id: "pulled", label: "Bed pulled", value: bedPulledCount }]),
            ]}
            notChecked={isDemoMode ? [] : ["Crisis open, no record holds a team's crisis episodes"]}
          />
        }
        aside={
          <>
            <Menu
              label="Illustrative drawers"
              align="end"
              items={[
                { id: "activity", label: "Activity sample", onSelect: () => setActiveDrawer("activityDrawer") },
                { id: "tasks", label: "Tasks sample", onSelect: () => setActiveDrawer("tasksDrawer") },
                { id: "tools", label: "Tools sample", onSelect: () => setActiveDrawer("toolsDrawer") },
              ]}
              trigger={(props) => (
                <Button {...props} variant="onHero" size="sm" iconEnd={ChevronDown}>
                  Samples
                </Button>
              )}
            />
            <Popover
              label="Search sample patients"
              align="end"
              panelClassName={v6.searchPanel}
              trigger={(props) => (
                <Button
                  {...props}
                  variant="onHero"
                  size="sm"
                  iconOnly
                  icon={Search}
                  id="ward-community-search-trigger"
                  aria-label="Search sample patients by name or UMRN"
                  title="Search sample patients by name or UMRN"
                />
              )}
            >
              {renderSearch}
            </Popover>
          </>
        }
        bar={
          <div className={v6.trackScroll}>
            <div className={v6.track} role="tablist" aria-label="Community team lists">
              {TEAM_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                const count =
                  tab.id === "tab-sent"
                    ? sentReferrals.sent.length
                    : tab.id === "tab-triage"
                      ? waitingCount
                      : tab.id === "tab-inpatients"
                        ? isDemoMode
                          ? teamConfig.inpatients
                          : lists.currentlyAdmitted.length
                        : tab.id === "tab-egress"
                          ? isDemoMode
                            ? teamConfig.egress
                            : lists.expectedBack.length
                          : isDemoMode
                            ? teamConfig.caseload
                            : caseloadRows.length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={tab.buttonId}
                    aria-selected={selected}
                    aria-controls={tab.id}
                    tabIndex={selected ? 0 : -1}
                    className={v6.trackItem}
                    onClick={() => {
                      setActiveTab(tab.id);
                      scrollToSection(tab.section);
                    }}
                    onKeyDown={(event) => {
                      const index = TEAM_TABS.findIndex((item) => item.id === tab.id);
                      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                      if (step === 0) return;
                      event.preventDefault();
                      const next = TEAM_TABS[(index + step + TEAM_TABS.length) % TEAM_TABS.length]!;
                      setActiveTab(next.id);
                      document.getElementById(next.buttonId)?.focus();
                    }}
                  >
                    <span>{tab.label}</span>
                    <Count n={count} className={v6.trackCount} />
                  </button>
                );
              })}
            </div>
          </div>
        }
        barAside={
          <div className={v6.actions}>
            <Button variant="onHero" size="sm" icon={Phone} onClick={() => setActiveModalType("contact")}>
              Record contact
            </Button>
            <Button
              variant="onHero"
              size="sm"
              icon={FileText}
              onClick={() => {
                setActiveTab("tab-caseload");
                scrollToSection("section-caseload");
              }}
            >
              CTO register
            </Button>
            <Button variant="onHero" size="sm" icon={Users} onClick={() => setActiveModalType("handover")}>
              Catchment counts
            </Button>
            {/* New referral in the header is the page's one primary (device audit option A). */}
            <Button variant="onHero" size="sm" icon={Plus} id="btnMainIntake" onClick={openNewReferral}>
              Refer from team
            </Button>
          </div>
        }
      />
      <SrOnly>
        {ownTeamOnly
          ? "Your team's referrals and bed flow."
          : "The bed coordinator's view of this team's referrals and bed flow."}
      </SrOnly>

      {/* ── Figures across the top ── */}
      <div className={styles.legacyFigureStrip}>
        <WardFigureStrip>
          <WardFigure
            label="Waiting for an answer"
            value={`${waitingCount}`}
            sub={`referral${waitingCount === 1 ? "" : "s"} addressed to this team`}
          />
          <WardFigure
            label="Admitted while with the team"
            value={`${admittedWhileAlreadyWithTeam.length}`}
            unit={`of ${lists.currentlyAdmitted.length}`}
            sub="already accepted before the bed began"
            flagged={admittedWhileAlreadyWithTeam.length > 0}
          />
          <WardFigure
            label="In a bed or with one pulled"
            value={`${lists.currentlyAdmitted.length}`}
            sub={`${inBedCount} in the bed · ${bedPulledCount} bed pulled`}
          />
          <WardFigure
            label="Expected back"
            value={`${lists.expectedBack.length}`}
            unit={`of ${lists.currentlyAdmitted.length}`}
            sub={`${pastPlannedDateCount} planned date${pastPlannedDateCount === 1 ? "" : "s"} already passed`}
          />
          <WardFigure
            label="Discharged into the catchment"
            value={`${lists.dischargedIntoTheArea.length}`}
            sub="recorded as discharged to the community"
          />
          <WardFigure
            label="Longest wait"
            value={waitingReferrals.length === 0 ? "None waiting" : referralWaitLine(waitingReferrals[0], now)}
            sub={waitingReferrals.length === 0 ? undefined : `${identityOf(waitingReferrals[0])} · since it was raised`}
          />
        </WardFigureStrip>
      </div>

      {/* A community team desk opens its own team only, so it has no way across. */}
      {ownTeamOnly ? null : (
        <>
          {/*
           * Every other team, whatever the catchment source turns out to name. A builder over
           * `COMMUNITY_TEAM_PAGES` rather than a hand-written list, for the same reason that array is
           * derived: a further team must reach this navigation by appearing in the catchment source
           * and by nothing else.
           *
           * ⚠️ **THIS SWITCHER IS NOT THE WAY IN. IT IS THE WAY ACROSS — AND THERE IS NOW A WAY IN.**
           * `/ward-flow/community` (`community-index.tsx`) is the front door: it lists every
           * team a referral can name, alphabetically, links each one, and `ward-nav.ts` carries it as
           * the `community` entry so the index is itself reachable from the rail. So a reader who is
           * not already on a team page reaches any team in two clicks, and this switcher is the
           * convenience for a reader who is.
           *
           * ⚠️ **`tests/ward-nav.test.ts` STILL RECORDS NOUGHT REACHABLE INSTANCES FOR THIS ROUTE,
           * AND THAT FIGURE NO LONGER MEANS WHAT IT SAYS ON ITS FACE.** Read the entry, not the
           * number — and note that the count of the full set is deliberately not repeated here, for
           * the reason the paragraph below gives. It now records a limit of a SOURCE SCAN, not a gap in the navigation: the index
           * builds its hrefs inside a `.map()` via `communityTeamHref`, and that scan counts a built
           * site as nought concrete instances **by design**, because reading a builder as
           * reachability is the defect class the guard exists to catch. Teaching it to count this one
           * would loosen it. What the index really covers is established by rendering it and reading
           * the links back out of the markup — `tests/ward-community-index.dom.test.tsx` pins the
           * linked set against `COMMUNITY_TEAM_PAGES` exactly and goes red on a single missing team.
           *
           * ⚠️ **THIS PARAGRAPH HAS NOW BEEN WRONG IN BOTH DIRECTIONS, WHICH IS THE POINT.** Until
           * 2026-09-01 it claimed the rail already carried a worked instance of this route — the
           * shape of `board/[unitId]`'s entry in that same test, not of this one. It was corrected to
           * say the route was an orphan reachable only by typing a URL, which was true for about an
           * hour, until `/community` landed in the merge that same evening. **A sentence describing
           * an absence is a sentence with a short shelf life**, because the absence is usually
           * somebody's next task. Cite the entry and its reasoning, never the bare figure: an
           * unchanged number whose meaning inverted is the one a careless check waves through.
           *
           * ⚠️ **AND NO COUNT OF THE TEAMS IS WRITTEN HERE.** This paragraph carried two of them — a
           * count of the other teams, and a count of the pages this switcher reaches — and both were
           * residue from the region era, when membership came from `ward-teams.ts`'s
           * `COMMUNITY_TEAMS`, a `Record<HomeRegion, string>` this hub deliberately does not read.
           * The real size is a property of the extracted catchment table, so a figure typed here has
           * no guard and goes stale the moment that source changes; the retired figures are not
           * repeated even as history, because a phrase written down is a phrase that can be copied
           * back. The list renders from the derivation; the prose describes the set.
           *
           * ⚠️ **KEPT AS ONE COMMENT WITH THE NOTE BELOW, DELIBERATELY.** `tests/ward-community-corrected-
           * claims.test.ts` locates "the switcher's own comment" by walking backward from the `<nav>`
           * to the nearest comment-close and comment-open marker pair, so a second, separate comment
           * landing between this one and the element it scans for would be captured INSTEAD of this
           * one — silently shrinking the region every absence pin below is checked against. A
           * `<nav>`, not a `WardPanel` — the
           * landmark role is what makes this switcher findable by `getByRole("navigation", ...)`, and
           * `WardPanel` renders a `<section>`. `composes` borrows the primitive's own header classes
           * instead, so the chrome matches every other panel on this page exactly rather than
           * approximately.
           */}
          <nav className={styles.teamSwitcher} aria-label="Other community teams">
            <details className={`${styles.teamDisclosure} source-print`}>
              <summary className={styles.teamSwitcherHeader}>
                <span className={styles.teamSwitcherTitle}>Change team</span>
                <span className={styles.switchCount}>{COMMUNITY_TEAM_PAGES.length - 1} other teams</span>
              </summary>
              <div className={styles.teamPopover}>
                <div className={styles.teamPopoverHeader}>
                  <span>Select team</span>
                  <span className={styles.teamPopoverMeta}>{COMMUNITY_TEAM_PAGES.length - 1} other catchments</span>
                </div>
                <ul className={styles.teamList}>
                  {COMMUNITY_TEAM_PAGES.filter((other) => other.id !== team.id).map((other) => {
                    const suburbs = communityTeamSuburbCounts().get(other.name);
                    return (
                      <li key={other.id} className={styles.teamListItem}>
                        <Link className={styles.teamLink} href={communityTeamHref(other)}>
                          <span className={styles.teamLinkName}>{other.name}</span>
                          {suburbs ? (
                            <span className={styles.teamLinkMeta}>
                              {suburbs} {suburbs === 1 ? "suburb" : "suburbs"}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </nav>
        </>
      )}
    </div>
  );
}

/** The Switch team drawer, opened from either tree. */
export function CommunityScreenSwitchDrawer({ view }: { view: CommunityScreenView }) {
  const { team, switchOpen, setSwitchOpen, switchQuery, setSwitchQuery, switchTriggerRef } = view;
  return (
    <Drawer
      open={switchOpen}
      onClose={() => {
        setSwitchOpen(false);
        setSwitchQuery("");
      }}
      title="Switch team"
      description={`${COMMUNITY_TEAM_PAGES.length} WA community mental health teams`}
      returnFocusRef={switchTriggerRef}
      testId="ward-community-switch-drawer"
    >
      <div className={v6.switchBody}>
        <TextInput
          type="search"
          icon={Search}
          aria-label="Find a team"
          placeholder="Find a team"
          value={switchQuery}
          onChange={(event) => setSwitchQuery(event.target.value)}
          onClear={() => setSwitchQuery("")}
          autoComplete="off"
          data-sheet-autofocus
        />
        <ul className={v6.switchList}>
          {COMMUNITY_TEAM_PAGES.filter((other) =>
            other.name.toLowerCase().includes(switchQuery.trim().toLowerCase()),
          ).map((other) => {
            const suburbs = communityTeamSuburbCounts().get(other.name);
            return (
              <li key={other.id}>
                <Link
                  className={v6.switchItem}
                  href={communityTeamHref(other)}
                  aria-current={other.id === team.id ? "page" : undefined}
                  onClick={() => setSwitchOpen(false)}
                >
                  <span className={v6.switchName}>{other.name}</span>
                  <span className={v6.switchMeta}>
                    {other.id === team.id
                      ? "This team"
                      : suburbs
                        ? `${suburbs} ${suburbs === 1 ? "suburb" : "suburbs"}`
                        : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}
