"use client";

// The alert chosen in Home's My list, shown inside the placement drawer under the patient's name
// (H8, approved by Josh 3 Nov 2026). It replaced the separate "Chosen alert" card above Placement:
// one tinted block with the reason, the detail, how long ago and who owns it when that is not you.

import {
  alertDetail,
  alertKindLabel,
  legalTypedEnd,
  minutesText,
} from "@/components/ward-management/alerts/alerts-model";
import { ownerShort, type QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import type { Instant } from "@/components/ward-management/ward-clock";
import { StatusGlyph } from "@/components/wf";

import p from "./home-placement-drawer.module.css";

export function ChosenAlertCard({ entry, now }: { entry: QueueEntry; now: Instant }) {
  const kindLabel = alertKindLabel(entry.item.id);
  // A passed legal form shows its typed time, never an age since it (legal times only as typed).
  const legalEnded = legalTypedEnd(entry.item);
  const age =
    legalEnded !== undefined
      ? typedTimeLine(legalEnded, now)
      : entry.raised === undefined
        ? "Time not recorded"
        : `${minutesText(Math.max(0, now - entry.raised))} ago`;
  const owner = entry.mine || entry.owner === "Bed coordinator" ? undefined : `Owned by ${ownerShort(entry.owner)}`;
  const tone = entry.group === "act" ? "danger" : "warning";
  return (
    <section className={p.alert} data-tone={tone} aria-label="Chosen alert" data-testid="home-chosen-alert">
      <StatusGlyph tone={tone} size={9} />
      <div className={p.alertText}>
        <p className={p.alertTitle}>{entry.item.title}</p>
        <p className={p.alertDetail}>
          {alertDetail(entry.item)}
          {/* A passed legal form's detail is its typed time; the tag says no legal limit was checked. */}
          {legalEnded !== undefined ? (
            <>
              {" "}
              <LegalLimitsNotChecked variant="tag" />
            </>
          ) : null}
        </p>
        <p className={p.alertMeta}>{[kindLabel, age, owner].filter(Boolean).join(" · ")}</p>
      </div>
    </section>
  );
}
