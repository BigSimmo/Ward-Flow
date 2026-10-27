/**
 * The page's side of the front door's pass (`@/lib/front-door-pass`), and the one place Ward Flow
 * calls `/api/session`. Only a site with the front door switched on has the readable marker cookie,
 * so every other site makes no request from the renew and end calls. Both are best effort: the
 * server is the one that refuses a missing pass.
 */

const MARKER = "wf_door=1";

function frontDoorOn(): boolean {
  try {
    return document.cookie.split(/;\s*/).includes(MARKER);
  } catch {
    return false;
  }
}

/**
 * The sign-in page asks for a pass with a sign-in token or the demo code. Null when the request
 * never reached the server.
 */
export function requestFrontDoorPass(body: { token: string } | { demoCode: string }): Promise<Response | null> {
  return fetch("/api/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/** After a sign-in in the app (after an idle sign-out, say), ask the server for a fresh pass. */
export async function renewFrontDoorPass(token: () => Promise<string>): Promise<void> {
  if (!frontDoorOn()) return;
  try {
    await requestFrontDoorPass({ token: await token() });
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
