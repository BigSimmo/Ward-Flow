"use client";

import { useMemo, useState } from "react";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import {
  communityNameCollisions,
  communityTeamSuburbCounts,
} from "@/components/ward-management/community/community-vocabulary";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

import { hubFigures, teamHasPeople, type TeamFigures } from "./community-proposal-figures";
import {
  Empty,
  KpiStrip,
  Panel,
  PreviewBar,
  ProposalHeader,
  TableScroll,
  Verdict,
  proposalTeamHref,
  type Attention,
} from "./community-proposal-parts";
import styles from "./community-proposal.module.css";

type Show = "all" | "active";

/**
 * Proposed community hub. Answers "which community teams have people waiting or in a bed right
 * now?" first, then lets a coordinator find any team by name. Every count is derived from shared
 * state through `community-proposal-figures.ts`, the same derivations the team pages use.
 */
export function CommunityHubProposal() {
  const { admissions, referrals, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");

  const hub = useMemo(() => hubFigures(COMMUNITY_TEAM_PAGES, admissions, referrals, now), [admissions, referrals, now]);
  const suburbs = useMemo(() => communityTeamSuburbCounts(), []);
  const collisions = useMemo(() => communityNameCollisions(), []);
  const readsAlike = useMemo(() => {
    const map = new Map<string, number>();
    for (const collision of collisions) {
      for (const entry of collision.names) map.set(entry.name, collision.names.length - 1);
    }
    return map;
  }, [collisions]);

  const needle = query.trim().toLowerCase();
  const visible = hub.teams.filter(
    (figures) =>
      (needle === "" || figures.team.name.toLowerCase().includes(needle)) && (show === "all" || teamHasPeople(figures)),
  );
  const byLetter = new Map<string, TeamFigures[]>();
  for (const figures of visible) {
    const letter = figures.team.name.charAt(0).toUpperCase();
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), figures]);
  }

  const activeNames = hub.active.map((figures) => figures.team.name);
  const attention: Attention[] = [];
  if (hub.waiting > 0)
    attention.push({ tone: "danger", label: `${hub.waiting} waiting for a team's answer`, href: "#active-teams" });
  attention.push({
    tone: "warn",
    label: `${hub.unmatched} admissions not matched to any team`,
    href: "#coverage",
  });
  attention.push({
    tone: "info",
    label: `${collisions.length} groups of names that read alike`,
    href: "#reads-alike",
  });

  return (
    <>
      <PreviewBar currentHref="/mockups/ward-flow/community" label="Community teams" />
      <main id="main-content" className={styles.page} data-testid="community-hub-proposal">
        <ProposalHeader
          crumbs={[{ label: "Ward Flow", href: "/mockups/ward-flow" }, { label: "Community teams" }]}
          title="Community teams"
          subtitle="Who is waiting for a community team, and who is in a bed under a referral that named one."
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          actions={
            <>
              <a className={styles.buttonPrimary} href="/mockups/ward-flow/referrals/new">
                Raise a referral
              </a>
              <a className={styles.button} href="/mockups/ward-flow/referrals">
                Referral board
              </a>
            </>
          }
        />

        <Verdict attention={attention}>
          {hub.waiting === 0 ? <strong>No referral is waiting for a community team&apos;s answer.</strong> : null}{" "}
          {hub.active.length === 0 ? (
            "No admission is matched to any community team."
          ) : (
            <>
              <strong>
                {hub.active.length} of {hub.teams.length}
              </strong>{" "}
              team names have people matched today: {activeNames.join(" and ")}.
            </>
          )}
        </Verdict>

        <KpiStrip
          label="Community figures"
          items={[
            {
              label: "Waiting for an answer",
              value: hub.waiting,
              tone: hub.waiting > 0 ? "danger" : undefined,
              note: "Referrals naming a team, not yet accepted or declined",
            },
            {
              label: "In a bed or holding one",
              value: hub.inBed,
              note: "Under a referral that named a team",
            },
            { label: "Accepted by a team", value: hub.accepted, note: "Accepted for follow-up" },
            {
              label: "Teams with people matched",
              value: (
                <>
                  {hub.active.length}
                  <small>of {hub.teams.length}</small>
                </>
              ),
            },
            {
              label: "Not matched to a team",
              value: hub.unmatched,
              tone: "warn",
              note: "Admissions whose referral named no team",
              href: "#coverage",
            },
          ]}
        />

        <div className={styles.grid2}>
          <div className={styles.stack}>
            <Panel
              id="active-teams"
              title="Teams with people matched"
              question="Open a team to see who is waiting, in a bed, or expected back."
              meta={`${hub.active.length} teams`}
              flush
            >
              {hub.active.length === 0 ? (
                <Empty>No team has anyone matched right now.</Empty>
              ) : (
                <TableScroll label="Teams with people matched">
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        <th scope="col">Health service</th>
                        <th scope="col" className={styles.num}>
                          Waiting
                        </th>
                        <th scope="col" className={styles.num}>
                          In a bed
                        </th>
                        <th scope="col" className={styles.num}>
                          Discharge date set
                        </th>
                        <th scope="col" className={styles.num}>
                          Accepted
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hub.active.map((figures) => (
                        <tr key={figures.team.id}>
                          <td className={styles.rowName}>
                            <a href={proposalTeamHref(figures.team.id)}>{figures.team.name}</a>
                          </td>
                          <td>{contactForTeam(figures.team.name)?.hsp ?? "Not recorded"}</td>
                          <td className={styles.num}>{figures.waiting.length}</td>
                          <td className={styles.num}>{figures.inBed.length}</td>
                          <td className={styles.num}>{figures.expectedBack.length}</td>
                          <td className={styles.num}>{figures.accepted.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Panel>
            <Panel id="coverage" title="What these pages can and cannot see">
              <dl className={styles.definitions}>
                <div>
                  <dt>Matched</dt>
                  <dd>
                    A person appears under a team only when their referral named that team. Where they live is never
                    used.
                  </dd>
                </div>
                <div>
                  <dt>Not matched</dt>
                  <dd>
                    {hub.unmatched} admissions have no referral naming a team, so they appear on no team page. This is
                    not a population view.
                  </dd>
                </div>
                <div>
                  <dt>Team names</dt>
                  <dd>
                    From the S2015 catchment table. They are referral vocabulary, not a current list of Western
                    Australian services, and no team has agreed to be represented.
                  </dd>
                </div>
              </dl>
            </Panel>
          </div>
          <div className={styles.stack}>
            <Panel
              id="reads-alike"
              title="Names that read alike"
              question="Pick the exact name the referral used. These may or may not be the same service."
              meta={`${collisions.length} groups`}
            >
              <ul className={styles.familyList}>
                {collisions.map((collision) => (
                  <li key={collision.names[0]?.name}>
                    {collision.names.map((entry, index) => {
                      const id = COMMUNITY_TEAM_PAGES.find((team) => team.name === entry.name)?.id;
                      return (
                        <span key={entry.name}>
                          {index > 0 ? " · " : ""}
                          {id ? <a href={proposalTeamHref(id)}>{entry.name}</a> : entry.name}
                        </span>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <Panel
          id="directory"
          title="Find a team"
          question="Every team name a referral can use, A to Z."
          meta={`${visible.length} of ${hub.teams.length}`}
        >
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <span className={styles.srOnly}>Search team names</span>
              <input
                type="search"
                placeholder="Search team names"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className={styles.segmented} role="group" aria-label="Which teams to show">
              <button type="button" aria-pressed={show === "all"} onClick={() => setShow("all")}>
                All names
              </button>
              <button type="button" aria-pressed={show === "active"} onClick={() => setShow("active")}>
                With people matched
              </button>
            </div>
          </div>
          <p className={styles.srOnly} aria-live="polite">
            {visible.length} team names shown
          </p>
          {visible.length === 0 ? (
            <Empty>No team name matches “{query}”. Check the spelling, or search part of the name.</Empty>
          ) : (
            <div className={styles.directory}>
              {[...byLetter.entries()].map(([letter, rows]) => (
                <section key={letter} className={styles.letterGroup} aria-label={`Teams starting ${letter}`}>
                  <h3 className={styles.letter}>{letter}</h3>
                  <ul className={styles.teamList}>
                    {rows.map((figures) => {
                      const alike = readsAlike.get(figures.team.name) ?? 0;
                      const suburbCount = suburbs.get(figures.team.name) ?? 0;
                      return (
                        <li key={figures.team.id}>
                          <a className={styles.teamLink} href={proposalTeamHref(figures.team.id)}>
                            <span className={styles.teamName}>{figures.team.name}</span>
                            <span className={styles.teamMeta}>
                              {suburbCount} {suburbCount === 1 ? "suburb" : "suburbs"}
                              {alike > 0 ? (
                                <span className={styles.tagWarn}>
                                  Reads like {alike} {alike === 1 ? "other" : "others"}
                                </span>
                              ) : null}
                              {figures.waiting.length > 0 ? (
                                <span className={styles.tagDanger}>{figures.waiting.length} waiting</span>
                              ) : null}
                              {figures.inBed.length > 0 ? (
                                <span className={styles.tagAccent}>{figures.inBed.length} in a bed</span>
                              ) : figures.accepted.length > 0 ? (
                                <span className={styles.tagAccent}>{figures.accepted.length} accepted</span>
                              ) : null}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </main>
    </>
  );
}
