"use client";

// The bed board's hero, its route tabs and tools, and the one figures line (Stays and discharges
// redesign, approved by Josh 31 Oct 2026). Split out of ward-board.tsx; WardBoard owns every value.

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bed, ClipboardList } from "lucide-react";

import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import type { HealthService, Site, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { unitHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardSwitchPopover } from "@/components/ward-management/ward/ward-switch-menu";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";
import {
  FolderTabs,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  SrOnly,
  cx,
  folderTabClasses,
  heroChipClassName,
  useIsPhone,
  type HeroBandCell,
} from "@/components/wf";

import pageTop from "../page-top-hero.module.css";
import styles from "./ward-board-hero.module.css";

type BoardFigure = { key: string; label: string; value: number; led?: boolean; note?: string };

/** Page tops: the band's short word for each figure; the shared label is still read in full. */
const BAND_WORDS: Record<string, string> = {
  expectedToday: "Expected",
  confirmedToday: "Confirmed",
  blockedToday: "Held up",
  awayAtEd: "Away at an ED",
  onLeave: "On leave",
  overThreeMonths: "Over 3 months",
  held: "Closed",
  blockedBeds: "Out of service",
};
const BAND_ORDER = [
  "expectedToday",
  "goingOut",
  "confirmedToday",
  "blockedToday",
  "awayAtEd",
  "onLeave",
  "overThreeMonths",
  "held",
  "blockedBeds",
];

/**
 * Page tops (Josh approved, 9 Nov 2026): the board's top as Home's. The title names the page and its
 * beds; the figures are Ready now, Occupied and Pulled, not arrived (and Coming in on a wider screen);
 * the one next step is the "Worth a look" list; the chips are Shift brief and Change ward; the band
 * is "Also on this ward", every day figure the old line held, each still read with its shared label.
 * The ward's name stays in the heading for a screen reader, with its test id. The being-made-ready,
 * service and constraint sentences and the As at stamp with its synthetic notice stay, as one quiet
 * line under the band. The route tabs are the folder tabs below the hero.
 */
export function WardBoardHero(props: {
  available: number;
  constraint: string | null;
  incoming: number;
  outgoing: number;
  pendingPreparation: number;
  pulledIn: number;
  service: HealthService | null;
  site: Site;
  stamp: { time: string | null; dayNote: string };
  states: BedStateCounts;
  unit: Unit;
  now: number;
  online: boolean;
  /** Every day figure; Ready now and Pulled are the hero's own figures. */
  figures: BoardFigure[];
  /** How many people the "Worth a look" list holds, and how to show it. */
  worthALook: number;
  onShowWorthALook: () => void;
  /** Shift brief and Change ward (`WardBoardTools`). */
  tools: ReactNode;
}) {
  const { available, constraint, outgoing, pulledIn, service, site, stamp, states, unit, tools } = props;
  const isPhone = useIsPhone();
  // On a phone, Expected joins the band's start after the first paint; the sideways row snaps to the
  // cell it showed, so it is brought back to the start.
  useEffect(() => {
    const list = document.querySelector('[data-testid="ward-board-triage"] ul');
    if (list) list.scrollLeft = 0;
  }, [isPhone]);
  // The ready figure always says how many of those beds are still being made ready.
  const pendingPreparation = props.pendingPreparation;
  // Each sentence keeps its own test id, as the old header's paragraphs did, inside one quiet line.
  const sentences: { testId: string; text: string }[] = [];
  if (pendingPreparation > 0)
    sentences.push({
      testId: "ward-board-pending-preparation",
      text: `${pendingPreparation} of them ${pendingPreparation === 1 ? "is" : "are"} still being made ready, not yet offered.`,
    });
  if (service !== null)
    sentences.push({
      testId: "ward-board-service-sentence",
      text:
        service === site.service
          ? `${service} is this ward's own service.`
          : `This ward is in ${site.service}, not ${service}.`,
    });
  if (constraint !== null) sentences.push({ testId: "ward-board-constraint", text: constraint });
  const byKey = new Map(props.figures.map((figure) => [figure.key, figure]));
  const expected = byKey.get("expectedToday");
  const cells: HeroBandCell[] = BAND_ORDER.flatMap((key): HeroBandCell[] => {
    if (key === "goingOut")
      return [
        {
          id: key,
          label: (
            <>
              <span aria-hidden="true">Going out</span>
              <SrOnly>Going out today and tomorrow</SrOnly>
            </>
          ),
          value: outgoing,
        },
      ];
    const figure = byKey.get(key);
    if (!figure || (key === "expectedToday" && !isPhone)) return [];
    return [
      {
        id: key,
        label: (
          <>
            <span aria-hidden="true">{BAND_WORDS[key] ?? figure.label}</span>
            <SrOnly>{`${figure.label}${figure.led ? ", shown in Going out" : ""}`}</SrOnly>
          </>
        ),
        // The note ("(1 also held up)") stays on the value's line: band cells never wrap (QA, 9 Nov 2026).
        value: figure.note ? (
          <>
            {figure.value}
            <span className={styles.bandNote}> {figure.note}</span>
          </>
        ) : (
          figure.value
        ),
        tone: key === "blockedToday" && figure.value > 0 ? "danger" : undefined,
        testId: `ward-board-figure-${key}`,
      },
    ];
  });
  return (
    <>
      <Hero
        testId="ward-board-header"
        className={cx(pageTop.hero, folderTabClasses.hero)}
        title={
          <>
            Bed board
            <span id="ward-board-unit-name" className="sr-only" data-testid="ward-board-unit-name">
              {`, ${unit.name}`}
            </span>{" "}
            {/* Shown, not spoken: the heading is the screen and the ward; the note line below says the beds. */}
            <span className={pageTop.titleSoft} aria-hidden="true">
              {unit.beds} bed{unit.beds === 1 ? "" : "s"}
            </span>
          </>
        }
        aside={<LiveChip state={props.online ? "live" : "offline"} onHero age={formatInstant(props.now)} />}
      >
        <HeroTop
          figures={
            // The Help tour points at the figures by this test id; the wrapper draws no box.
            <div className={styles.statSlot} data-testid="ward-board-band-stats">
              <HeroFigures
                label="Bed board figures"
                items={[
                  {
                    id: "ready",
                    value: available,
                    label: "ready now",
                    testId: "ward-board-headline",
                  },
                  { id: "occupied", value: states.occupied, label: "occupied" },
                  {
                    id: "pulled",
                    value: pulledIn,
                    label: (
                      <>
                        <SrOnly>Pulled, </SrOnly>not arrived
                      </>
                    ),
                    testId: "ward-board-figure-pulled",
                  },
                  // Wider screens: Expected today joins the figures (the band then leaves it out).
                  ...(isPhone || !expected
                    ? []
                    : [
                        {
                          id: "expected",
                          value: expected.value,
                          label: (
                            <>
                              expected out
                              <SrOnly>{` (${expected.label}${expected.led ? ", shown in Going out" : ""})`}</SrOnly>
                            </>
                          ),
                          testId: "ward-board-figure-expectedToday",
                        },
                      ]),
                ]}
              />
            </div>
          }
          act={
            props.worthALook > 0 ? (
              <HeroAct
                tone="warning"
                title={`${props.worthALook} worth a look`}
                action={{
                  label: "Show on board",
                  phoneLabel: "Show",
                  onClick: props.onShowWorthALook,
                  testId: "ward-board-worth-a-look",
                }}
              />
            ) : (
              <HeroAct tone="calm" title="Nothing worth a look" />
            )
          }
          chips={tools}
          band={
            <>
              {/* The band's title is a quiet label; this keeps "Also on this ward" a heading to move by. */}
              <h2 className="sr-only" id="ward-board-triage-heading">
                Also on this ward
              </h2>
              <HeroBand
                title="Also on this ward"
                testId="ward-board-triage"
                aside={isPhone ? "today and tomorrow" : `today and tomorrow · ${designationSummary(unit)}`}
                cells={cells}
              />
            </>
          }
        >
          <p className={styles.heroNote}>
            <span className="sr-only">
              <span data-testid="ward-board-site-name">{`${site.name} · ${site.service}. `}</span>
              <span data-testid="ward-board-designation">
                {`${unit.beds} bed${unit.beds === 1 ? "" : "s"} · ${designationSummary(unit)}. `}
              </span>
            </span>
            {sentences.map((sentence) => (
              <Fragment key={sentence.testId}>
                <span data-testid={sentence.testId}>{sentence.text}</span>{" "}
              </Fragment>
            ))}
            <span data-testid="ward-board-as-at">
              {stamp.time === null ? "As at — the moment shown is not recorded." : `As at ${stamp.time}`}
            </span>
            {stamp.time !== null ? (
              <>
                {" · "}
                <span data-testid="ward-board-as-at-note">{stamp.dayNote}</span>
              </>
            ) : null}
          </p>
        </HeroTop>
      </Hero>
      <FolderTabs label={`${unit.name} screens`} value="stays" testId="ward-board-tabs" className={styles.boardFolder}>
        <WardBoardScreenNav unit={unit} beds={unit.beds} />
      </FolderTabs>
    </>
  );
}

/**
 * Ward home and Bed board as the folder tabs (page tops, 9 Nov 2026), route links marked as tabs so
 * the folder can find the chosen one.
 */
function WardBoardScreenNav({ unit, beds }: { unit: Unit; beds?: number }) {
  return (
    <div className={cx(folderTabClasses.switch, styles.boardTabs)} role="tablist" aria-label={`${unit.name} screens`}>
      <Link href={unitHref(unit.id)} role="tab" aria-selected={false}>
        Ward home
      </Link>
      <Link href={wardBoardHref(unit.id)} role="tab" aria-selected aria-current="page">
        <span>Bed board</span>
        {beds !== undefined ? (
          <>
            {" "}
            <span aria-hidden="true">{beds}</span>
          </>
        ) : null}
      </Link>
    </div>
  );
}

/**
 * Shift brief and Change ward as the hero's chips (page tops, 9 Nov 2026). Wired as before: the brief
 * toggles the printed sheet, and Change ward opens the list of wards it may open, as the ward page's
 * Switch ward does.
 */
export function WardBoardTools({
  sheetOpen,
  onToggleSheet,
  units: everyWard,
  currentUnitId,
}: {
  sheetOpen: boolean;
  onToggleSheet: () => void;
  units: Unit[];
  currentUnitId: string;
}) {
  // Role branch (ward desk, nurse in charge): a ward desk opens only its own ward(s), so Change ward
  // lists only those, and is left out when there is just the one. Every other desk lists every ward.
  const access = useEffectiveWardAccess();
  const router = useOptionalRouter();
  const [switchOpen, setSwitchOpen] = useState(false);
  const deskWardIds = access.role === "ward" && access.scope.kind === "ward" ? access.scope.unitIds : null;
  const units = deskWardIds ? everyWard.filter((candidate) => deskWardIds.includes(candidate.id)) : everyWard;
  const showSwitch = !(deskWardIds && units.length <= 1);
  const current = everyWard.find((candidate) => candidate.id === currentUnitId);
  return (
    <>
      <HeroQuickChips
        label="Bed board actions"
        items={[
          {
            id: "brief",
            label: "Shift brief",
            node: (
              <button
                type="button"
                className={heroChipClassName}
                onClick={onToggleSheet}
                aria-expanded={sheetOpen}
                aria-controls="ward-board-sheet-body"
                data-testid="ward-board-top-sheet-toggle"
              >
                <ClipboardList strokeWidth={1.75} size={16} aria-hidden="true" />
                <span>Shift brief</span>
              </button>
            ),
          },
          ...(showSwitch
            ? [
                {
                  id: "switch",
                  label: "Change ward",
                  icon: <Bed strokeWidth={1.75} aria-hidden="true" />,
                  count: units.length,
                  countTone: "quiet" as const,
                  countLabel: "wards",
                  onClick: () => setSwitchOpen((was) => !was),
                  testId: "ward-board-change-ward",
                },
              ]
            : []),
        ]}
      />
      {showSwitch && current ? (
        <WardSwitchPopover
          unit={current}
          switchUnits={units.filter((candidate) => candidate.id !== currentUnitId)}
          onChoose={(id) => {
            const href = wardBoardHref(id);
            if (router) router.push(href);
            else window.location.assign(href);
          }}
          open={switchOpen}
          onClose={() => setSwitchOpen(false)}
          anchorTestId="ward-board-change-ward"
        />
      ) : null}
    </>
  );
}
