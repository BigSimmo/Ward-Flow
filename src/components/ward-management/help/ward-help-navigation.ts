/** Use the shell confirmation, including its deferred Leave callback. */
export function confirmHelpNavigation(proceed: () => void): void {
  const confirm = (window as typeof window & { __wardFlowConfirmNavigation?: (proceed?: () => void) => boolean })
    .__wardFlowConfirmNavigation;
  if (!confirm || confirm(proceed)) proceed();
}
