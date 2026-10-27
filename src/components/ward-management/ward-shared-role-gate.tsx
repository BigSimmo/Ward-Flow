"use client";

/**
 * **WHO TO WORK AS, AND ASKING FOR ACCESS — the shared workspace before the board opens (role
 * access plan, later pass, Josh's go 16 Oct 2026).**
 *
 * An account with more than one role picks which one to work as for this tab (the working-as
 * picker). The choice is the membership id only, kept in this tab's session storage, and the
 * server checks it on every request. An account with no role can ask an access admin for one.
 * Nothing typed here is stored: the role and place are picked from lists.
 */
import { useEffect, useMemo, useState } from "react";

import { ACCESS_ROLE_LABELS, WARD_ACCESS_ROLES, type WardAccess, type WardAccessRole } from "./ward-role-access";
import type { SharedAccessRequest, SharedChangeResult, SharedRoleChoice } from "./ward-shared-client";
import { parseStoredAccess } from "./shell/ward-access-store";
import { SEED_UNITS, placeOptions, sharedDeskLabel } from "./shell/ward-access-labels";
import styles from "./ward-shared-access.module.css";

/** #791: which account this is, so a person with several accounts can tell them apart. */
function SignedInAs({ email }: { email?: string | null }) {
  return email ? <p data-testid="ward-signed-in-as">Signed in as {email}.</p> : null;
}

export function WardRolePicker({
  choices,
  onChoose,
  accountEmail,
  onSignOut,
}: {
  choices: readonly SharedRoleChoice[];
  onChoose: (workingAs: string) => void;
  accountEmail?: string | null;
  onSignOut: () => void;
}) {
  const named = choices
    .map((choice) => ({ id: choice.workingAs, access: parseStoredAccess(JSON.stringify(choice), { shared: true }) }))
    .filter((choice): choice is { id: string; access: WardAccess } => choice.access !== null);
  return (
    <main id="main-content" className={styles.notice} aria-label="Choose a role" data-testid="ward-role-picker">
      <h1>Which role are you working as?</h1>
      <p>This account holds more than one role. You see only what the role you pick needs. You can switch later.</p>
      {named.length === 0 ? (
        <p role="alert">None of this account&apos;s roles can be opened here. Ask your access admin.</p>
      ) : (
        <ul className={styles.choices}>
          {named.map((choice) => (
            <li key={choice.id}>
              <button type="button" onClick={() => onChoose(choice.id)}>
                {sharedDeskLabel(choice.access)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <SignedInAs email={accountEmail} />
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  );
}

type RequestApi = {
  ownRequest(): Promise<SharedAccessRequest | null>;
  requestAccess(role: string, scope: unknown): Promise<SharedChangeResult>;
};

/** Roles a person may ask for. The access admin and coordinator roles are given, not asked for. */
const ASKABLE: readonly WardAccessRole[] = WARD_ACCESS_ROLES.filter(
  (role) => role !== "admin" && role !== "coordinator",
);

/** The server's reason for a role it will not open: an officer role naming no health service. */
export const ROLE_NEEDS_SERVICE = "role-needs-service";

export function WardAskForAccess({
  canRequest,
  api,
  reason,
  onRetry,
  accountEmail,
  onSignOut,
}: {
  canRequest: boolean;
  api: RequestApi | null;
  /** The server's refusal code. `role-needs-service` says what to ask the access admin for. */
  reason?: string | null;
  onRetry: () => void;
  accountEmail?: string | null;
  onSignOut: () => void;
}) {
  const live = canRequest && api !== null;
  const [asked, setAsked] = useState<{ access: WardAccess | null } | null>(null);
  const [role, setRole] = useState<WardAccessRole>(ASKABLE[0] ?? "ward");
  const options = useMemo(() => placeOptions(role, SEED_UNITS), [role]);
  const [placeKey, setPlaceKey] = useState("");
  const place = options.find((option) => option.key === placeKey) ?? options[0];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api.ownRequest().then(
      (request) => {
        if (!cancelled && request)
          setAsked({
            access: parseStoredAccess(JSON.stringify({ role: request.role, scope: request.scope }), { shared: true }),
          });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [live, api]);

  return (
    <main id="main-content" className={styles.notice} aria-label="Ask for access" data-testid="ward-ask-for-access">
      {reason === ROLE_NEEDS_SERVICE ? (
        <>
          <h1>Your role needs a health service</h1>
          <p>Your transport officer role names no health service. Ask your access admin to give it again with one.</p>
        </>
      ) : (
        <>
          <h1>No Ward Flow role yet</h1>
          <p>You are signed in, but no role is assigned to this account. An access admin gives roles.</p>
        </>
      )}
      {asked ? (
        <p role="status">
          You have asked for {asked.access ? sharedDeskLabel(asked.access) : "a role"}. An access admin will answer it.
          Check again once they have.
        </p>
      ) : live ? (
        <form
          className={styles.credentials}
          onSubmit={(event) => {
            event.preventDefault();
            if (!place || busy) return;
            const access: WardAccess = { role, scope: place.scope };
            setBusy(true);
            setMessage(null);
            api.requestAccess(role, place.scope).then(
              (refusal) => {
                setBusy(false);
                if (refusal === null) setAsked({ access });
                else setMessage(refusal);
              },
              () => {
                setBusy(false);
                setMessage("The request could not be confirmed. Reload to check its status before trying again.");
              },
            );
          }}
        >
          <h2>Ask for access</h2>
          <p>
            Bed coordinator and Access admin roles are given by an access admin, so they are not listed. Ask your access
            admin directly if you need one.
          </p>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as WardAccessRole);
                setPlaceKey("");
              }}
              disabled={busy}
            >
              {ASKABLE.map((option) => (
                <option key={option} value={option}>
                  {ACCESS_ROLE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Place
            <select value={place?.key ?? ""} onChange={(event) => setPlaceKey(event.target.value)} disabled={busy}>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {message && <p role="alert">{message}</p>}
          <button type="submit" disabled={busy || !place}>
            {busy ? "Please wait…" : "Ask for access"}
          </button>
        </form>
      ) : (
        <p>Ask your access admin directly.</p>
      )}
      <button type="button" onClick={onRetry}>
        Check again
      </button>
      <SignedInAs email={accountEmail} />
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  );
}
