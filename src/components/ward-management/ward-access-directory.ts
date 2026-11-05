import type { SharedAccessRequest, SharedMembership } from "./ward-shared-access-types";

type DirectoryPage = {
  response: Response;
  value: {
    error?: unknown;
    memberships?: SharedMembership[];
    requests?: SharedAccessRequest[];
    complete?: boolean;
    nextCursor?: unknown;
  };
};

/** Collect a directory before exposing it; every request still uses the active client's auth. */
export async function readAccessDirectory(
  read: (path: string) => Promise<DirectoryPage>,
  isCurrent: () => boolean,
): Promise<{ memberships: SharedMembership[]; requests: SharedAccessRequest[] }> {
  const memberships: SharedMembership[] = [];
  let requests: SharedAccessRequest[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  // Bound a whole browser refresh as well as each server page. Never present a truncated list
  // as complete when an unusually large directory needs a narrower operational scope.
  for (let page = 0; page < 100; page++) {
    const { response, value } = await read(
      `/v1/workspace/access${cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`}`,
    );
    if (!isCurrent()) throw new Error("The role changed while reading access. Reload the list.");
    if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Roles could not be read");
    if (!Array.isArray(value.memberships)) throw new Error("Roles could not be read");
    memberships.push(...value.memberships);
    if (page === 0) requests = Array.isArray(value.requests) ? value.requests : [];
    if (value.complete !== false) return { memberships, requests };
    if (typeof value.nextCursor !== "string" || !value.nextCursor || seen.has(value.nextCursor))
      throw new Error("Roles could not be read completely. Reload the list.");
    seen.add(value.nextCursor);
    cursor = value.nextCursor;
  }
  throw new Error("The roles list is too large to read completely. Ask the access administrator.");
}
