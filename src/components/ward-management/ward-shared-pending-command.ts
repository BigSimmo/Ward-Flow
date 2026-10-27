import type { WardFlowEvent } from "./ward-flow-events";

/** A command waiting to be sent to the shared workspace (split from ward-shared-client.ts for its size limit). */
export type PendingCommand = {
  dataMode: "prototype";
  classification: "synthetic";
  commandId: string;
  expectedRevision: number;
  /** Records the popups have seen at a later revision than `expectedRevision`, by token. */
  seen?: Record<string, number>;
  event: WardFlowEvent;
  /** Asked for while more commands are queued: an accepted reply then carries no snapshot. */
  reply?: "revision";
};
