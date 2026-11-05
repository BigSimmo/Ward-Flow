import { requestConfirm } from "@/components/wf";

/** Forced expiry never waits for an answer; a failed prompt keeps a voluntary session open. */
export async function allowWardSignOut(
  pending: boolean,
  forced: boolean,
  ask: () => Promise<boolean> = () =>
    requestConfirm({
      title: "Sign out with changes waiting?",
      message:
        "Some changes are not confirmed. Signing out clears changes waiting on this page. A change already sent may still have been saved. Review the board before repeating it.",
      confirmLabel: "Sign out",
      cancelLabel: "Stay here",
    }),
): Promise<boolean> {
  if (!pending || forced) return true;
  try {
    return await ask();
  } catch {
    return false;
  }
}
