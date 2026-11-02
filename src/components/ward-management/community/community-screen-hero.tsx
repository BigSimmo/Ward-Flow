/*
 * The community team screen's desktop hero (team name, counts, tabs, team actions, figure strip
 * and the other-teams switcher), and the Switch team drawer, which both trees open.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, House, MoreHorizontal, Phone, Plus, Search } from "lucide-react";
import { Button, Hero, HeroStat, Icon, Menu, Drawer, SrOnly, TextInput } from "@/components/wf";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityTeamSuburbCounts } from "@/components/ward-management/community/community-vocabulary";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { moveBetweenWardTabs } from "@/components/ward-management/ward/ward-screen-top-bar";
import ward from "@/components/ward-management/ward/ward.module.css";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import { communityRosterCounts } from "./community-screen-panels";
import { DEMO_FIGURES } from "./team-2026/midland-demo";
import type { ActiveTabType } from "./community-screen-helpers";
import styles from "./community.module.css";
import v6 from "./community-team-v6.module.css";
import type { CommunityScreenView } from "./community-screen";

/**
 * The page's five sections, in the locked design's order (design/community-team-2026-11, Josh
 * 1 Nov 2026). Each list keeps its own panel: a section shows the panels that belong to it.
 */
export type CommunityTeamSection = "home" | "caseload" | "hospital" | "referrals" | "clinicians";

/** The list a section opens on, for the sections that hold the existing lists. */
export const SECTION_FIRST_LIST: Record<CommunityTeamSection, ActiveTabType | null> = {
  home: null,
  caseload: "tab-caseload",
  hospital: "tab-inpatients",
  referrals: "tab-triage",
  clinicians: null,
};

