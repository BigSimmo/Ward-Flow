/*
 * The community team screen's desktop hero (team name, counts, tabs, team actions, figure strip
 * and the other-teams switcher), and the Switch team drawer, which both trees open.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import Link from "next/link";
import { ChevronDown, ChevronRight, Clock, House, MapPin, Phone, Plus, Search } from "lucide-react";
import { Button, Hero, HeroStat, Icon, Drawer, SrOnly, TextInput } from "@/components/wf";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityTeamSuburbCounts } from "@/components/ward-management/community/community-vocabulary";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { moveBetweenWardTabs } from "@/components/ward-management/ward/ward-screen-top-bar";
import ward from "@/components/ward-management/ward/ward.module.css";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import { communityRosterCounts } from "./community-screen-panels";
import { DEMO_FIGURES } from "./team-2026/midland-demo";
import { useMidlandDay } from "./team-2026/use-midland-demo";
import { nextHomeWhen, type ActiveTabType } from "./community-screen-helpers";
import v6 from "./community-team-v6.module.css";
import type { CommunityScreenView } from "./community-screen";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";

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

/**
 * "Leaving hospital in 7 days": a planned date on today or one of the next six Perth calendar days,
 * so the week ends at midnight, not at this time next week, and a plan earlier today still counts
 * (time audit, 13 Nov 2026; the same window as Statistics' "Discharges due within 7 days").
 */
export function leavingHospitalSoon<T extends { expectedDischargeAt: Instant | null }>(
  admissions: readonly T[],
  now: Instant,
): T[] {
  return admissions.filter((admission) => {
    if (admission.expectedDischargeAt === null) return false;
    const offset = dayOf(admission.expectedDischargeAt) - dayOf(now);
    return offset >= 0 && offset < 7;
  });
}

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
  const planned = lists.expectedBack.filter(
    (admission): admission is typeof admission & { expectedDischargeAt: number } =>
      admission.expectedDischargeAt !== null && admission.expectedDischargeAt >= now,
  );
  const leavingSoon = leavingHospitalSoon(lists.expectedBack, now);
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
              value={waitingCount}
              label="Referrals to answer"
              // WF-01: the live waiting count, the same one the Referrals tab and menu badge read.
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
                    {/* Elapsed wording, never a clock face (the page's rule). */}
                    {nextHomeWhen(nextHome.expectedDischargeAt, now)}
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
  const day = useMidlandDay();
  return (
    <div className={v6.glance} data-testid="ward-community-glance">
      <button type="button" className={v6.glanceItem} onClick={() => go("clinicians")}>
        <Icon icon={Phone} size={14} />
        <span>Duty officer</span>
        <b>Byrne, Tom</b>
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
        <b className={v6.glanceMono}>{day("Wed 4 Nov")}</b>
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
  } = view;
  const f = DEMO_FIGURES;
  const counts: Partial<Record<CommunityTeamSection, number>> = view.midlandDemo
    ? { caseload: f.caseload, hospital: f.inHospital, referrals: waitingCount, clinicians: f.clinicians }
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
        {/* #19 (audit two, 27 Nov 2026): "CTO register" and "How to reach the team" only jumped to tabs in
            this row, so the More menu goes and its one real action is a plain button in its slot. */}
        <Button variant="ghost" size="sm" icon={MapPin} onClick={() => setActiveModalType("handover")}>
          Catchment counts
        </Button>
      </div>
    </nav>
  );
}

/** The Switch team drawer, opened from either tree. */
export function CommunityScreenSwitchDrawer({ view }: { view: CommunityScreenView }) {
  const { team, switchOpen, setSwitchOpen, switchQuery, setSwitchQuery, switchTriggerRef } = view;
  // Search audit, 8 Nov 2026: every word, folded, in any order; the counts come from one cached table.
  const switchTeams = switchQuery.trim()
    ? COMMUNITY_TEAM_PAGES.filter((other) => fieldsMatchEveryWord(switchQuery, [other.name]))
    : COMMUNITY_TEAM_PAGES;
  const suburbCounts = communityTeamSuburbCounts();
  return (
    <Drawer
      open={switchOpen}
      onClose={() => {
        setSwitchOpen(false);
        setSwitchQuery("");
      }}
      title="Switch team"
      description={`${COMMUNITY_TEAM_PAGES.length} WA community teams`}
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
        {switchTeams.length === 0 ? <p className={v6.switchMeta}>No team matches that search.</p> : null}
        <ul className={v6.switchList}>
          {switchTeams.map((other) => {
            const suburbs = suburbCounts.get(other.name);
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
