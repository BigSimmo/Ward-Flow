/**
 * Every save problem Ward Flow says on screen, in one shape: what happened, then what to do now
 * (docs/ward-flow/word-list.md, "Save problems"). Screens use these sentences rather than writing
 * their own, so the same problem reads the same everywhere. A refusal that carries the workflow's
 * own reason ("No allocatable bed on this ward.") says that reason instead: it already names what
 * to change.
 */
export type SaveProblem = {
  /** What happened, said first. Says plainly whether the change was kept. */
  happened: string;
  /** What to do now, in one or two short imperative sentences. */
  doNow: string;
};

export const SAVE_PROBLEMS = {
  /** The save has no answer, or was accepted on a board that has since been replaced. */
  notConfirmed: {
    happened: "Save is not confirmed.",
    doNow: "Check the board. If your change is not there, make it again.",
  },
  /** A shared save lost its connection part way. The status bar's Retry resends the same command. */
  connectionLost: {
    happened: "Save is not confirmed.",
    doNow: "Press Retry when you are back online. It will not be saved twice.",
  },
  /** The status bar's line for the same lost connection. */
  mayNotBeSaved: {
    happened: "Your change may not have been saved.",
    doNow: "Press Retry when you are back online. It will not be saved twice.",
  },
  /** Another desk saved this record first (HTTP 409). */
  changedMeanwhile: {
    happened: "This record changed while you were looking. Your action was not applied.",
    doNow: "Check the latest details, then try again.",
  },
  /** The shared workspace is still loading, signed out or offline when the action was asked for. */
  notReady: {
    happened: "The workspace is not connected, so nothing was saved.",
    doNow: "Wait for it to reconnect, or press Retry, then try again.",
  },
  /** A reset or new scenario replaced the board while this action waited its turn. */
  replaced: {
    happened: "The workspace was replaced before this action ran, so nothing was saved.",
    doNow: "Check the current board, then try again.",
  },
  /** The server asked this device to slow down (HTTP 429). */
  busy: {
    happened: "The server is busy. Nothing was saved.",
    doNow: "Try again in a moment.",
  },
  /** A refusal with no reason given. */
  refused: {
    happened: "The action was not applied. Nothing was changed.",
    doNow: "Check the details you entered, then try again.",
  },
  /** A demonstration control on a shared workspace that has them switched off. */
  demoControlsOff: {
    happened: "Demo controls are switched off on the shared workspace. Nothing was changed.",
    doNow: "Ask whoever runs the demonstration to switch them on.",
  },
  /** A return that saves two records, where only one is confirmed. */
  partlySaved: {
    happened: "Part of this return was saved, but the other step is not confirmed.",
    doNow: "Check the board, then record only the step that is missing.",
  },
  /** The shared workspace cannot be reached, so changes are switched off. */
  connectionUnavailable: {
    happened: "Connection unavailable, so changes are switched off.",
    doNow: "Press Retry, or check this device's network.",
  },
  /** A queued action dropped because an earlier one in the queue was refused or lost. */
  queuedCancelled: {
    happened: "This queued action was cancelled, so it was not saved.",
    doNow: "Check the board, then make the change again if it is still needed.",
  },
  /** A queued action dropped because the board could not be read back. */
  queuedNotRefreshed: {
    happened: "This queued action was cancelled because the board could not be refreshed.",
    doNow: "Press Retry to reload the board, then make the change again.",
  },
  /** The shared board could not be read back after a change. */
  notRefreshed: {
    happened: "The shared board could not be refreshed.",
    doNow: "Press Retry to reload it before making changes.",
  },
  /** The working role changed after this action was sent; the server may have kept it. */
  roleChangedWhileSaving: {
    happened: "The working role changed while this action was being saved. It may have been applied.",
    doNow: "Check the board before you make it again, so it is not recorded twice.",
  },
  /** The working role changed before this action was sent. */
  roleChanged: {
    happened: "Your working role changed, so this action was not saved.",
    doNow: "Check the board in your current role, then try again.",
  },
  /** The server ended the working role this action was asked under. */
  roleEnded: {
    happened: "Your working role ended, so this action was not saved.",
    doNow: "Choose your role again, then check the board before trying again.",
  },
  /** The session ended after this action was sent; the server may have kept it. */
  sessionEndedWhileSaving: {
    happened: "The session ended while this action was being saved. It may have been applied.",
    doNow: "Sign in again and check the board before you make it again, so it is not recorded twice.",
  },
  /** The session ended before this action was sent. */
  sessionEnded: {
    happened: "The session ended, so this action was not saved.",
    doNow: "Sign in again, then make the change.",
  },
  /** The page closed its connection (sign-out, leaving shared mode) before this action ran. */
  connectionClosed: {
    happened: "The connection closed, so this action was not saved.",
    doNow: "Reconnect, check the board, then try again.",
  },
  /** The community desk's "Take for this team" did not save. */
  notAssigned: {
    happened: "Not assigned. The change was not saved.",
    doNow: "Try again. If it fails again, press Retry in the status bar.",
  },
} as const satisfies Record<string, SaveProblem>;

export type SaveProblemKind = keyof typeof SAVE_PROBLEMS;

/** One problem as a single on-screen message: what happened, then what to do now. */
export function saveProblem(kind: SaveProblemKind): string {
  const { happened, doNow } = SAVE_PROBLEMS[kind];
  return `${happened} ${doNow}`;
}

/** The action was saved or refused, but the shared board could not be read back afterwards. */
export function boardNotRefreshed(accepted: boolean): string {
  return `The action was ${accepted ? "accepted" : "not applied"}, but the shared board could not be refreshed. Press Retry to reload the board before making more changes.`;
}

/** Said most often: the fallback when a save has no definite answer. */
export const SAVE_NOT_CONFIRMED = saveProblem("notConfirmed");
