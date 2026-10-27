import { createContext } from "react";

/**
 * The signed-in shared workspace's session, for the idle lock and the record access log. Absent in
 * the local demo. Its own module, so the shell can read it without importing the shared client.
 */
/** The screens a record view names: a patient or movement page, or a referral's full detail (D-80). */
export type RecordViewSurface = "patient" | "movement" | "referral";

export type SharedSession = {
  /**
   * Signs out here and on the server, so the sign-in's token is refused at once (review item 8).
   * With a `reason`, only this tab signs out and the sign-in screen says why.
   */
  signOut: (reason?: string) => void;
  /**
   * Tells the server this desk opened a patient's record (review item 9). Best effort. Settles once
   * the server's reply is taken: true when it sent the record's detail (H-0731) and it is shown.
   */
  logRecordView: (patientId: string, surface: RecordViewSurface) => Promise<boolean> | void;
};

export const SharedSessionContext = createContext<SharedSession | null>(null);
