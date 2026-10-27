// Registers the demonstration networks on import. See `ward-scenario-network-registry.ts`.
// Keep this file out of any static import from page code: a static import puts both networks back
// into a phone's first load. The reducer's slices, server-only modules and the tests import it.
import { demoNetwork } from "./ward-demo-network";
import { registerScenarioNetworks } from "./ward-scenario-network-registry";
import { waSyntheticNetwork } from "./ward-wa-synthetic-network";

registerScenarioNetworks({ demoNetwork, waSyntheticNetwork });
