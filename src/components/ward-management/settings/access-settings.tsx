"use client";

// Forked from src/components/ward-management/settings/access-settings.tsx (role view: access admin, polish r2).

/**
 * **THE ACCESS TAB — who holds which role, and cover for a second ward or ED (role access plan,
 * later pass, Josh's go 16 Oct 2026).**
 *
 * Shown only with the `role-access` flag on. An Access admin desk sees the roles list: grant,
 * remove, the review list (ending soon, not used) and requests for
 * access. A coordinator, nurse in charge or ED clinician sees cover instead: give a colleague cover
 * of one ward or ED for one shift at most, and end it early. Every change goes behind the step-up
 * check and through the same rules the server uses (`ward-access-admin.ts`).
 *
 * The roles list ends with the Access log (`access-log.tsx`): who opened which person's record.
 * The local demo works on made-up staff held for this tab only. The shared workspace reads its
 * lists from the server (`access-shared-source.ts`, through `SharedAccessContext`).
 */
import { useContext, useMemo, useState, type ReactNode } from "react";
import { KeyRound, UserPlus, Users } from "lucide-react";

import { Badge, Button, Card, CardBody, CardHead, Field, Select, TextInput, type WfTone } from "@/components/wf";
import {
  ACCESS_ROLE_LABELS,
  WARD_ACCESS_ROLES,
  type WardAccess,
  type WardAccessRole,
} from "@/components/ward-management/ward-role-access";
import {
  COVER_MAX_MINUTES,
  coverAccess,
  coverRefusal,
  managesAccess,
  membershipStatus,
  reviewNotes,
  scopeWithinScope,
  type AccessMembership,
  type AccessPlaces,
  type AccessRequest,
  type MembershipStatus,
} from "@/components/ward-management/ward-access-admin";
import { wardAccessPlaces } from "@/components/ward-management/ward-access-places";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { MINUTES_PER_DAY, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { useUnscopedWardFlow } from "@/components/ward-management/shell/ward-access";
import { accessPlaceLabel, placeOptions } from "@/components/ward-management/shell/ward-access-labels";
import {
  endCover,
  giveCover,
  sameDesk,
  useWardAccessSnapshot,
} from "@/components/ward-management/shell/ward-access-store";
import {
  DEMO_ADMIN_ID,
  DEMO_STAFF,
  demoStaffLabel,
  localDecide,
  localGrant,
  localRevoke,
  useLocalAccessAdmin,
} from "@/components/ward-management/shell/ward-access-admin-store";
import { useStepUp, type StepUpResult } from "@/components/ward-management/shell/ward-step-up";
import { useSharedAdminSource, useSharedCoverSource } from "@/components/ward-management/settings/access-shared-source";
import { AccessLog } from "@/components/ward-management/settings/access-log";
import { SharedAccessContext } from "@/components/ward-management/shell/ward-shared-access-context";

import styles from "@/components/ward-management/settings/access-settings.module.css";

/** The desks that see the Access tab. Everyone else has nothing to give. */
export function showsAccessTab(desk: WardAccess): boolean {
  return desk.role === "admin" || desk.role === "coordinator" || desk.role === "ward" || desk.role === "ed";
}

/** Where the roles list comes from: the local demo's made-up staff, or the shared server. */
type AccessAdminSource = {
  readonly memberships: readonly AccessMembership[];
  readonly requests: readonly AccessRequest[];
  /** Who can be picked to grant to. `null` in the shared workspace, where an account id is typed. */
  readonly people: readonly { readonly id: string; readonly label: string }[] | null;
  readonly label: (actorId: string) => string;
  /** The signed-in account. An admin cannot remove their own admin role here. */
  readonly self?: string | null;
  readonly grant: (input: { actorId: string; access: WardAccess; expiresAt: Instant }) => Promise<StepUpResult>;
  readonly revoke: (id: string) => Promise<StepUpResult>;
  readonly decide: (id: string, decision: "approved" | "declined", expiresAt: Instant) => Promise<StepUpResult>;
  /** Why the lists may be out of date (the server was not reached). */
  readonly problem?: string | null;
  /** True until the first read from the server comes back. */
  readonly loading?: boolean;
};

const READING = "Reading from the server.";

const GRANT_DAYS = [30, 90, 180, 365] as const;
/** The lengths of cover on offer; Who can change what reads them too. */
export const COVER_HOURS = [4, 8, 12].filter((hours) => hours * 60 <= COVER_MAX_MINUTES);

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "in 10 days", "3 hours ago": the demo clock's minutes, in words. */
function whenText(at: Instant, now: Instant): string {
  const minutes = Math.abs(at - now);
  const amount =
    minutes >= MINUTES_PER_DAY
      ? plural(Math.round(minutes / MINUTES_PER_DAY), "day")
      : minutes >= 60
        ? plural(Math.round(minutes / 60), "hour")
        : plural(minutes, "minute");
  return at >= now ? `in ${amount}` : `${amount} ago`;
}

const STATUS: Record<MembershipStatus, { label: string; tone: WfTone }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Not active yet: the server is not updated", tone: "warning" },
  unused: { label: "Switched off, not used", tone: "closed" },
  ended: { label: "Ended", tone: "neutral" },
};

