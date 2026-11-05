/**
 * WF-31: route-scoped display preferences. Depth lives in theme-client so writers can check it
 * without pulling this module into the shared shell chunk; enter/baseline stay here for the
 * statistics session (dynamic import) and tests.
 */
import { adjustDisplayPrefScopeDepth, displayPrefScopeActive, resetDisplayPrefScopeForTests } from "./theme-client";
import type { ThemePreference } from "./theme";

export type DisplayPrefBaseline = {
  theme: ThemePreference;
  glare: boolean;
  railOpen: boolean;
};

let baseline: DisplayPrefBaseline | null = null;
let depth = 0;

export { displayPrefScopeActive };

export function enterDisplayPrefScope(snap: DisplayPrefBaseline): () => DisplayPrefBaseline | null {
  if (depth === 0) baseline = snap;
  depth += 1;
  adjustDisplayPrefScopeDepth(1);
  let disposed = false;
  return () => {
    if (disposed) return null;
    disposed = true;
    depth = Math.max(0, depth - 1);
    adjustDisplayPrefScopeDepth(-1);
    if (depth > 0) return null;
    const out = baseline;
    baseline = null;
    return out;
  };
}

export function resetDisplayPrefScopeModuleForTests() {
  depth = 0;
  baseline = null;
  resetDisplayPrefScopeForTests();
}
