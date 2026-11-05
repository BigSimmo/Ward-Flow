/**
 * WF-31: route-scoped display preferences. While a scope is open, theme / glare / rail writers
 * apply in memory only and must not touch localStorage or cookies. Restoring the baseline is the
 * caller's job (statistics layout) once the last scope exits.
 */
import type { ThemePreference } from "./theme";

export type DisplayPrefBaseline = {
  theme: ThemePreference;
  glare: boolean;
  railOpen: boolean;
};

let depth = 0;
let baseline: DisplayPrefBaseline | null = null;

export function displayPrefScopeActive(): boolean {
  return depth > 0;
}

export function enterDisplayPrefScope(snap: DisplayPrefBaseline): () => DisplayPrefBaseline | null {
  if (depth === 0) baseline = snap;
  depth += 1;
  let disposed = false;
  return () => {
    if (disposed) return null;
    disposed = true;
    depth = Math.max(0, depth - 1);
    if (depth > 0) return null;
    const out = baseline;
    baseline = null;
    return out;
  };
}

export function resetDisplayPrefScopeForTests() {
  depth = 0;
  baseline = null;
}
