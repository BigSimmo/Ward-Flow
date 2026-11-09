"use client";

import type { ReactNode } from "react";
import { Send, Tv, UserPlus } from "lucide-react";
import { bedMeetingTvHref, WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import {
  Button,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  SrOnly,
  folderTabClasses,
  useIsPhone,
  type CheckingItem,
  type WfTone,
} from "@/components/wf";

import styles from "./ed-overview.module.css";
import pageTop from "@/components/ward-management/page-top-title.module.css";

type EdOverviewDepartment = {
  id: string;
  name: string;
  code: string;
  service: string;
  waiting: number;
  longest: string;
  /** Sorts the Switch ED band, longest wait first; without it the band keeps the given order. */
  longestMinutes?: number;
  breaches: number;
};

/** A hero highlight (v10): pressing one dims the other rows. */
type EdOverviewChip = { id: string; label: string; value: number; tone?: WfTone; word?: string };

type Props = {
  sinceLastLook?: ReactNode;
  departmentId: string;
  departments: EdOverviewDepartment[];
  /** People on this department's psychiatry board: the first figure. */
  onBoard: number;
  /** How the board splits: "22 waiting", then the other parts ("1 in transit"). */
  onBoardParts?: readonly string[];
  chips: EdOverviewChip[];
  /** The pressed chip, or null when nothing is highlighted. */
  highlight: string | null;
  onHighlight: (id: string | null) => void;
  /** "N of M past 24h, everyone stays on the board" while a chip is pressed. */
  highlightNote?: ReactNode;
  checks: CheckingItem[];
  /**
   * Opens the one referral slide-out, from this department (option B, 13 Oct 2026). Every desk gets
   * the New referral chip (page tops, Josh 9 Nov 2026), the ED desk included.
   */
  onRaiseReferral: () => void;
  /** The page's tabs (`FolderTabs`), drawn straight under the hero so the folder can measure it. */
  tabs?: ReactNode;
};

const shortName = (name: string) => name.replace(/ Emergency Department$/, "");

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/**
 * The department's top (page tops, Josh 9 Nov 2026), the same parts as Home's: the board figures,
 * the act row for anyone past the access target (Show highlights them on the board), the desk's jobs
 * as chips and, for every desk but an ED desk, one slim band of every emergency department, longest
 * wait first, each a link to its own board. Departments nobody waits in share one quiet cell.
 */
export function EdOverview({
  departmentId,
  sinceLastLook,
  departments,
  onBoard,
  onBoardParts = [],
  chips,
  highlight,
  onHighlight,
  highlightNote,
  checks,
  onRaiseReferral,
  tabs,
}: Props) {
  const isPhone = useIsPhone();
  const tvViewsOn = useWardFeatureFlag("bed-meeting-tv");
  // DA-09: an ED desk opens only its own department and not the TV, so those links follow the role filter.
  const canOpen = useCanOpenHref();
  // WT-24 and the ED desk redesign (Josh, 30 Oct 2026): an ED desk's copy holds only its own
  // department's people, so the Switch ED band is left out for that desk.
  const edDesk = useEffectiveWardAccess().role === "ed";
  // Deep audit (4 Nov 2026): off the phone the app bar always shows New referral to a desk that can
  // open the intake, so the hero's copy is left out there too. The phone bar has none, so it stays.
  const barHasReferral = !isPhone && canOpen(WARD_REFERRAL_INTAKE_HREF);
  // The Demo pill reads the clock, as on every other page top ("Demo 10:42").
  const now = useWardFlowClock();
  const current = departments.find((department) => department.id === departmentId);
  if (!current) return null;

  const chipOf = (id: string) => chips.find((chip) => chip.id === id);
  const past = chipOf("past");
  const noBed = chipOf("no_bed");
  const underForm = chipOf("under_form");
  const longest = checks.find((check) => check.id === "longest")?.value ?? "—";
  // "22 waiting, 1 in transit": the board counts more than the waiting (count labels, Josh 1 Nov 2026).
  const boardSplit =
    onBoardParts.length > 1 ? <span data-testid="ward-ed-board-split">{onBoardParts.join(", ")}</span> : undefined;
  const tvHref = bedMeetingTvHref({ ed: departmentId });
  const addPatientHref = "/ward-flow/people/new";
  const waitingEds = departments
    .filter((department) => department.waiting > 0)
    .sort((a, b) => (b.longestMinutes ?? 0) - (a.longestMinutes ?? 0) || b.waiting - a.waiting);
  const clearEds = departments.filter((department) => department.waiting === 0);
  const edLink = (id: string) => {
    const href = `/ward-flow/ed/${id}`;
    // DA-09: a department this desk cannot open keeps its figures but is not a link; this one is here.
    return id !== departmentId && canOpen(href) ? href : undefined;
  };

  return (
    <section
      className={styles.overview}
      aria-label="Emergency department overview"
      data-testid={`ward-ed-card-${departmentId}`}
    >
      <Hero
        level={1}
        className={`${pageTop.hero} ${folderTabClasses.hero}`}
        title={
          <>
            <SrOnly>{`${shortName(current.name)}, `}</SrOnly>
            ED psychiatry <span className={styles.titleSoft}>board</span>
          </>
        }
        aside={<LiveChip state="live" age={formatInstant(now)} onHero />}
      >
        <HeroTop
          figures={
            <HeroFigures
              label="Highlight people on the board"
              items={[
                { id: "on-board", value: onBoard, label: "on the board", testId: "ward-ed-figure-on-board" },
                { id: "longest", value: longest, label: "longest here", testId: "ward-ed-figure-longest" },
                ...[noBed, ...(isPhone ? [] : [underForm])]
                  .filter((chip) => chip !== undefined)
                  .map((chip) => ({
                    id: chip.id,
                    value: chip.value,
                    label: chip.label.toLowerCase(),
                    pressed: highlight === chip.id,
                    onClick: () => onHighlight(highlight === chip.id ? null : chip.id),
                    testId: `ward-ed-figure-${chip.id}`,
                  })),
              ]}
            />
          }
          act={
            past && past.value > 0 ? (
              <HeroAct
                tone="danger"
                title={`${past.value} ${past.word ?? past.label.toLowerCase()} in ED`}
                sub={boardSplit}
                action={{
                  label: highlight === "past" ? "Show everyone" : "Show",
                  phoneLabel: highlight === "past" ? "All" : "Show",
                  pressed: highlight === "past",
                  onClick: () => onHighlight(highlight === "past" ? null : "past"),
                  testId: "ward-ed-act-show",
                }}
                testId="ward-ed-act"
              />
            ) : (
              <HeroAct
                tone="calm"
                title={`Nobody ${past?.word ?? "past the access target"} in ED`}
                sub={boardSplit}
                testId="ward-ed-act"
              />
            )
          }
          chips={
            <HeroQuickChips
              label="Board jobs"
              items={[
                // "2 updates since 10:27" leads the row as one of its chips.
                ...(sinceLastLook
                  ? [{ id: "updates", label: "Updates", node: <span className={styles.updates}>{sinceLastLook}</span> }]
                  : []),
                // New referral repeats the app bar's, which opens the same slide-out: so it shows only
                // on a phone, and never on the ED desk (ED desk redesign, Josh 30 Oct 2026; deep
                // audit, 4 Nov 2026). The mock-up's chip row keeps the rest.
                ...(edDesk || barHasReferral
                  ? []
                  : [
                      {
                        id: "referral",
                        label: "New referral",
                        icon: <Send {...ICON} />,
                        onClick: onRaiseReferral,
                        testId: "ward-ed-raise-referral-toggle",
                      },
                    ]),
                // P142 (Josh, 27 Oct 2026, 10:12 PM AWST): Add patient sits beside the referral chip.
                ...(canOpen(addPatientHref)
                  ? [
                      {
                        id: "add",
                        label: "Add patient",
                        icon: <UserPlus {...ICON} />,
                        href: addPatientHref,
                        testId: "ward-ed-add-patient",
                      },
                    ]
                  : []),
                // This department's own TV screen, behind the `bed-meeting-tv` flag.
                ...(!isPhone && tvViewsOn && canOpen(tvHref)
                  ? [{ id: "tv", label: "On TV", icon: <Tv {...ICON} />, href: tvHref, testId: "ward-ed-open-tv" }]
                  : []),
              ]}
            />
          }
          band={
            edDesk ? undefined : (
              <HeroBand
                title="Switch ED"
                aside="All EDs"
                asideHref={canOpen("/ward-flow/ed") ? "/ward-flow/ed" : undefined}
                testId="ward-ed-switch"
                cells={[
                  ...waitingEds.map((department) => ({
                    id: department.id,
                    label: department.code,
                    value: department.waiting,
                    sub: department.longest,
                    subTone: department.breaches > 0 ? ("danger" as const) : undefined,
                    href: edLink(department.id),
                    ariaLabel: `${department.name}: ${department.waiting} waiting, longest ${department.longest}${department.breaches > 0 ? `, ${department.breaches} over target` : ""}${department.id === departmentId ? ", this department" : ""}`,
                    testId: `ward-ed-switch-${department.id}`,
                  })),
                  ...(clearEds.length > 0
                    ? [
                        {
                          id: "clear",
                          label: clearEds.map((department) => department.code).join(" · "),
                          value: "no wait",
                          quiet: true,
                          ariaLabel: `Nobody waiting at ${clearEds.map((department) => department.name).join(", ")}`,
                        },
                      ]
                    : []),
                ]}
              />
            )
          }
        >
          {highlight && highlightNote ? (
            <span className={styles.note} aria-live="polite" data-testid="ward-ed-highlight-note">
              <span>{highlightNote}</span>
              <Button variant="onHero" size="sm" onClick={() => onHighlight(null)}>
                Clear
              </Button>
            </span>
          ) : null}
        </HeroTop>
      </Hero>
      {tabs}
    </section>
  );
}
