/** The roles, cover and requests the access routes list, split from ward-shared-client.ts. */
/** A role or cover as the server lists it. Times are minutes from the server's now. */
export type SharedMembership = {
  id: string;
  actorId: string;
  role: string;
  scope: unknown;
  kind: "role" | "cover";
  grantedBy: string;
  approved: boolean;
  approvedBy: string | null;
  minutes: { granted: number | null; expires: number | null; lastUsed: number | null };
};
/** A request for access as the server lists it. */
export type SharedAccessRequest = {
  id: string;
  actorId: string;
  role: string;
  scope: unknown;
  decision: "approved" | "declined" | null;
  minutes: { requested: number | null };
};
