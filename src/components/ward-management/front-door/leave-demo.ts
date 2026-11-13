import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import { FRONT_DOOR_SIGN_IN_PATH } from "@/lib/front-door-pass";

const END_PASS_WAIT_MS = 5_000;

/**
 * Leave the demo (audit 22, D-88): end this browser's demo pass, clear what the demo saved here,
 * then go to the front door. The pass is ended first, and waited for, so the front door does not
 * open straight back into the demo. A site without the front door sends `/sign-in` on to Ward Flow,
 * which then starts a fresh demo. Best effort: a pass that cannot be ended still ends at its own time.
 */
export async function leaveWardFlowDemo(go: (href: string) => void = (href) => window.location.assign(href)) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fetch("/api/session", { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => null),
      new Promise((resolve) => {
        timer = setTimeout(resolve, END_PASS_WAIT_MS);
      }),
    ]);
  } catch {
    // No fetch here: carry on and clear this browser.
  } finally {
    clearTimeout(timer);
  }
  endWardFlowBrowserSession();
  go(FRONT_DOOR_SIGN_IN_PATH);
}
