"use client";

import { useMemo, useState } from "react";

import { getActiveBroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatInstant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";

import { alertFigures } from "./flow-proposal-figures";
import {
  edName,
  KpiStrip,
  Panel,
  PreviewBar,
  ProposalHeader,
  proposalHref,
  useFlowProposal,
} from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

type Audience = "all" | "you" | "other" | "acknowledged";

export function AlertsProposal() {
  const { world, now, scoped, asAt, initialsOf } = useFlowProposal();
  const { units, referrals, dispatch, inboxAcknowledgements, broadcastAlerts } = world;
  const figures = useMemo(() => alertFigures(scoped, units, referrals ?? [], now), [scoped, units, referrals, now]);
  const [audience, setAudience] = useState<Audience>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const broadcast = getActiveBroadcastAlert(broadcastAlerts ?? [], now);

  const movementOf = (item: InboxItem) => scoped.find((movement) => movement.id === item.movementId);
  const acknowledged = (item: InboxItem) => (inboxAcknowledgements[item.id] ?? []).length > 0;
  const acknowledgedCount = [...figures.forYou, ...figures.forOthers].filter(acknowledged).length;
  const openCount = scoped.filter(isOpen).length;

  const acknowledge = (item: InboxItem) => {
    dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now, inboxItemId: item.id });
    const movement = movementOf(item);
    setNotice(
      `Acknowledged: ${item.title}${movement ? ` for ${initialsOf(movement)}` : ""}. It stays listed while it is still true.`,
    );
  };

  const renderItem = (item: InboxItem) => {
    const movement = movementOf(item);
    const seen = (inboxAcknowledgements[item.id] ?? []).at(-1);
    return (
      <li key={item.id} className={styles.actItem}>
        <span className={styles.edge} data-tone={item.tone === "danger" ? "danger" : "warn"} aria-hidden="true" />
        <div>
          <p className={styles.actTitle}>
            {item.title}
            {movement ? ` · ${initialsOf(movement)}` : ""}
          </p>
          <p className={styles.actMeta}>
            {movement ? `${edName(movement)} · ` : ""}
            {item.detail}
          </p>
          <p className={styles.actMeta}>
            Addressed to: <strong>{item.owner}</strong>
            {seen ? ` · acknowledged by ${seen.by} at ${formatInstant(seen.at)}` : ""}
          </p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={() => acknowledge(item)} disabled={seen !== undefined}>
            {seen ? "Acknowledged" : "Acknowledge"}
          </button>
          {movement ? (
            <a className={`${styles.btn} ${styles.btnPrimary}`} href={movementHref(movement.id)}>
              Open record
            </a>
          ) : null}
        </div>
      </li>
    );
  };

  const only = (items: InboxItem[]) => (audience === "acknowledged" ? items.filter(acknowledged) : items);
  const forYou = only(figures.forYou);
  const forOthers = only(figures.forOthers);
  const showYou = audience !== "other";
  const showOthers = audience !== "you";

  return (
    <>
      <PreviewBar active="alerts" />
      <main className={styles.page} id="main-content" data-testid="alerts-proposal">
        <ProposalHeader
          crumb="Oversight › Alerts"
          title="Alerts"
          asAt={asAt}
          action={
            <a className={styles.btn} href="/mockups/ward-flow/alerts">
              Send a network broadcast ›
            </a>
          }
          answer={
            <>
              {figures.forYou.length === 0 ? (
                <strong>Nothing needs you right now.</strong>
              ) : (
                <strong>
                  {figures.forYou.length} {figures.forYou.length === 1 ? "alert needs" : "alerts need"} you now.
                </strong>
              )}{" "}
              {figures.forOthers.length} {figures.forOthers.length === 1 ? "sits" : "sit"} with other roles.{" "}
              {figures.conditionsFiring} of the {figures.conditionsChecked} conditions this screen checks are firing;
              the rest are clear, listed on the right.
            </>
          }
        />

        {broadcast ? (
          <p className={styles.notice} role="status">
            <strong>Network broadcast in force:</strong> {broadcast.title}. {broadcast.message}
          </p>
        ) : null}

        <KpiStrip
          label="Alert figures. Each one filters the list."
          selected={audience}
          onSelect={(id) => setAudience((current) => (current === id ? "all" : (id as Audience)))}
          items={[
            { id: "all", label: "All alerts", value: figures.total, note: `Across ${openCount} open movements` },
            {
              id: "you",
              label: "Needs you",
              value: figures.forYou.length,
              tone: figures.forYou.length > 0 ? "danger" : "good",
              note: "Coordinator decisions",
            },
            { id: "other", label: "Other roles", value: figures.forOthers.length, note: "Wards, transport, ED teams" },
            {
              id: "acknowledged",
              label: "Acknowledged",
              value: acknowledgedCount,
              note: "Still true, someone has seen it",
            },
          ]}
        />

        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}

        <div className={styles.grid2}>
          <div className={styles.stack}>
            {showYou ? (
              <Panel
                title="Needs you"
                question="Coordinator decisions, most serious first."
                meta={`${forYou.length}`}
                flush
              >
                {forYou.length === 0 ? (
                  <p className={styles.empty}>
                    No coordinator alert is firing. The conditions checked are listed on the right.
                  </p>
                ) : (
                  <ul className={styles.actList}>{forYou.map(renderItem)}</ul>
                )}
              </Panel>
            ) : null}
            {showOthers ? (
              <Panel
                title="With other roles"
                question="For awareness. Each names the role it is addressed to."
                meta={`${forOthers.length}`}
                flush
              >
                {forOthers.length === 0 ? (
                  <p className={styles.empty}>No alert is addressed to another role.</p>
                ) : (
                  <ul className={styles.actList}>{forOthers.map(renderItem)}</ul>
                )}
              </Panel>
            ) : null}
          </div>

          <Panel
            title="What this screen checks"
            question="Every condition, including the clear ones. An empty list is not an all-clear for the service."
            meta={`${figures.conditionsFiring} of ${figures.conditionsChecked} firing`}
            flush
            foot={
              <>
                <span>Not watched here: bed numbers, staffing, community follow-up.</span>
                <a className={styles.link} href={proposalHref("delays")}>
                  Why people are waiting ›
                </a>
              </>
            }
          >
            <ul className={styles.conditions}>
              {figures.conditions.map((condition) => {
                const count = condition.referralCount ?? condition.items.length;
                return (
                  <li key={condition.id}>
                    <span className={styles.conditionName}>{condition.title}</span>
                    <span
                      className={styles.tag}
                      data-tone={count > 0 ? (condition.audience === "you" ? "danger" : "warn") : "good"}
                    >
                      {count === 0
                        ? "Clear"
                        : condition.referralCount !== undefined
                          ? `${count} referrals`
                          : `${count} firing`}
                    </span>
                    <span className={styles.conditionWatch}>
                      {condition.referralCount !== undefined ? (
                        <>
                          {condition.watches} Listed on the{" "}
                          <a className={styles.link} href="/mockups/ward-flow/referrals">
                            referral board
                          </a>
                          , not here.
                        </>
                      ) : (
                        condition.watches
                      )}{" "}
                      {condition.referralCount !== undefined
                        ? null
                        : condition.audience === "you"
                          ? "Goes to the coordinator."
                          : "Goes to the role named on it."}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <WardPrototypeFooter testId="alerts-proposal-footer" />
      </main>
    </>
  );
}
