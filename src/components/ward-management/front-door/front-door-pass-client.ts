/**
 * The page's side of the front door's pass (`@/lib/front-door-pass`). Only a site with the front
 * door switched on has the readable marker cookie, so every other site makes no request here.
 * Both calls are best effort: the server is the one that refuses a missing pass.
 */

const MARKER = "wf_door=1";

function frontDoorOn(): boolean {
  try {
    return document.cookie.split(/;\s*/).includes(MARKER);
  } catch {
    return false;
  }
}

/** After a sign-in in the app (after an idle sign-out, say), ask the server for a fresh pass. */
export async function renewFrontDoorPass(token: () => Promise<string>): Promise<void> {
  if (!frontDoorOn()) return;
  try {
    await fetch("/api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: await token() }),
    });
  } catch {
    // The next page load sends the visitor to the sign-in page, which asks again.
  }
}

/** At sign-out, an idle sign-out or the sign-in limit, end the pass too. Survives the page closing. */
export function endFrontDoorPass(): void {
  if (!frontDoorOn()) return;
  try {
    void fetch("/api/session", { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {});
  } catch {
    // No fetch here: the pass still ends at its own time.
  }
}
