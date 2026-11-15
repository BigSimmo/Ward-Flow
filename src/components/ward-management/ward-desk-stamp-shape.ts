/**
 * The desk stamp a change carries once the shell or the server has stamped it (`ward-desk-stamp.ts`),
 * and the checks that read it. Kept apart from the stamping itself so the audit (`ward-audit.ts`)
 * reads a stamp without importing the permission rules. Pure and browser free.
 */
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import {
  accessIsValid,
  ROLE_SCOPE_KINDS,
  type WardAccess,
  type WardAccessScope,
} from "@/components/ward-management/ward-role-access";

/** The desk a change was made from, as History stores it. Ids and closed lists only. */
export type DeskStamp = {
  /** The membership's own role (`Desk.role`). */
  readonly role: WardChromeRole;
  readonly scope: WardAccessScope;
  /** The access admin, which records under the executive role but is named for itself. */
  readonly accessAdmin?: true;
  /** The signed-in account's short display name, stamped by the server only (D-222 choice 2). */
  readonly account?: string;
};

/** Initial and surname, as an access admin enters it: letters, spaces, full stops and hyphens. */
const ACCOUNT_NAME = /^[\p{L}][\p{L} .-]{0,39}$/u;

/** A display name fit to stamp, or `null`. Never anything else a person typed. */
export function stampableAccountName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ACCOUNT_NAME.test(trimmed) ? trimmed : null;
}

/** A change without any desk stamp, for the server before it stamps its own. */
export function withoutDeskStamp(supplied: unknown): unknown {
  if (supplied === null || typeof supplied !== "object" || !Object.hasOwn(supplied, "desk")) return supplied;
  const rest: Record<string, unknown> = { ...supplied };
  delete rest.desk;
  return rest;
}

/** The desk stamp on a change, when it carries a well-formed one. */
export function eventDesk(event: unknown): DeskStamp | null {
  const desk = (event as { desk?: unknown } | null)?.desk as Partial<DeskStamp> | undefined;
  if (desk === null || typeof desk !== "object") return null;
  const role = desk.accessAdmin === true ? "admin" : desk.role;
  const scope = desk.scope as { kind?: unknown } | undefined;
  if (typeof role !== "string" || !Object.hasOwn(ROLE_SCOPE_KINDS, role)) return null;
  if (scope === null || typeof scope !== "object" || typeof scope.kind !== "string") return null;
  if (!accessIsValid({ role, scope } as WardAccess)) return null;
  if (desk.accessAdmin === true && desk.role !== "executive") return null;
  const account = stampableAccountName(desk.account);
  return {
    role: desk.role as WardChromeRole,
    scope: desk.scope as WardAccessScope,
    ...(desk.accessAdmin === true ? { accessAdmin: true as const } : {}),
    ...(account === null ? {} : { account }),
  };
}
