// The demonstration networks, loaded on demand (H-0952). The EMHS and fictional WA-like networks
// (`ward-demo-network.ts`, `ward-wa-synthetic-network.ts`) are only needed once a demonstration
// scenario is chosen or restored, so a phone's first load leaves them out. `ward-scenario-networks.ts`
// registers them when it is imported: the server, the reducer's slices and the tests import it, and
// every browser path that can bring in a demonstration world (the reducer's slices before a local
// command, the saved-session read, the scenario file, the typed-text copy and the shared workspace's
// state check) loads it first. The standard and scarce days never need it.
import type { DemoNetwork, DemoNetworkVariant } from "./ward-demo-network";

export type ScenarioNetworks = {
  demoNetwork: (variant: DemoNetworkVariant) => DemoNetwork;
  waSyntheticNetwork: () => DemoNetwork;
};

let registered: ScenarioNetworks | null = null;
let loading: Promise<void> | null = null;

export function registerScenarioNetworks(networks: ScenarioNetworks): void {
  registered = networks;
}

/** The registered networks, or null before they have loaded. */
export function loadedScenarioNetworks(): ScenarioNetworks | null {
  return registered;
}

/** Loads the demonstration networks once. A failed load (offline, a stale chunk) is retried by the next call. */
export function loadScenarioNetworks(): Promise<void> {
  if (registered) return Promise.resolve();
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
