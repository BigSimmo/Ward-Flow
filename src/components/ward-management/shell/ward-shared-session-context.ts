import { createContext } from "react";

/**
 * The signed-in shared workspace's session, for the idle lock and the record access log. Absent in
 * the local demo. Its own module, so the shell can read it without importing the shared client.
 */
export type SharedSession = {
  /** Signs out here and on the server, so the sign-in's token is refused at once (review item 8). */
  signOut: () => void;
  /** Tells the server this desk opened a patient's record (review item 9). Best effort. */
  logRecordView: (patientId: string, surface: "patient" | "movement") => void;
};

export const SharedSessionContext = createContext<SharedSession | null>(null);
