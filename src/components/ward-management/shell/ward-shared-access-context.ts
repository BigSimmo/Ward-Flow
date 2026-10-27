"use client";

/**
 * The signed-in shared workspace's access calls, for the Access tab and the break glass panel.
 * Absent in the local demo. Kept apart from the Access tab's code so the shell can read it
 * without loading that tab.
 */
import { createContext } from "react";

import type { SharedWorkspaceClient } from "../ward-shared-client";

/** The shared workspace's access calls (`SharedWorkspaceClient`). */
export type SharedAccessApi = Pick<
  SharedWorkspaceClient,
  | "listAccess"
  | "listCovers"
  | "listRecordViews"
  | "grantAccess"
  | "revokeAccess"
  | "giveCover"
  | "decideRequest"
  | "breakGlass"
> &
  /** D-80 item 14: the coordinator's record views and break glass openings. Proposal 013: the desk's forecast history. */
  Partial<Pick<SharedWorkspaceClient, "readRecordAccess" | "forecastHistory">>;

export const SharedAccessContext = createContext<{ api: SharedAccessApi; actorId: string | null } | null>(null);
