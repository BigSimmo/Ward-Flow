"use client";

import { useMemo } from "react";

import { splitDuration } from "@/components/ward-management/ward-clock";

import { bedsBeingPrepared, hubRows, readyBeds, sumCounts, type EdHubRow } from "./ed-proposal-figures";
import { Answer, edProposalHref, KpiStrip, Panel, ProposalHeader, Tag, useEdProposalWorld } from "./ed-proposal-parts";
import styles from "./ed-proposal.module.css";

/**
 * ED Hub, proposed: every emergency department on one table, worst first, so the coordinator sees
 * where the pressure is before choosing a department. Today the ED Hub entry opens one department.
 */
export function EdHubProposal() {
  const { world, now, accessTarget, asAt } = useEdProposalWorld();
  const rows = useMemo(() => hubRows(world, now, accessTarget), [world, now, accessTarget]);
  const total = sumCounts(rows);
  const ready = readyBeds(world.units, world.bedReleases);
  const preparing = bedsBeingPrepared(world.units, world.bedReleases);
  const busiest = rows.reduce((top, row) => (row.counts.onList > top.counts.onList ? row : top), rows[0]);
  const maxOnList = Math.max(1, ...rows.map((row) => row.counts.onList));
  const target = accessTarget % 60 === 0 ? `${accessTarget / 60}-hour` : splitDuration(accessTarget);

  const lead =
    total.onList === 0
      ? "Nobody is on an emergency department psychiatry list."
      : `${total.onList} people are on ED psychiatry lists; ${busiest.ed.name.replace(" Emergency Department", "")} has the most (${busiest.counts.onList}).`;

  return (
    <main id="main-content" className={styles.page} data-testid="ed-hub-proposal">
      <ProposalHeader
        crumbs={[{ label: "Service hubs" }, { label: "ED Hub" }]}
        title="ED Hub"
        service={`${rows.length} emergency departments`}
        asAt={asAt}
        actions={
          <a className={styles.button} href="/mockups/ward-flow/referrals/new">
            Raise referral
          </a>
        }
      />
      <Answer
        lead={lead}
        sub={`${total.noBed} have no bed yet, ${total.pastTarget} ${total.pastTarget === 1 ? "has" : "have"} passed the ${target} access target, and ${ready} beds are ready now across the state.`}
      />
      <KpiStrip
        label="Network figures"
        items={[
          { label: "On ED lists", value: total.onList, note: "Psychiatry patients still in an ED" },
          {
            label: "No bed yet",
            value: total.noBed,
            note: "No ward has accepted",
            tone: total.noBed ? "warn" : undefined,
          },
          { label: "Bed found, still in ED", value: total.bedFound, note: "Accepted, pulled or handover ready" },
          {
            label: "Past access target",
            value: total.pastTarget,
            note: `Over the ${target} target since referral (your default, not a legal limit)`,
            tone: total.pastTarget ? "danger" : undefined,
          },
          { label: "Not yet reviewed", value: total.notReviewed, note: "No psychiatric examination recorded" },
          {
            label: "Beds ready now",
            value: ready,
            note: `${preparing} still being made ready · same figure as Capacity`,
            tone: "good",
          },
        ]}
      />
      <Panel
        title="Emergency departments"
        question="Where is the pressure? Worst first: past target, then no bed yet, then most on the list."
        meta={`${rows.length} departments`}
        flush
        foot={
          <>
            <span>Time since referral is the access clock; it starts when the referral is received.</span>
            <a className={styles.link} href="/mockups/ward-flow/capacity">
              Capacity ›
            </a>
          </>
        }
      >
        <div className={styles.tableScroll} role="region" aria-label="Emergency departments table" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Health service</th>
                <th scope="col" className={styles.num}>
                  On list
                </th>
                <th scope="col" aria-hidden="true" />
                <th scope="col" className={styles.num}>
                  No bed yet
                </th>
                <th scope="col" className={styles.num}>
                  Bed found
                </th>
                <th scope="col" className={styles.num}>
                  Awaiting review
                </th>
                <th scope="col" className={styles.num}>
                  Expected
                </th>
                <th scope="col" className={styles.num}>
                  Longest since referral
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ed.id}>
                  <td>
                    <span className={styles.who}>
                      <a className={styles.link} href={edProposalHref(row.ed.id)}>
                        {row.ed.name.replace(" Emergency Department", "")}
                      </a>
                      <span>
                        <HubStatus row={row} />
                      </span>
                    </span>
                  </td>
                  <td className={styles.sub}>{row.service}</td>
                  <td className={styles.num}>{row.counts.onList}</td>
                  <td aria-hidden="true">
                    <span className={styles.hbarTrack}>
                      <span className={styles.hbar} style={{ width: `${(row.counts.onList / maxOnList) * 100}%` }} />
                    </span>
                  </td>
                  <td className={styles.num}>{row.counts.noBed}</td>
                  <td className={styles.num}>{row.counts.bedFound}</td>
                  <td className={styles.num}>{row.awaitingReview}</td>
                  <td className={styles.num}>{row.expected}</td>
                  <td className={styles.num}>
                    {row.counts.longest === undefined ? "None" : splitDuration(row.counts.longest)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>All departments</td>
                <td className={styles.num}>{total.onList}</td>
                <td aria-hidden="true" />
                <td className={styles.num}>{total.noBed}</td>
                <td className={styles.num}>{total.bedFound}</td>
                <td className={styles.num}>{rows.reduce((sum, row) => sum + row.awaitingReview, 0)}</td>
                <td className={styles.num}>{rows.reduce((sum, row) => sum + row.expected, 0)}</td>
                <td className={styles.num}>{total.longest === undefined ? "None" : splitDuration(total.longest)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
      <p className={styles.footer}>
        Synthetic prototype · Not a medical device · Figures are not live clinical records
      </p>
    </main>
  );
}

function HubStatus({ row }: { row: EdHubRow }) {
  if (row.counts.pastTarget > 0) return <Tag tone="danger">{row.counts.pastTarget} past target</Tag>;
  if (row.counts.noBed > 0) return <Tag tone="warn">{row.counts.noBed} no bed yet</Tag>;
  if (row.counts.onList > 0) return <Tag tone="quiet">Beds found</Tag>;
  return <Tag tone="good">Nobody waiting</Tag>;
}