/** The desktop hero band (locked design, 1 Nov 2026): the caseload answer, four count chips and the at-a-glance strip. */
export function CommunityScreenDesktopHero({ view }: { view: CommunityScreenView }) {
  const {
    now,
    identityOf,
    team,
    openNewReferral,
    openTeamSection,
    switchOpen,
    setSwitchOpen,
    switchTriggerRef,
    isDemoMode,
    teamConfig,
    lists,
    waitingReferrals,
    waitingCount,
    urgentAnswerCount,
    caseloadRows,
    ownTeamOnly,
  } = view;
  const caseloadCount = isDemoMode ? teamConfig.caseload : caseloadRows.length;
  const inHospital = isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length;
  // Instants are minutes on the ward clock.
  const weekAhead = now + 7 * 24 * 60;
  const planned = lists.expectedBack.filter(
    (admission): admission is typeof admission & { expectedDischargeAt: number } =>
      admission.expectedDischargeAt !== null && admission.expectedDischargeAt >= now,
  );
  const leavingSoon = planned.filter((admission) => admission.expectedDischargeAt <= weekAhead);
  const nextHome = [...planned].sort((a, b) => a.expectedDischargeAt - b.expectedDischargeAt)[0];
  const oldest = waitingReferrals[0];
  const hours = contactForTeam(team.name)?.publishedHours ?? null;
  const roster = communityRosterCounts();
  // Midland carries the locked mock-up's demo team (Q126, Q132); its figures are stated, not derived.
  const midland = view.midlandDemo;
  const f = DEMO_FIGURES;
  const caseloadShown = midland ? f.caseload : caseloadCount;
  return (
    <div className={v6.standing}>
      <Hero
        level={1}
        eyebrow={midland ? MIDLAND_EYEBROW : `${team.name} · Community mental health`}
        title={
          <span data-testid="ward-community-hero-answer">
            {caseloadShown} on the caseload<SrOnly>, {team.name}</SrOnly>
          </span>
        }
        titleMeta={
          <>
            <span className={v6.heroSub}>
              {midland
                ? `${f.inHospital} in hospital · ${f.unallocated} waiting for a case manager`
                : `${inHospital} in hospital`}
            </span>
            {/* A community team desk opens its own team only, so it has no way across. */}
            {ownTeamOnly ? null : (
              <button
                ref={switchTriggerRef}
                type="button"
                className={v6.heroMenuButton}
                aria-haspopup="dialog"
                aria-expanded={switchOpen}
                onClick={() => setSwitchOpen(true)}
                data-testid="ward-community-switch-team"
              >
                <span>Switch team</span>
                <Icon icon={ChevronDown} size={14} />
              </button>
            )}
          </>
        }
        aside={
          <Button variant="light" size="sm" icon={Plus} id="btnMainIntake" onClick={openNewReferral}>
            Refer from team
          </Button>
        }
        bar={
          <div className={v6.heroChips}>
            <HeroStat
              inline
              command
              value={midland ? f.actNow : urgentAnswerCount}
              label="Act now"
              tone={(midland ? f.actNow : urgentAnswerCount) > 0 ? "danger" : undefined}
              onToggle={() => openTeamSection(midland ? "home" : "referrals")}
            />
            <HeroStat
              inline
              command
              value={midland ? f.referrals : waitingCount}
              label="Referrals to answer"
              tone={midland ? "neutral" : undefined}
              onToggle={() => openTeamSection("referrals")}
            />
            <HeroStat
              inline
              command
              value={midland ? f.homeIn7Days : leavingSoon.length}
              label="Leaving hospital in 7 days"
              onToggle={() => openTeamSection("hospital")}
            />
            {midland ? (
              <HeroStat
                inline
                command
                value={f.ctoReviewsDue}
                label="CTO reviews due"
                onToggle={() => openTeamSection("caseload")}
              />
            ) : null}
          </div>
        }
        barAside={
          midland ? (
            <button type="button" className={v6.heroLink} onClick={() => openTeamSection("clinicians")}>
              <b>
                {f.working} of {f.clinicians}
              </b>{" "}
              working today · Clinicians
            </button>
          ) : isDemoMode ? (
            <button type="button" className={v6.heroLink} onClick={() => openTeamSection("clinicians")}>
              <b>
                {roster.working} of {roster.total}
              </b>{" "}
              working today · Clinicians
            </button>
          ) : null
        }
        foot={
          midland ? (
            <MidlandGlance go={openTeamSection} />
          ) : (
            <div className={v6.glance} data-testid="ward-community-glance">
              <button type="button" className={v6.glanceItem} onClick={() => openTeamSection("referrals")}>
                <Icon icon={Clock} size={14} />
                <span>Oldest referral</span>
                {oldest ? (
                  <>
                    <b className={v6.glanceMono}>{referralWaitLine(oldest, now)}</b>
                    <b>{identityOf(oldest)}</b>
                  </>
                ) : (
                  <b>None waiting</b>
                )}
              </button>
              <button type="button" className={v6.glanceItem} onClick={() => openTeamSection("hospital")}>
                <Icon icon={House} size={14} />
                <span>Next home</span>
                {nextHome && nextHome.expectedDischargeAt !== null ? (
                  <b className={v6.glanceMono}>
                    {(() => {
                      // Elapsed wording, never a clock face (the page's rule).
                      const days = Math.round((nextHome.expectedDischargeAt - now) / (24 * 60));
                      return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
                    })()}
                  </b>
                ) : (
                  <b>None planned</b>
                )}
              </button>
            </div>
          )
        }
        footAside={!midland && hours ? <span>{hours}</span> : undefined}
      />
      <SrOnly>
        {ownTeamOnly
          ? "Your team's referrals and bed flow."
          : "The bed coordinator's view of this team's referrals and bed flow."}
      </SrOnly>
    </div>
  );
}

const MIDLAND_EYEBROW = "Midland · Community mental health · East Metro · Adult";

/** Midland's at-a-glance strip, as the locked mock-up states it (demo data). */
function MidlandGlance({ go }: { go: (section: CommunityTeamSection) => void }) {
  return (
    <div className={v6.glance} data-testid="ward-community-glance">
      <button type="button" className={v6.glanceItem} onClick={() => go("clinicians")}>
        <Icon icon={Phone} size={14} />
        <span>Duty officer</span>
        <b>Byrne, T.</b>
        <span className={v6.glanceMono}>ext 4105</span>
        <Icon icon={ChevronRight} size={14} />
      </button>
      <button type="button" className={v6.glanceItem} onClick={() => go("referrals")}>
        <Icon icon={Clock} size={14} />
        <span>Oldest referral</span>
        <b className={v6.glanceMono}>{DEMO_FIGURES.oldestReferral}</b>
        <b>Sallowfield, June</b>
        <span>from GP</span>
        <Icon icon={ChevronRight} size={14} />
      </button>
      <button type="button" className={v6.glanceItem} onClick={() => go("hospital")}>
        <Icon icon={House} size={14} />
        <span>Next home</span>
        <b className={v6.glanceMono}>Wed 4 Nov</b>
        <b>Greymantle, Ottoline</b>
        <span>Moodjar</span>
        <Icon icon={ChevronRight} size={14} />
      </button>
    </div>
  );
}

