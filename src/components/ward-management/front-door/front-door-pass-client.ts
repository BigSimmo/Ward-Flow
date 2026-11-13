/**
 * The page's side of the front door's pass (`@/lib/front-door-pass`), and the one place Ward Flow
 * calls `/api/session`. Only a site with the front door switched on has the readable marker cookie,
 * so every other site makes no request from the renew and end calls. Both are best effort: the
 * server is the one that refuses a missing pass.
 */

const MARKER = "wf_door=1";

/**
 * Live audit item 19: sign-out removes the marker, so this tab remembers having seen it. A sign-in
 * in the app after an idle sign-out then still renews the pass.
 */
let markerSeen = false;

function frontDoorOn(): boolean {
  if (markerSeen) return true;
  try {
    markerSeen = document.cookie.split(/;\s*/).includes(MARKER);
  } catch {
    // Cookies blocked: no marker to read.
  }
  return markerSeen;
}

/**
 * The sign-in page asks for a pass with a sign-in token or the demo code. Null when the request
 * never reached the server.
 */
export async function requestFrontDoorPass(body: { token: string } | { demoCode: string }): Promise<Response | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, 15_000);
  });
  const request = (async () => {
    const response = await fetch("/api/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Include the body in the deadline: headers alone do not complete a refused sign-in.
    const text = await response.text();
    return new Response(text || null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  })().catch(() => null);
  try {
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
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

/**
 * At sign-out, an idle sign-out or the sign-in limit, end the pass too. Survives the page closing.
 * Resolves once the server has answered, or after `END_PASS_DEADLINE_MS`, so Leave the demo can wait
 * before opening the sign-in page without hanging on a stuck request. True when the server confirmed
 * the pass ended (or no front door is on); false on an error reply, a network failure or the
 * deadline. A sign-out ignores the result: the pass still ends at its own time.
 */
export const END_PASS_DEADLINE_MS = 8_000;

export function endFrontDoorPass(): Promise<boolean> {
  if (!frontDoorOn()) return Promise.resolve(true);
  try {
    // The server's reply removes the marker with the pass (live audit item 19). keepalive lets the
    // request finish if the page closes; the deadline only stops this page waiting for it.
    const request = fetch("/api/session", { method: "DELETE", credentials: "same-origin", keepalive: true }).then(
      (response) => response.ok,
      () => false,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), END_PASS_DEADLINE_MS);
    });
    return Promise.race([request, deadline]).finally(() => clearTimeout(timer));
  } catch {
    // No fetch here: the pass still ends at its own time.
    return Promise.resolve(false);
  }
}
