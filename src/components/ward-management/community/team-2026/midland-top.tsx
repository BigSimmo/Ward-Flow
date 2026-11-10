"use client";

/*
 * Midland's page top (Josh, 9 Nov 2026), on every size: the team's name, three caseload figures,
 * the act-now row, the team's own actions as chips, the week ahead as one slim band, and the
 * five sections as folder tabs (phone and tablet) or underline tabs (desktop). Midland demo data
 * (Q126, Q132): the figures are the demo's stated figures, as the old hero showed them.
 */

import type { ReactNode, RefObject } from "react";
import { ClipboardList, Ellipsis, Phone, Search, Send, Users } from "lucide-react";

import {
  FolderTabs,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  Menu,
  Segmented,
  SrOnly,
  Tabs,
  TextInput,
  buttonClass,
  cx,
  folderTabClasses,
  heroChipClassName,
  type HeroChipItem,
} from "@/components/wf";
import topTitle from "@/components/ward-management/shell/page-top-title.module.css";
import ward from "@/components/ward-management/ward/ward.module.css";
import type { CommunityTeamSection } from "../community-screen-hero";
import { DEMO_FIGURES as f } from "./midland-demo";
import { useMidlandDemo } from "./use-midland-demo";
import top from "./midland-top.module.css";

const SECTIONS: { id: CommunityTeamSection; label: string }[] = [
  { id: "home", label: "Team home" },
  { id: "caseload", label: "Caseload" },
  { id: "hospital", label: "In hospital" },
  { id: "referrals", label: "Referrals" },
  { id: "clinicians", label: "Clinicians" },
];

/** A phone shows these sections as tabs, and the one open; the rest are under More. */
const PHONE_SECTIONS: CommunityTeamSection[] = ["home", "caseload", "hospital"];

export type MidlandTopProps = {
  isPhone: boolean;
  section: CommunityTeamSection;
  open: (section: CommunityTeamSection) => void;
  /** The open referrals the team has still to answer. */
  toAnswer: number;
  onRecordContact: () => void;
  onReferFromTeam: () => void;
  /** Opens Switch team; absent for a desk that sees its own team only. */
  onSwitchTeam?: () => void;
  /** Whether the Switch team drawer is open (`aria-expanded`). */
  switchOpen?: boolean;
  /** The Switch team chip, for the drawer to hand focus back to. */
  switchTriggerRef?: RefObject<HTMLButtonElement | null>;
  /** Desktop: the find box for clients and clinicians, kept in the tab row. */
  find?: { value: string; set: (value: string) => void };
  /** Desktop: the team's other actions, under More. */
  moreItems?: { id: string; label: string; onSelect: () => void }[];
  /** The board's time for the Live pill ("Demo 10:42"). */
  age?: string;
};

