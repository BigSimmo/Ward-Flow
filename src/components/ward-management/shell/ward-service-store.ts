/**
 * THE SERVICE CHOICE — one module browser store, shared by `WardBar`'s Service selector, `WardRail`
 * (item 52) and every screen a future lane scopes to it (build plan
 * `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2 "Where the choice lives", task S2).
 *
 * Mirrors `ward-bar.tsx`'s own `useAppearanceStore`/`applyAppearance` pair exactly, for the same
 * reason that file's header comment gives for reusing `ward-rail.tsx`'s rail-open store: a
 * `useState` + mount effect trips React's `set-state-in-effect` guard on a browser-only value, and
 * this codebase already has one proven external-store shape for "a preference that must read the
 * same on the server and the client, then correct itself after mount" — reinventing a second one
 * per preference is how two of them quietly drift.
 *
 * **`sessionStorage`, never `localStorage`.** §2 is explicit: the service choice does not outlive
 * the tab. A demo reset also leaves it alone — it is not part of `WARD_FLOW_DEMO_STORAGE_KEY`'s
 * persisted clinical state, and nothing here reads or writes that key.
 *
 * 🔴 **D-11-SAFE BY CONSTRUCTION.** Ward Flow's own rule against typed text in browser storage is
 * satisfied not by masking or trimming, but by never accepting anything BUT a fixed id in the
 * first place: `readStoredService` only ever returns a value that is `===` one of `HEALTH_SERVICES`
 * exactly. Free text, a stale id from a build that renamed a service, or storage tampering, all
 * fall through the same `isHealthService` guard as a plain unset key — see `getServiceScope`'s own
 * comment for why that is "All services", never a thrown error or a guess.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";

export const SERVICE_SCOPE_STORAGE_KEY = "ward-flow-service";
const serviceScopeChangeEvent = "ward-flow-service-change";

// Same shape as `ward-bar.tsx`'s own `appearanceInMemoryFallback`, and for the identical reason:
// private browsing or a full quota still has to leave THIS SESSION's controls agreeing with each
// other, even though the choice will not survive a reload. `undefined` is its own state here —
// "no in-memory override; read storage" — distinct from `null`, which means "override to All
// services" (chosen deliberately, not merely unset).
let serviceInMemoryFallback: HealthService | null | undefined;

function isHealthService(value: string): value is HealthService {
  return (HEALTH_SERVICES as readonly string[]).includes(value);
}

/**
 * Anything that is not `===` one of `HEALTH_SERVICES` — an unset key, a typo, a value written by a
 * future or past build under a service name this one no longer has — reads as `null` (All
 * services). §2: "Anything else reads as All services." This is the ONE place that decides that;
 * every other reader goes through `getServiceScope`/`useServiceScope`, never `sessionStorage`
 * directly, so there is nowhere else this rule could be re-typed and drift from this copy.
 */
function readStoredService(): HealthService | null {
  try {
    const stored = window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY);
    return stored !== null && isHealthService(stored) ? stored : null;
  } catch {
    // A storage read can throw (private browsing in some engines, a disabled storage API). Falling
    // back to null here matches "unreadable" to "unset" — never to whatever the in-memory fallback
    // happened to hold from an earlier, unrelated write in this same session.
    return null;
  }
}

function getServiceScopeSnapshot(): HealthService | null {
  if (serviceInMemoryFallback !== undefined) return serviceInMemoryFallback;
  return readStoredService();
}

function subscribeServiceScope(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(serviceScopeChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(serviceScopeChangeEvent, onChange);
  };
}

/** The one hook every reader (`WardBar`, `WardRail`, a future scoped screen) calls. */
export const useServiceScope = createBrowserStore(subscribeServiceScope, getServiceScopeSnapshot, null);

/**
 * The one writer. Persists to `sessionStorage` under `SERVICE_SCOPE_STORAGE_KEY` alone — `next ===
 * null` REMOVES the key rather than writing a sentinel, which is what keeps "storage holds exactly
 * the chosen service id and nothing else" true for `null` too: no key at all, not an empty string
 * or the literal text "null".
 *
 * A throwing write (quota, private browsing) falls back to `serviceInMemoryFallback`, exactly like
 * `applyAppearance` above — the choice still works for the rest of this session, it just will not
 * survive a reload. A SUCCESSFUL write clears the fallback, so a later successful write (once quota
 * frees up, say) is trusted again rather than a stale in-memory value shadowing real storage
 * forever.
 */
export function setServiceScope(next: HealthService | null): void {
  try {
    if (next === null) {
      window.sessionStorage.removeItem(SERVICE_SCOPE_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SERVICE_SCOPE_STORAGE_KEY, next);
    }
    serviceInMemoryFallback = undefined;
  } catch {
    serviceInMemoryFallback = next;
  }
  window.dispatchEvent(new Event(serviceScopeChangeEvent));
}

/** Test-only reset so one test file's chosen service never leaks into the next — the same job
 *  `resetWardLiveRegionForTests`/`resetWardChecksForTests` already do for their own module stores. */
export function resetServiceScopeForTests(): void {
  try {
    window.sessionStorage.removeItem(SERVICE_SCOPE_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage itself is unreachable.
  }
  serviceInMemoryFallback = undefined;
  window.dispatchEvent(new Event(serviceScopeChangeEvent));
}
