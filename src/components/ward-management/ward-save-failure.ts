/**
 * Every save problem Ward Flow says on screen, in one shape: what happened, then what to do now
 * (docs/ward-flow/word-list.md, "Save problems"). Screens use these sentences rather than writing
 * their own, so the same problem reads the same everywhere. A refusal that carries the workflow's
 * own reason ("No allocatable bed on this ward.") says that reason instead: it already names what
 * to change. Kept short and built from shared phrases: this list ships on every phone page.
 */
/** [what happened, what to do now]. */
export type SaveProblem = readonly [happened: string, doNow: string];

const NOT_CONFIRMED = "Save is not confirmed.";
const RETRY = "Press Retry when you are back online. It will not be saved twice.";
const CHECK = "Check the board, then try again.";
/** Not sent yet: definitely not saved. */
const unsent = (why: string, doNow = CHECK): SaveProblem => [`${why}, so this action was not saved.`, doNow];
/** Already sent: the server may have applied it, so never say "not saved". */
const sent = (why: string): SaveProblem => [
  `${why} while this action was being saved. It may have been applied.`,
  "Check the board before you make it again, so it is not recorded twice.",
];

export const SAVE_PROBLEMS = {
  /** The save has no answer, or was accepted on a board that has since been replaced. */
  notConfirmed: [NOT_CONFIRMED, "Check the board. If your change is not there, make it again."],
  /** A shared save lost its connection part way. The status bar's Retry resends the same command. */
  connectionLost: [NOT_CONFIRMED, RETRY],
  /** The status bar's line for the same lost connection. */
  mayNotBeSaved: ["Your change may not have been saved.", RETRY],
  /** Another desk saved this record first (HTTP 409). */
  changedMeanwhile: [
    "This record changed while you were looking. Your action was not applied.",
    "Check the latest details, then try again.",
  ],
  /** The shared workspace is still loading, signed out or offline when the action was asked for. */
  notReady: unsent("The workspace is not connected", "Wait for it to reconnect, then try again."),
  /** A reset or new scenario replaced the board while this action waited its turn. */
  replaced: unsent("The workspace was replaced first"),
  /** The server asked this device to slow down (HTTP 429). */
  busy: ["The server is busy. Nothing was saved.", "Try again in a moment."],
  /** A refusal with no reason given. */
  refused: ["The action was not applied. Nothing was changed.", "Check the details you entered, then try again."],
  /** A demonstration control on a shared workspace that has them switched off. */
  demoControlsOff: [
    "Demo controls are switched off on the shared workspace. Nothing was changed.",
    "Ask whoever runs the demonstration to switch them on.",
  ],
  /** A return that saves two records, where only one is confirmed. */
  partlySaved: [
    "Part of this return was saved, but the other step is not confirmed.",
    "Check the board, then record only the missing step.",
  ],
  /** The shared workspace cannot be reached, so changes are switched off. */
  connectionUnavailable: ["Connection unavailable, so changes are switched off.", "Press Retry, or check the network."],
  /** A queued action dropped because an earlier one was refused or lost. */
  queuedCancelled: unsent("This queued action was cancelled"),
  /** A queued action dropped because the board could not be read back. */
  queuedNotRefreshed: unsent("The board could not be refreshed", "Press Retry to reload it, then try again."),
  /** The shared board could not be read back after a change. */
  notRefreshed: ["The shared board could not be refreshed.", "Press Retry to reload it before making changes."],
  /** The working role changed after this action was sent. */
  roleChangedWhileSaving: sent("The working role changed"),
  /** The working role changed before this action was sent. */
  roleChanged: unsent("Your working role changed"),
  /** The server ended the working role this action was asked under. */
  roleEnded: unsent("Your working role ended", "Choose your role again, then check the board."),
  /** The session ended after this action was sent. */
  sessionEndedWhileSaving: sent("The session ended"),
  /** The session ended before this action was sent. */
  sessionEnded: unsent("The session ended", "Sign in again, then make the change."),
  /** The page closed its connection (sign-out, leaving shared mode) before this action ran. */
  connectionClosed: unsent("The connection closed"),
  /** The community desk's "Take for this team" did not save. */
  notAssigned: ["Not assigned. The change was not saved.", "Try again, or press Retry in the status bar."],
} as const satisfies Record<string, SaveProblem>;

export type SaveProblemKind = keyof typeof SAVE_PROBLEMS;

/** One problem as a single on-screen message: what happened, then what to do now. */
export const saveProblem = (kind: SaveProblemKind): string => SAVE_PROBLEMS[kind].join(" ");

/** The action was saved or refused, but the shared board could not be read back afterwards. */
export const boardNotRefreshed = (accepted: boolean): string =>
  `The action was ${accepted ? "accepted" : "not applied"}, but the shared board could not be refreshed. Press Retry to reload it before making more changes.`;

/** Said most often: the fallback when a save has no definite answer. */
export const SAVE_NOT_CONFIRMED = saveProblem("notConfirmed");
