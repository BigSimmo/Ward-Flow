import { isRecoverableReferralDraft } from "./referral-draft-validation";
import { referralRecoverySaved } from "./referral-draft-cache";
import { readSessionDraft } from "../ward-session-drafts";

type OnScreenDraft = { documentation?: { charts?: readonly unknown[] }; needsChartReattachment?: boolean };

/**
 * P158 (Josh, 27 Oct 2026): true only when a reload would bring back exactly what is on screen, so
 * the browser's own "Reload site?" prompt can be skipped. The session copy must be saved, valid and
 * identical to the screen, and no charts may be attached (attachment bytes are never kept).
 */
export function referralDraftKeptOnScreen(storageKey: string | undefined, draft: OnScreenDraft): boolean {
  if (!storageKey || !draft.documentation || (draft.documentation.charts?.length ?? 0) > 0) return false;
  if (!referralRecoverySaved()) return false;
  const raw = readSessionDraft(storageKey);
  if (raw === null) return false;
  try {
    if (!isRecoverableReferralDraft(JSON.parse(raw))) return false;
  } catch {
    return false;
  }
  // The same projection keepReferralDraft writes for a draft without charts.
  const projection = {
    ...draft,
    documentation: { ...draft.documentation, charts: [] },
    needsChartReattachment: !!draft.needsChartReattachment,
  };
  return JSON.stringify(projection) === raw;
}
