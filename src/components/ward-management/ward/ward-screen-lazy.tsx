"use client";

// The ward screen's client-only sections, each loaded when first needed. Split out of
// `ward-screen.tsx` (18 October 2026) to keep that file under the line cap.

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { wardRouteUnitId } from "../ward-chrome-role";
import { useWardFlowSelect } from "../ward-flow-provider";
import { recordIdFromParam } from "../shell/ward-record-address";
import { useOptionalSearchParams } from "./ward-screen-helpers";

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
  () => import("@/components/ward-management/board/ward-daily-sheet").then((m) => m.WardDailySheetDialog),
  { ssr: false },
);
export const WardBedDossierDrawer = dynamic(
  () => import("./ward-bed-dossier-drawer").then((m) => m.WardBedDossierDrawer),
  {
    ssr: false,
  },
);
export const WardNotificationCenter = dynamic(
  () => import("./ward-notification-center").then((m) => m.WardNotificationCenter),
  { ssr: false },
);
const WardAnswerView = dynamic(() => import("./ward-answer-view").then((m) => m.WardAnswerView), {
  ssr: false,
  // The loading state keeps the page's one main landmark and one h1; the loaded view replaces it
  // wholesale, so neither is ever duplicated.
  loading: () => (
    <main id="main-content" data-testid="ward-answer-screen">
      <h1>Ward answer</h1>
      <p role="status">Loading ward answer…</p>
    </main>
  ),
});
export const WardDecisionsCockpit = dynamic(
  () => import("./ward-decisions-cockpit").then((m) => m.WardDecisionsCockpit),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardArrivalsCorridor = dynamic(
  () => import("./ward-arrivals-corridor").then((m) => m.WardArrivalsCorridor),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardDischargesMatrix = dynamic(
  () => import("./ward-discharges-matrix").then((m) => m.WardDischargesMatrix),
  {
    ssr: false,
    loading: () => <WardTabBodyPlaceholder />,
  },
);
export const WardBedsMatrix = dynamic(() => import("./ward-beds-matrix").then((m) => m.WardBedsMatrix), {
  ssr: false,
  loading: () => <WardTabBodyPlaceholder />,
});
// Design audit DA-02: the inbox sits above the ward's action bar and its chunk arrives late on a
// phone, so while it loads it holds about the space its cards will take. That keeps the buttons
// below it from moving under a finger. A ward with no entries holds no space, as the inbox shows none.
// Heights are the rendered card's at phone width (header and one entry); a wider screen settles shorter.
// The holder is a plain hidden box, not a named section: a screen reader must not meet an empty
// "Ward referral inbox" before the real one arrives (overall review, 20 Oct 2026).
const INBOX_HEADER_REM = 3;
const INBOX_ENTRY_REM = 10.5;
function WardReferralInboxPlaceholder() {
  const unitId = wardRouteUnitId(usePathname() ?? "");
  const { wardReferralInbox } = useWardFlowSelect("wardReferralInbox");
  const count = unitId ? (wardReferralInbox?.(unitId)?.length ?? 0) : 0;
  if (!count) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="ward-referral-inbox-placeholder"
      style={{ minBlockSize: `${INBOX_HEADER_REM + count * INBOX_ENTRY_REM}rem` }}
    />
  );
}
// Client-only like the other ward sections below; it renders nothing until the store has entries.
export const WardReferralInbox = dynamic(
  () => import("../referrals/ward-referral-inbox").then((m) => m.WardReferralInbox),
  {
    ssr: false,
    loading: () => <WardReferralInboxPlaceholder />,
  },
);
// Shown only after a confirmed discharge, so it loads when first needed.
export const WardDischargeNotices = dynamic(
  () => import("./ward-discharge-notices").then((m) => m.WardDischargeNotices),
  {
    ssr: false,
  },
);
export const WardBedBoard = dynamic(() => import("./ward-bed-board").then((m) => m.WardBedBoard), {
  ssr: false,
  loading: () => <WardTabBodyPlaceholder />,
});

/** Notices option A (22 Oct 2026): a Notices row names its request in `?movement=`, so the Answer view
 * opens on that patient, not the oldest. Read on the ward page, which already reads its query. */
export function WardAnswerFromLink({ unitId }: { unitId: string }) {
  const named = recordIdFromParam(useOptionalSearchParams()?.get("movement"));
  return <WardAnswerView unitId={unitId} initialMovementId={named ?? undefined} />;
}