function useLocalAdminSource(desk: WardAccess, now: Instant, places: AccessPlaces): AccessAdminSource {
  const { memberships, requests } = useLocalAccessAdmin(now);
  return useMemo(() => {
    const admin = { access: desk, actorId: DEMO_ADMIN_ID };
    return {
      memberships,
      requests,
      people: DEMO_STAFF.filter((person) => person.id !== DEMO_ADMIN_ID),
      label: demoStaffLabel,
      self: DEMO_ADMIN_ID,
      grant: async (input) => localGrant(admin, { ...input, now, places }),
      revoke: async (id) => localRevoke(admin, id, now, places),
      decide: async (id, decision, expiresAt) => localDecide(admin, id, decision, { expiresAt, now, places }),
    };
  }, [memberships, requests, desk, now, places]);
}

/** One line saying what the last change did, read aloud. */
function useResult(): [ReactNode, (message: string | null, done: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const line = text ? (
    <p className={styles.result} role="status" data-testid="ward-access-result">
      {text}
    </p>
  ) : null;
  return [line, (message, done) => setText(message ?? done)];
}

/** The Access tab's content for the current desk. */
export function AccessSettings() {
  const { desk, previewOf } = useWardAccessSnapshot();
  if (previewOf) return <p className={styles.intro}>Preview only. Access changes are made from your own desk.</p>;
  if (desk.role === "admin") return <AccessAdminPanel />;
  // A statewide coordinator gives cover and also manages roles (managesAccess, review on PR #363).
  if (managesAccess(desk))
    return (
      <>
        <CoverPanel />
        <AccessAdminPanel />
      </>
    );
  return <CoverPanel />;
}

function AccessAdminPanel() {
  const { desk } = useWardAccessSnapshot();
  const { units, now } = useUnscopedWardFlow();
  const places = useMemo(() => wardAccessPlaces(units), [units]);
  const local = useLocalAdminSource(desk, now, places);
  const shared = useSharedAdminSource(useContext(SharedAccessContext), now, true);
  const source: AccessAdminSource = shared ?? local;
  const { guard, dialog } = useStepUp();
  const [result, say] = useResult();

  const run = (action: () => Promise<StepUpResult>, done: string) => void guard(action).then((r) => say(r, done));
  // Polish r2: the place's synthetic "(placeholder)" tag is left off; the footer says every record is synthetic.
  const place = (access: WardAccess) => accessPlaceLabel(access, units).replace(/ \(placeholder\)$/, "");
  const describe = (access: WardAccess) => `${ACCESS_ROLE_LABELS[access.role]}, ${place(access)}`;
  const live = source.memberships.filter((m) => membershipStatus(m, now) !== "ended");
  const open = source.requests.filter((r) => r.decision === null);
  const defaultEnd = now + 90 * MINUTES_PER_DAY;

  return (
    <>
      {/* Polish r2: the end date is said once, on Give a role. */}
      <p className={styles.intro}>
        {desk.role === "admin" ? null : "As a statewide coordinator you also give and remove roles. "}
        Nobody grants themselves a role.
      </p>
      {source.problem ? (
        <p className={styles.result} role="alert">
          {source.problem}
        </p>
      ) : null}
      {result}

      <Card data-testid="ward-access-requests">
        <CardHead title="Requests for access" icon={UserPlus} meta={plural(open.length, "open request")} />
        <CardBody flush>
          {open.length === 0 ? (
            <p className={styles.empty} role={source.loading ? "status" : undefined}>
              {source.loading ? READING : "No requests waiting."}
            </p>
          ) : (
            <ul className={styles.list}>
              {open.map((request) => (
                <li key={request.id} className={styles.row}>
                  <span className={styles.who}>
                    <span className={styles.name}>{source.label(request.actorId)}</span>
                    <span className={styles.meta}>
                      Asked for {describe(request.access)}, {whenText(request.requestedAt, now)}
                    </span>
                  </span>
                  <span className={styles.actions}>
                    <Button
                      size="sm"
                      variant="sec"
                      onClick={() =>
                        run(
                          () => source.decide(request.id, "approved", defaultEnd),
                          `Given for 90 days: ${describe(request.access)}.`,
                        )
                      }
                    >
                      Give for 90 days
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => source.decide(request.id, "declined", defaultEnd), "Request declined.")}
                    >
                      Decline
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <GrantForm source={source} units={units} now={now} onRun={run} />

      <Card data-testid="ward-access-roles">
        <CardHead title="Everyone with a role" icon={Users} meta={plural(live.length, "role")} />
        <CardBody flush>
          {source.loading ? (
            <p className={styles.empty} role="status">
              {READING}
            </p>
          ) : null}
          <ul className={styles.list}>
            {live.map((m) => {
              const status = membershipStatus(m, now);
              const notes = reviewNotes(m, now);
              return (
                <li key={m.id} className={styles.row} data-testid="ward-access-role-row">
                  <span className={styles.who}>
                    <span className={styles.name}>{source.label(m.actorId)}</span>
                    {/* Polish r2: the app's " · " meta line, not three sentences. */}
                    <span className={styles.meta}>
                      {ACCESS_ROLE_LABELS[m.access.role]} · {place(m.access)} · ends {whenText(m.expiresAt, now)} ·{" "}
                      {m.lastUsedAt === null ? "never used" : `used ${whenText(m.lastUsedAt, now)}`}
                    </span>
                  </span>
                  {/* Polish r2: a status chip only for an exception; an active role needs no green chip. */}
                  <span className={styles.notes}>
                    {status === "active" ? null : (
                      <Badge tone={STATUS[status].tone} size="sm">
                        {STATUS[status].label}
                      </Badge>
                    )}
                    {notes.endingSoon ? (
                      <Badge tone="warning" size="sm">
                        Ending soon
                      </Badge>
                    ) : null}
                    {m.kind === "cover" ? <Badge size="sm">Cover</Badge> : null}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabledReason={
                      m.access.role === "admin" && m.actorId === source.self
                        ? "You cannot remove your own admin role. Ask another admin."
                        : undefined
                    }
                    // Polish r2: the reason on the control, so the row stays one line.
                    reasonDisplay="tooltip"
                    onClick={() => run(() => source.revoke(m.id), `Removed: ${describe(m.access)}.`)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
      <AccessLog />
      {dialog}
    </>
  );
}

function GrantForm({
  source,
  units,
  now,
  onRun,
}: {
  source: AccessAdminSource;
  units: readonly Unit[];
  now: Instant;
  onRun: (action: () => Promise<StepUpResult>, done: string) => void;
}) {
  // Audit (31 Oct 2026): nothing is chosen for the admin. Each field starts empty, so a role is never
  // given to whoever happened to be first in a list.
  const [person, setPerson] = useState("");
  const [role, setRole] = useState<WardAccessRole | "">("");
  const options = useMemo(() => (role ? placeOptions(role, units) : []), [role, units]);
  const [placeKey, setPlaceKey] = useState<string>("");
  const [days, setDays] = useState<number | null>(null);
  // A role with only one place (statewide) needs no choice.
  const place = options.find((option) => option.key === placeKey) ?? (options.length === 1 ? options[0] : undefined);
  const missing = !person
    ? "Choose who first."
    : !role
      ? "Choose a role."
      : !place
        ? "Choose a place."
        : days === null
          ? "Choose when it ends."
          : undefined;

  return (
    <Card data-testid="ward-access-grant">
      <CardHead title="Give a role" icon={KeyRound} meta="Every role has an end date" />
      <div className={styles.form}>
        <Field label={source.people ? "Person" : "Account id"}>
          {source.people ? (
            <Select value={person} onChange={(event) => setPerson(event.target.value)}>
              <option value="" disabled>
                Choose a person
              </option>
              {source.people.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <TextInput value={person} onChange={(event) => setPerson(event.target.value.trim())} autoComplete="off" />
          )}
        </Field>
        <Field label="Role">
          <Select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as WardAccessRole);
              setPlaceKey("");
            }}
          >
            <option value="" disabled>
              Choose a role
            </option>
            {WARD_ACCESS_ROLES.map((option) => (
              <option key={option} value={option}>
                {ACCESS_ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Place">
          <Select value={place?.key ?? ""} onChange={(event) => setPlaceKey(event.target.value)} disabled={!role}>
            <option value="" disabled>
              {role ? "Choose a place" : "Choose a role first"}
            </option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ends">
          <Select value={days === null ? "" : String(days)} onChange={(event) => setDays(Number(event.target.value))}>
            <option value="" disabled>
              Choose an end
            </option>
            {GRANT_DAYS.map((option) => (
              <option key={option} value={option}>
                In {option} days
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.formFoot}>
        <Button
          variant="pri"
          size="sm"
          disabledReason={missing}
          onClick={() => {
            if (!place || !person || !role || days === null) return;
            const access: WardAccess = { role, scope: place.scope };
            onRun(
              () => source.grant({ actorId: person, access, expiresAt: now + days * MINUTES_PER_DAY }),
              `Given: ${source.label(person)}, ${ACCESS_ROLE_LABELS[role]}, ${place.label}, for ${days} days.`,
            );
          }}
          data-testid="ward-access-grant-submit"
        >
          Give role
        </Button>
      </div>
    </Card>
  );
}

/**
 * Cover (feature 2). The places this desk may give cover of, and the desks that may hold it: a
 * ward's cover goes to another ward's nurse in charge, an ED's to another ED's clinician.
 */
function CoverPanel() {
  const { desk, covers } = useWardAccessSnapshot();
  const { units, now } = useUnscopedWardFlow();
  const places = useMemo(() => wardAccessPlaces(units), [units]);
  const shared = useSharedCoverSource(useContext(SharedAccessContext), now, true);
  const [account, setAccount] = useState("");
  const { guard, dialog } = useStepUp();
  const [result, say] = useResult();
  const deskId = JSON.stringify(desk);

  const givable = useMemo(
    () =>
      [...placeOptions("ward", units), ...placeOptions("ed", units)].filter(
        (option) =>
          coverRefusal({
            giver: desk,
            giverId: deskId,
            recipientId: "anyone",
            scope: option.scope,
            minutes: 60,
            places,
            // Only which places this desk may cover is asked here; the colleague is checked on giving.
            recipientRoles: ["ward", "ed"],
          }) === null,
      ),
    [desk, deskId, units, places],
  );
  // Audit (31 Oct 2026): nothing is chosen for you; the place, colleague and length start empty.
  const [placeKey, setPlaceKey] = useState("");
  const place = givable.find((option) => option.key === placeKey) ?? (givable.length === 1 ? givable[0] : undefined);
  const recipients = useMemo(
    () =>
      place ? placeOptions(place.scope.kind === "ed" ? "ed" : "ward", units).filter((o) => o.key !== place.key) : [],
    [place, units],
  );
  const [recipientKey, setRecipientKey] = useState("");
  const recipient = recipients.find((option) => option.key === recipientKey);
  const [hours, setHours] = useState<number | null>(null);
  const coverMissing = !place
    ? "Choose the ward or ED first."
    : shared
      ? !account
        ? "Enter the account id first."
        : hours === null
          ? "Choose how long."
          : undefined
      : !recipient
        ? "Choose who holds it."
        : hours === null
          ? "Choose how long."
          : undefined;
  // A desk sees the cover it gave or holds; a coordinator also sees any cover inside its place.
  const mine = covers.filter(
    (cover) =>
      sameDesk(cover.givenBy, desk) ||
      sameDesk(cover.recipient, desk) ||
      (desk.role === "coordinator" && scopeWithinScope(cover.scope, desk.scope, places)),
  );
  const label = (access: WardAccess) => `${ACCESS_ROLE_LABELS[access.role]}, ${accessPlaceLabel(access, units)}`;

  const give = () => {
    if (hours === null) return;
    if (shared) {
      if (!place) return;
      const actorId = account;
      void guard(() => shared.give({ actorId, scope: place.scope, minutes: hours * 60 })).then((r) =>
        say(r, `Cover given: ${shared.label(actorId)} holds ${place.label} for ${plural(hours, "hour")}.`),
      );
      return;
    }
    if (!place || !recipient) return;
    const access = coverAccess(place.scope);
    const recipientAccess = coverAccess(recipient.scope);
    if (!access || !recipientAccess) return;
    const minutes = hours * 60;
    void guard(async () => {
      const refusal = coverRefusal({
        giver: desk,
        giverId: deskId,
        recipientId: JSON.stringify(recipientAccess),
        scope: place.scope,
        minutes,
        places,
        recipientRoles: [recipientAccess.role],
      });
      if (refusal) return refusal;
      return giveCover({ recipient: recipientAccess, scope: place.scope, now, until: now + minutes })
        ? null
        : "Cover was not given.";
    }).then((r) => say(r, `Cover given: ${recipient.label} holds ${place.label} for ${plural(hours, "hour")}.`));
  };

  return (
    <>
      <p className={styles.intro}>
        Cover lasts {plural(CLINICAL_VALUES.coverLength.value, "hour")} at most and ends by itself.
      </p>
      {result}
      <Card data-testid="ward-access-cover">
        <CardHead title="Give cover" icon={KeyRound} meta="One ward or one ED" />
        {givable.length === 0 ? (
          <p className={styles.empty}>This desk has no ward or ED to give cover of.</p>
        ) : (
          <>
            <div className={styles.form}>
              <Field label="Cover of">
                <Select
                  value={place?.key ?? ""}
                  onChange={(event) => {
                    setPlaceKey(event.target.value);
                    setRecipientKey("");
                  }}
                >
                  <option value="" disabled>
                    Choose a ward or ED
                  </option>
                  {givable.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {shared ? (
                <Field label="Held by (account id)">
                  <TextInput
                    value={account}
                    onChange={(event) => setAccount(event.target.value.trim())}
                    autoComplete="off"
                  />
                </Field>
              ) : (
                <Field label="Held by">
                  <Select
                    value={recipient?.key ?? ""}
                    onChange={(event) => setRecipientKey(event.target.value)}
                    disabled={!place}
                  >
                    <option value="" disabled>
                      {place ? "Choose a colleague" : "Choose the place first"}
                    </option>
                    {recipients.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.scope.kind === "ed" ? "ED clinician" : "Nurse in charge"}, {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="For">
                <Select
                  value={hours === null ? "" : String(hours)}
                  onChange={(event) => setHours(Number(event.target.value))}
                >
                  <option value="" disabled>
                    Choose how long
                  </option>
                  {COVER_HOURS.map((option) => (
                    <option key={option} value={option}>
                      {plural(option, "hour")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className={styles.formFoot}>
              <Button
                variant="pri"
                size="sm"
                onClick={give}
                disabledReason={coverMissing}
                data-testid="ward-access-cover-submit"
              >
                Give cover
              </Button>
            </div>
          </>
        )}
      </Card>
      {shared ? (
        <SharedCoverList source={shared} units={units} now={now} coordinator={desk.role === "coordinator"} say={say} />
      ) : (
        <Card data-testid="ward-access-cover-list">
          <CardHead title="Cover now" icon={Users} meta={plural(mine.length, "cover")} />
          <CardBody flush>
            {mine.length === 0 ? (
              <p className={styles.empty}>No cover given or held by this desk.</p>
            ) : (
              <ul className={styles.list}>
                {mine.map((cover) => (
                  <li key={cover.id} className={styles.row}>
                    <span className={styles.who}>
                      <span className={styles.name}>
                        {accessPlaceLabel({ role: "ward", scope: cover.scope }, units)}
                      </span>
                      <span className={styles.meta}>
                        Held by {label(cover.recipient)} until {formatInstantWithDay(cover.until, now)}. Given by{" "}
                        {label(cover.givenBy)}.
                      </span>
                    </span>
                    {sameDesk(cover.givenBy, desk) || desk.role === "coordinator" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void guard(async () => {
                            endCover(cover.id);
                            return null;
                          }).then((r) => say(r, "Cover ended."))
                        }
                      >
                        End cover
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {dialog}
    </>
  );
}

/** The shared workspace's cover list: given or held by this account, or inside a coordinator's place. */
function SharedCoverList({
  source,
  units,
  now,
  coordinator,
  say,
}: {
  source: NonNullable<ReturnType<typeof useSharedCoverSource>>;
  units: readonly Unit[];
  now: Instant;
  coordinator: boolean;
  say: (message: string | null, done: string) => void;
}) {
  const { guard, dialog } = useStepUp();
  return (
    <Card data-testid="ward-access-cover-list">
      <CardHead title="Cover now" icon={Users} meta={plural(source.covers.length, "cover")} />
      <CardBody flush>
        {source.problem ? (
          <p className={styles.empty} role="alert">
            {source.problem}
          </p>
        ) : source.loading ? (
          <p className={styles.empty} role="status">
            {READING}
          </p>
        ) : source.covers.length === 0 ? (
          <p className={styles.empty}>No cover given or held by this account.</p>
        ) : (
          <ul className={styles.list}>
            {source.covers.map((cover) => (
              <li key={cover.id} className={styles.row}>
                <span className={styles.who}>
                  <span className={styles.name}>{accessPlaceLabel({ role: "ward", scope: cover.scope }, units)}</span>
                  <span className={styles.meta}>
                    Held by {source.label(cover.actorId)} until {formatInstantWithDay(cover.until, now)}. Given by{" "}
                    {source.label(cover.grantedBy)}.
                  </span>
                </span>
                {cover.grantedBy === source.self || coordinator ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void guard(() => source.end(cover.id)).then((r) => say(r, "Cover ended."))}
                  >
                    End cover
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {dialog}
    </Card>
  );
}
