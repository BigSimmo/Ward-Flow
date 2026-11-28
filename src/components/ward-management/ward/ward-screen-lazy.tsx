"use client";

// The ward screen's client-only sections, each loaded when first needed. Split out of
// `ward-screen.tsx` (18 October 2026) to keep that file under the line cap.

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { usePathname } from "next/navigation";
import { StateLine } from "@/components/wf";
import { preloadWhenIdle } from "../preload-when-idle";
import { wardRouteUnitId } from "../ward-chrome-role";
import { useWardFlowSelect } from "../ward-flow-provider";
import { recordIdFromParam } from "../shell/ward-record-address";
import { useOptionalSearchParams } from "./ward-screen-helpers";
import styles from "./ward.module.css";

// PERF-05 (21 Oct 2026): each ward tab body below arrives as its own chunk, which is slow on a
// phone. Until it does, hold most of a screen so the tab bar and action bar do not jump, and say
// "Loading" to a screen reader only. The loaded tab replaces this box wholesale.
function WardTabBodyPlaceholder() {
  return (
    <div aria-busy="true" data-testid="ward-tab-body-placeholder" style={{ minBlockSize: "60dvh" }}>
      <p className="sr-only" role="status">
        Loading…
      </p>
    </div>
  );
}

export const WardDailySheetDialog = dynamic(
  withLoadRetry(() =>
    import("@/components/ward-management/board/ward-daily-sheet").then((m) => m.WardDailySheetDialog),
  ),
  { ssr: false },
);
// Printing can start before an asynchronous chunk arrives, including from the browser menu.
// Keep the paper table available with the ward page's first render.
export { WardBedListPrint } from "./ward-bed-list-print";
export const WardBedDossierDrawer = dynamic(
  withLoadRetry(() => import("./ward-bed-dossier-drawer").then((m) => m.WardBedDossierDrawer)),
  {
    ssr: false,
  },
);
export const WardNotificationCenter = dynamic(
  withLoadRetry(() => import("./ward-notification-center").then((m) => m.WardNotificationCenter)),
  { ssr: false },
);
const WardAnswerView = dynamic(
  withLoadRetry(() => import("./ward-answer-view").then((m) => m.WardAnswerView)),
  {
    ssr: false,
    // The loading state keeps the page's one main landmark and one h1; the loaded view replaces it
    // wholesale, so neither is ever duplicated.
    loading: () => (
      <main id="main-content" data-testid="ward-answer-screen">
        <h1>Ward answer</h1>
        <StateLine kind="loading" title="Loading ward answer" />
      </main>
    ),
  },
);
export const WardDecisionsCockpit = dynamic(
  withLoadRetry(() => import("./ward-decisions-cockpit").then((m) => m.WardDecisionsCockpit)),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardArrivalsCorridor = dynamic(
  withLoadRetry(() => import("./ward-arrivals-corridor").then((m) => m.WardArrivalsCorridor)),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardDischargesMatrix = dynamic(
  withLoadRetry(() => import("./ward-discharges-matrix").then((m) => m.WardDischargesMatrix)),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardBedsMatrix = dynamic(
  withLoadRetry(() => import("./ward-beds-matrix").then((m) => m.WardBedsMatrix)),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
// Design audit DA-02: the inbox sits above the ward's action bar and its chunk arrives late on a
// phone, so while it loads it holds about the space its cards will take. That keeps the buttons
// below it from moving under a finger. A ward with no entries holds no space, as the inbox shows none.
// The header and per-card heights live in ward.module.css (.inboxPlaceholder) by screen width:
// H-0890 (26 Oct 2026) measured the old single 3rem + 10.5rem per card as 134px short on a phone
// and 42px short on an iPad, which moved the whole ward page down as the inbox arrived.
// The holder is a plain hidden box, not a named section: a screen reader must not meet an empty
// "Ward referral inbox" before the real one arrives (overall review, 20 Oct 2026).
function WardReferralInboxPlaceholder() {
  const unitId = wardRouteUnitId(usePathname() ?? "");
  const { wardReferralInbox } = useWardFlowSelect("wardReferralInbox");
  const count = unitId ? (wardReferralInbox?.(unitId)?.length ?? 0) : 0;
  if (!count) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="ward-referral-inbox-placeholder"
      className={styles.inboxPlaceholder}
      style={{ "--inbox-entries": count } as CSSProperties}
    />
  );
}
// Client-only like the other ward sections below; it renders nothing until the store has entries.
export const WardReferralInbox = dynamic(
  withLoadRetry(() => import("../referrals/ward-referral-inbox").then((m) => m.WardReferralInbox)),
  {
    ssr: false,
    loading: () => <WardReferralInboxPlaceholder />,
  },
);
// The capacity confirmation dialog is closed at first paint, so it loads when the browser is idle.
const loadConfirmBeds = () => import("./ward-confirm-beds-dialog");
export const WardConfirmBedsDialog = dynamic(
  withLoadRetry(() => loadConfirmBeds().then((m) => m.WardConfirmBedsDialog)),
  {
    ssr: false,
  },
);
preloadWhenIdle(loadConfirmBeds);
// Phone budget: Catch-up after the outage (Batch 4 item 25, D-142) renders nothing until an outage
// is recorded, so it stays off the ward's first load and is fetched when the browser is idle.
const loadOutageCatchUp = () => import("./ward-outage-catch-up-card");
export const WardOutageCatchUpCard = dynamic(
  withLoadRetry(() => loadOutageCatchUp().then((m) => m.WardOutageCatchUpCard)),
  {
    ssr: false,
  },
);
preloadWhenIdle(loadOutageCatchUp);
// Phone budget (PR #1742): Since yesterday draws only inside the Updates chip's sheet, so it stays off
// the ward's first load and is fetched when the browser is idle.
const loadSinceYesterday = () => import("./ward-since-yesterday");
export const WardSinceYesterday = dynamic(
  withLoadRetry(() => loadSinceYesterday().then((m) => m.WardSinceYesterday)),
  {
    ssr: false,
  },
);
preloadWhenIdle(loadSinceYesterday);
// Shown only after a confirmed discharge, so it loads when first needed.
export const WardDischargeNotices = dynamic(
  withLoadRetry(() => import("./ward-discharge-notices").then((m) => m.WardDischargeNotices)),
  {
    ssr: false,
  },
);
export const WardBedBoard = dynamic(
  withLoadRetry(() => import("./ward-bed-board").then((m) => m.WardBedBoard)),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);

/** The embedded answer's loading state: the kit's quiet state line (glyph and one sentence), held to
 * about the height of a request card so the cards below do not jump when it arrives. */
function WardAnswerLoading() {
  return (
    <div aria-busy="true" data-testid="ward-answer-loading" style={{ minBlockSize: "8rem" }}>
      <StateLine kind="loading" title="Loading bed requests" />
    </div>
  );
}

/** Notices option A (22 Oct 2026): a Notices row names its request in `?movement=`, so the Answer view
 * opens on that patient, not the oldest. Read on the ward page, which already reads its query. */
/** Simplification 26 Nov 2026 (area 3, item 2): the same answer, drawn in the Referrals tab. */
const WardAnswerEmbedded = dynamic(
  withLoadRetry(() => import("./ward-answer-view").then((m) => m.WardAnswerView)),
  { ssr: false, loading: () => <WardAnswerLoading /> },
);
export function WardAnswerInReferrals({ unitId, movementId }: { unitId: string; movementId?: string }) {
  return <WardAnswerEmbedded unitId={unitId} initialMovementId={movementId} embedded />;
}

export function WardAnswerFromLink({ unitId }: { unitId: string }) {
  const named = recordIdFromParam(useOptionalSearchParams()?.get("movement"));
  return <WardAnswerView unitId={unitId} initialMovementId={named ?? undefined} />;
}

export const WardPlannedAdmissionsPanel = dynamic(
  withLoadRetry(() => import("../capacity/planned-admissions-panel").then((m) => m.PlannedAdmissionsPanel)),
  { loading: () => <StateLine kind="loading" compact title="Loading planned admissions" /> },
);
// Fold the Bed board into Ward (Josh's approved version, item 13; design plan 26 Nov 2026): the
// board's Worth a look prompts and Before handover band, in Decisions, loaded when first opened.
export const WardBoardPart = dynamic(
  withLoadRetry(() => import("@/components/ward-management/board/ward-board").then((m) => m.WardBoard)),
  {
    ssr: false,
    // Review fix: a quiet kit state line while the part loads, never an empty gap that then jumps.
    loading: () => <StateLine kind="loading" compact title="Loading" reason="Long stays and Before handover" />,
  },
);
