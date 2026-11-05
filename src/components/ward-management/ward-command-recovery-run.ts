import {
  readCommandRecovery,
  writeCommandRecovery,
  type RecoveryEntry,
  type RecoveryResult,
} from "./ward-command-recovery";
import type { SharedSnapshot, SharedView } from "./ward-shared-client-types";
import { SAVE_PROBLEMS } from "./ward-save-failure";

type RecoveryReply = {
  snapshot?: SharedSnapshot;
  access?: unknown;
  accessUntil?: number;
  receipt?: { outcome?: RecoveryResult["outcome"]; commandRevision?: number } | null;
};
type RecoveryHost = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  view: () => SharedView;
  publish: (update: Partial<SharedView>) => void;
  remove: (commandId?: string) => void;
  request: (path: string) => Promise<{ response: Response; value: RecoveryReply }>;
  adopt: (snapshot: SharedSnapshot) => void;
  pending: (pending: boolean) => void;
  unavailable: () => void;
  current: (entry: RecoveryEntry, checkExpiry?: boolean) => void;
};

/** Check receipt identities in order without ever reconstructing or replaying a command body. */
export async function recoverCommandReceipts(host: RecoveryHost) {
  const read = readCommandRecovery(host.storage);
  if (read.unavailable) {
    host.unavailable();
    host.pending(false);
    host.publish({
      recovery: "Recovery storage could not be read. Review the board before repeating an action.",
      recoveryStorageUnavailable: true,
    });
    return;
  }
  if (read.invalid) {
    host.remove();
    host.publish({
      recovery:
        "The previous recovery record could not be read. Its outcome is unknown. Review the board before repeating an action.",
    });
    return;
  }
  const entries = read.entries.filter((held) => held.receiptScope === host.view().receiptScope);
  if (entries.length !== read.entries.length) writeCommandRecovery(host.storage, entries);
  if (!entries.length) {
    host.pending(false);
    // Another desk's entries were dropped: publish the cleared gate now, not at the next poll.
    if (read.entries.length) host.publish({ boardCurrent: host.view().boardCurrent });
    return;
  }
  const results: RecoveryResult[] = [...(host.view().recoveryResults ?? [])];
  host.pending(true);
  host.publish({
    status: "saving",
    recovery:
      entries.length === 1
        ? "Checking the previous uncertain save. Changes are disabled until its receipt is checked."
        : "Checking the previous uncertain saves. Changes are disabled until their receipts are checked.",
  });
  const current = host.current;
  for (const held of entries) {
    current(held, false);
    let outcome: RecoveryResult["outcome"];
    if (held.expiresAt <= Date.now()) outcome = "expired";
    else if (held.phase === "queued") outcome = "unsent";
    else {
      current(held);
      const { response, value } = await host.request(`/v1/workspace/receipt?commandId=${held.commandId}`);
      current(held);
      if (!response.ok) throw new Error("Receipt unavailable");
      const answer = value.receipt === null ? "unknown" : value.receipt?.outcome;
      if (
        answer !== "accepted" &&
        answer !== "partly" &&
        answer !== "refused" &&
        !(answer === "unknown" && value.receipt === null)
      )
        throw new Error("Bad receipt");
      outcome = answer;
      if (outcome === "accepted" || outcome === "partly") {
        const revision = value.receipt?.commandRevision;
        if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
          throw new Error("Bad receipt revision");
        if (revision > (host.view().snapshot?.revision ?? 0)) {
          const latest = await host.request("/v1/workspace");
          current(held);
          if (!latest.response.ok || !latest.value.snapshot || latest.value.snapshot.revision < revision)
            throw new Error("Accepted save is not reflected in the board");
          host.adopt(latest.value.snapshot);
          current(held);
          host.publish({ access: latest.value.access, accessUntil: latest.value.accessUntil });
        }
      }
    }
    results.push({ commandId: held.commandId, outcome });
    host.remove(held.commandId);
    host.publish({ recoveryResults: results.slice(-256) });
  }
  host.pending(false);
  const unsent = results.filter((result) => result.outcome === "unsent").length;
  const unknown = results.some((result) => ["unknown", "expired"].includes(result.outcome));
  const partly = results.some((result) => result.outcome === "partly");
  const refused = results.some((result) => result.outcome === "refused");
  host.publish({
    status: "ready",
    recovery: unsent
      ? `${unsent} waiting change${unsent === 1 ? " was" : "s were"} not sent. Their content was not retained after reload. Review the board before entering them again.`
      : unknown
        ? "A previous save receipt is missing or has expired. Its outcome is unknown. Review the board before repeating any action."
        : partly
          ? "The previous uncertain save was partially applied. Review the refreshed board before acting again."
          : refused
            ? `A previous uncertain save was not applied. ${SAVE_PROBLEMS.refused[1]}`
            : results.length === 1
              ? "The previous uncertain save was accepted. Review the refreshed board before acting again."
              : "The previous uncertain saves were accepted. Review the refreshed board before acting again.",
  });
}
