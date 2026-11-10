import type { DoorBannerIcon, DoorBannerTone } from "./front-door-parts";

export type FrontDoorNotice = { tone: DoorBannerTone; icon: DoorBannerIcon; title: string; body: string | null };

/** What the front door says after a deliberate sign-out. The app's sign-out sets it. */
export const SIGNED_OUT_NOTICE = "You have signed out. On a shared computer, close the browser too.";

/**
 * TE-03 (audit, 5 Nov 2026): Sign out with unconfirmed changes asks first, but when that question's
 * code cannot load (offline) the sign-out still goes ahead, and the front door says what was cleared.
 */
export const SIGNED_OUT_UNCONFIRMED_NOTICE =
  "You have signed out. Changes not yet confirmed on this page were cleared, and a change already sent may still have been saved. Check the board after you sign in. On a shared computer, close the browser too.";

/**
 * D-125 (audit M8 gap A): added after the reason when the session limit or a refused session signs
 * the person out while changes were still waiting or held in an Undo window. Forced expiry never
 * waits, so those were dropped. It names no record.
 */
export const UNSENT_CHANGES_DROPPED_NOTICE =
  "Changes still waiting on this page were not saved, and a change already sent may still have been saved. Check the board after you sign in.";

/**
 * Why the sign-in screen is showing, as one banner: the reason the app gave when it signed this
 * tab out (an idle sign-out, another tab, the sign-in limit, a refused sign-in). The first sentence
 * is the banner's title and the rest its body, so the app's own words reach the screen unchanged.
 */
export function frontDoorNotice(message: string | null | undefined): FrontDoorNotice | null {
  const text = message?.trim();
  if (!text) return null;
  const split = text.search(/[.!?]\s/);
  const title = split === -1 ? text : text.slice(0, split + 1);
  const body = split === -1 ? null : text.slice(split + 2).trim() || null;
  if (text === SIGNED_OUT_NOTICE) return { tone: "success", icon: "check", title, body };
  if (/without use/i.test(text)) return { tone: "info", icon: "lock", title, body };
  if (/limit|hours?\b|expired/i.test(text)) return { tone: "info", icon: "clock", title, body };
  return { tone: "info", icon: "info", title, body };
}
