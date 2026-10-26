// Loads the demonstration networks on demand. Kept apart from `ward-scenario-network-registry.ts`
// so the registry and `ward-scenario-networks.ts` do not import each other.
import { loadedScenarioNetworks } from "./ward-scenario-network-registry";

let loading: Promise<void> | null = null;

/** Loads the demonstration networks once. A failed load (offline, a stale chunk) is retried by the next call. */
export function loadScenarioNetworks(): Promise<void> {
  if (loadedScenarioNetworks()) return Promise.resolve();
  loading ??= import("./ward-scenario-networks").then(
    () => {
      loading = null;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}
