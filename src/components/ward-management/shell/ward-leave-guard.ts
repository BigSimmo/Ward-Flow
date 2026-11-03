// The shell's unsaved-changes question, in its own file so the lazy desk switcher can ask it
// without importing the bar (which would loop back through the phone Menu to the switcher).
/**
 * Audit 7 NB-06: the phone Back is a button, so the unsaved-changes guard's link listener never sees
 * it. With no Ward Flow history it replaces the page, and a half-typed form was dropped without the
 * question the desktop Back link asks. Ask the same mounted guards first.
 */
export function confirmLeavingShell(proceed?: () => void): boolean {
  if (typeof window === "undefined") return true;
  // With the kit's styled confirm mounted, the guard returns false at once, asks, and on Leave
  // without saving runs `proceed`, which passes this check once. Without it, the browser asks.
  const confirmNavigation = (
    window as typeof window & { __wardFlowConfirmNavigation?: (proceed?: () => void) => boolean }
  ).__wardFlowConfirmNavigation;
  return confirmNavigation ? confirmNavigation(proceed) : true;
}