export function MidlandTop({
  isPhone,
  section,
  open,
  toAnswer,
  onRecordContact,
  onReferFromTeam,
  onSwitchTeam,
  switchOpen = false,
  switchTriggerRef,
  find,
  moreItems = [],
  age,
}: MidlandTopProps) {
  const { STAFF } = useMidlandDemo();
  const duty = STAFF.find((member) => member.today === "duty");
  const counts: Partial<Record<CommunityTeamSection, number>> = {
    home: f.actNow,
    caseload: f.caseload,
    hospital: f.inHospital,
    referrals: toAnswer,
    clinicians: f.clinicians,
  };
  const chips: HeroChipItem[] = [
    {
      id: "contact",
      label: "Record contact",
      icon: <ClipboardList strokeWidth={1.75} aria-hidden="true" />,
      onClick: onRecordContact,
      testId: "community-top-record-contact",
    },
    ...(duty
      ? [
          {
            id: "duty",
            label: `Duty: ${duty.name}`,
            icon: <Phone strokeWidth={1.75} aria-hidden="true" />,
            onClick: () => open("clinicians"),
            testId: "community-top-duty",
          },
        ]
      : []),
    {
      id: "refer",
      label: "Refer from team",
      icon: <Send strokeWidth={1.75} aria-hidden="true" />,
      onClick: onReferFromTeam,
    },
    ...(onSwitchTeam
      ? [
          {
            id: "switch",
            label: "Switch team",
            node: (
              <button
                ref={switchTriggerRef}
                type="button"
                className={heroChipClassName}
                aria-haspopup="dialog"
                aria-expanded={switchOpen}
                onClick={onSwitchTeam}
                data-testid="ward-community-switch-team"
              >
                <Users size={16} strokeWidth={1.75} aria-hidden="true" />
                Switch team
              </button>
            ),
          },
        ]
      : []),
  ];

  const shown = isPhone ? SECTIONS.filter((item) => PHONE_SECTIONS.includes(item.id) || item.id === section) : SECTIONS;
  const rest = SECTIONS.filter((item) => !shown.includes(item));
  const menuItems = [
    ...rest.map((item) => ({
      id: item.id,
      label: counts[item.id] === undefined ? item.label : `${item.label} ${counts[item.id]}`,
      onSelect: () => open(item.id),
    })),
    ...(isPhone ? [] : moreItems),
  ];

  const more: ReactNode = (
    <span className={top.moreRow}>
      {find ? (
        <TextInput
          type="search"
          icon={Search}
          boxClassName={cx(ward.findBox, top.find)}
          aria-label="Find a client or clinician"
          placeholder="Find client or clinician"
          value={find.value}
          onChange={(event) => {
            find.set(event.target.value);
            if (section !== "caseload" && section !== "clinicians") open("caseload");
          }}
          onClear={() => find.set("")}
          data-testid="community-find-input"
        />
      ) : null}
      {menuItems.length > 0 ? (
        <Menu
          label={isPhone ? "More team sections" : "More team actions"}
          align="end"
          items={menuItems}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className={cx(buttonClass({ variant: "ghost", size: "sm" }), folderTabClasses.more)}
              data-testid="community-top-more"
            >
              <Ellipsis size={16} strokeWidth={1.75} aria-hidden="true" />
              {isPhone ? <SrOnly>More team sections</SrOnly> : "More"}
            </button>
          )}
        />
      ) : null}
    </span>
  );

  // The act-now count is the folder's deep red circle on Team home (index 1).
  const tabItems = shown.map((item) => ({
    id: item.id,
    label: item.label,
    count: item.id === "home" || !isPhone ? counts[item.id] : undefined,
  }));

  return (
    <>
      <Hero
        level={1}
        className={cx(topTitle.hero, folderTabClasses.hero)}
        testId={isPhone ? "ward-community-phone-hero" : undefined}
        eyebrow={<SrOnly>Midland · Community mental health · East Metro · Adult</SrOnly>}
        title={
          <>
            Midland <span className={topTitle.soft}>community team</span>
          </>
        }
        aside={<LiveChip state="live" onHero age={age} />}
      >
        <HeroTop
          figures={
            <HeroFigures
              label="Team figures"
              items={[
                {
                  id: "caseload",
                  value: f.caseload,
                  label: "on the caseload",
                  testId: "ward-community-hero-answer",
                },
                { id: "hospital", value: f.inHospital, label: "in hospital" },
                { id: "unallocated", value: f.unallocated, label: "no case manager", tone: "warning" },
              ]}
            />
          }
          act={
            <HeroAct
              tone="danger"
              title={`${f.actNow} need someone today`}
              action={{
                label: "Show act now",
                phoneLabel: "Show",
                onClick: () => open("home"),
                testId: "community-top-act",
              }}
            />
          }
          chips={<HeroQuickChips label="Team actions" items={chips} />}
          band={
            <HeroBand
              title="Within 7 days"
              testId="ward-community-glance"
              aside={
                <>
                  <b>{f.working}</b> of {f.clinicians} working today
                </>
              }
              cells={[
                {
                  id: "discharges",
                  label: "Discharges",
                  value: f.homeIn7Days,
                  sub: `${f.datesPassed} dates passed`,
                  subTone: "warning",
                  onClick: () => open("hospital"),
                },
                {
                  id: "follow-up",
                  label: "Follow-up",
                  value: f.followUps,
                  // As the team home's Follow-up tile states it (demo data).
                  sub: "1 due today",
                  subTone: "danger",
                  onClick: () => open("hospital"),
                },
                { id: "cto", label: "CTO reviews", value: f.ctoReviewsDue, onClick: () => open("caseload") },
              ]}
            />
          }
        />
      </Hero>
      <FolderTabs label="Team sections" value={section} act={1} more={more} testId="community-team-tabs">
        {isPhone ? (
          <Segmented<CommunityTeamSection>
            className={folderTabClasses.switch}
            label="Team sections"
            size="md"
            value={section}
            onChange={open}
            items={tabItems}
          />
        ) : (
          <Tabs<CommunityTeamSection>
            className={folderTabClasses.switch}
            label="Team sections"
            idPrefix="community"
            value={section}
            onChange={open}
            items={tabItems}
          />
        )}
      </FolderTabs>
    </>
  );
}