const SECTION_TABS: { id: CommunityTeamSection; label: string }[] = [
  { id: "home", label: "Team home" },
  { id: "caseload", label: "Caseload" },
  { id: "hospital", label: "In hospital" },
  { id: "referrals", label: "Referrals" },
  { id: "clinicians", label: "Clinicians" },
];

/** The ward page's tab row, carrying the team's five sections, with Record contact and More on the right. */
export function CommunityScreenTabRow({
  view,
  find,
}: {
  view: CommunityScreenView;
  /** The Midland team's find box; left out for teams without searchable lists. */
  find?: { value: string; set: (value: string) => void };
}) {
  const {
    teamSection,
    openTeamSection,
    isDemoMode,
    teamConfig,
    lists,
    waitingCount,
    caseloadRows,
    setActiveModalType,
    setActiveDrawer,
  } = view;
  const f = DEMO_FIGURES;
  const counts: Partial<Record<CommunityTeamSection, number>> = view.midlandDemo
    ? { caseload: f.caseload, hospital: f.inHospital, referrals: f.referrals, clinicians: f.clinicians }
    : {
        caseload: isDemoMode ? teamConfig.caseload : caseloadRows.length,
        hospital: isDemoMode ? teamConfig.inpatients : lists.currentlyAdmitted.length,
        referrals: waitingCount,
        clinicians: isDemoMode ? communityRosterCounts().total : undefined,
      };
  return (
    <nav className={`${ward.tabBarWrap} ${v6.tabRow}`} aria-label="Team sections">
      <ul className={ward.tabList} role="tablist" aria-label="Team sections" onKeyDown={moveBetweenWardTabs}>
        {SECTION_TABS.map((tab) => {
          const selected = teamSection === tab.id;
          const count = counts[tab.id];
          return (
            <li key={tab.id} role="presentation">
              <button
                type="button"
                role="tab"
                className={ward.tabBtn}
                id={`community-section-${tab.id}`}
                aria-selected={selected}
                aria-controls={`community-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => openTeamSection(tab.id)}
              >
                <span className={ward.tabLabel}>{tab.label}</span>
                {count === undefined ? null : <span className={ward.tabBadge}>{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className={ward.tabTools} role="toolbar" aria-label="Team actions">
        {find ? (
          <TextInput
            type="search"
            icon={Search}
            boxClassName={ward.findBox}
            aria-label="Find a client or clinician"
            placeholder="Find client or clinician"
            value={find.value}
            onChange={(event) => {
              find.set(event.target.value);
              if (teamSection !== "caseload" && teamSection !== "clinicians") openTeamSection("caseload");
            }}
            onClear={() => find.set("")}
            data-testid="community-find-input"
          />
        ) : null}
        <Button variant="ghost" size="sm" icon={Phone} onClick={() => setActiveModalType("contact")}>
          Record contact
        </Button>
        <Menu
          label="More team actions"
          align="end"
          items={[
            { id: "cto", label: "CTO register", onSelect: () => openTeamSection("caseload") },
            { id: "counts", label: "Catchment counts", onSelect: () => setActiveModalType("handover") },
            { id: "reach", label: "How to reach the team", onSelect: () => openTeamSection("home") },
            { id: "activity", label: "Activity sample", onSelect: () => setActiveDrawer("activityDrawer") },
            { id: "tasks", label: "Tasks sample", onSelect: () => setActiveDrawer("tasksDrawer") },
            { id: "tools", label: "Tools sample", onSelect: () => setActiveDrawer("toolsDrawer") },
          ]}
          trigger={(props) => (
            <Button {...props} variant="ghost" size="sm" icon={MoreHorizontal}>
              More
            </Button>
          )}
        />
      </div>
    </nav>
  );
}

/** The coordinator's way across to every other team (kept from the v6 page, now under the page body). */
export function CommunityOtherTeams({ view }: { view: CommunityScreenView }) {
  const { team, ownTeamOnly } = view;
  return (
    <div>
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
