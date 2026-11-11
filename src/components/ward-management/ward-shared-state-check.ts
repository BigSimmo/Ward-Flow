// Lazy schema keeps the phone budget; the shared client refuses snapshots until validation has
// loaded. Moved out of ward-shared-client.ts unchanged (10 Nov 2026) to keep that file under its cap;
// the client reads these as live bindings.
export let isValidSharedState: ((value: unknown) => boolean) | undefined;
export let bindSharedPartialView: typeof import("./ward-partial-view-contract").bindWardPartialView | undefined;
export let mergeSharedPartialView:
  typeof import("./ward-partial-view-contract").mergeArchivedWardPartialView | undefined;
export function loadSharedStateCheck(): Promise<void> {
  if (isValidSharedState && bindSharedPartialView && mergeSharedPartialView) return Promise.resolve();
  // A shared world may be a demonstration scenario, whose wards its check and screens read.
  return Promise.all([
    import("./ward-shared-state-validation"),
    import("./ward-partial-view-contract"),
    import("./ward-scenario-networks"),
  ]).then(([state, partialView]) => {
    isValidSharedState = state.isValidSharedWardFlowState;
    bindSharedPartialView = partialView.bindWardPartialView;
    mergeSharedPartialView = partialView.mergeArchivedWardPartialView;
  });
}
