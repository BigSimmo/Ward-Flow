"use client";

// The ward screen's client-only sections, each loaded when first needed. Split out of
// `ward-screen.tsx` (18 October 2026) to keep that file under the line cap.

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { wardRouteUnitId } from "../ward-chrome-role";
import { useWardFlowSelect } from "../ward-flow-provider";

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
export const WardAnswerView = dynamic(() => import("./ward-answer-view").then((m) => m.WardAnswerView), {
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
  },
);
export const WardArrivalsCorridor = dynamic(
  () => import("./ward-arrivals-corridor").then((m) => m.WardArrivalsCorridor),
  {
    ssr: false,
  },
);
export const WardDischargesMatrix = dynamic(
  () => import("./ward-discharges-matrix").then((m) => m.WardDischargesMatrix),
  {
    ssr: false,
  },
);
export const WardBedsMatrix = dynamic(() => import("./ward-beds-matrix").then((m) => m.WardBedsMatrix), { ssr: false });
// Design audit DA-02: the inbox sits above the ward's action bar and its chunk arrives late on a
// phone, so while it loads it holds about the space its cards will take. That keeps the buttons
// below it from moving under a finger. A ward with no entries holds no space, as the inbox shows none.
// Heights are the rendered card's at phone width (header and one entry); a wider screen settles shorter.
const INBOX_HEADER_REM = 3;
const INBOX_ENTRY_REM = 10.5;
function WardReferralInboxPlaceholder() {
  const unitId = wardRouteUnitId(usePathname() ?? "");
  const { wardReferralInbox } = useWardFlowSelect("wardReferralInbox");
  const count = unitId ? (wardReferralInbox?.(unitId)?.length ?? 0) : 0;
  if (!count) return null;
  return (
    <section
      aria-label="Ward referral inbox"
      aria-busy="true"
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
export const WardBedBoard = dynamic(() => import("./ward-bed-board").then((m) => m.WardBedBoard), { ssr: false });
