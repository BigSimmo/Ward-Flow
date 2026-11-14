-- HELD, NOT APPLIED. A one-off data fix that needs Josh's approval before it is run anywhere.
-- Synthetic data only. Findings Desks-R5-1 and Together-X1a-2 (master stress test, 14 Nov 2026).
--
-- WHAT IS WRONG. A shared world counts every time ("instant") as whole minutes after its day zero,
-- and every board, referral, letter and legal clock reads an instant's clock face as its minutes
-- past day zero. The code assumes day zero is a Perth midnight (`seedWorld` has made it one since
-- D-150), but the stored world was made earlier with day zero at a UTC midnight
-- (2026-10-17T00:00Z = 08:00 Perth). So every clock face reads 8 hours behind Perth, while History,
-- which prints the real moment (day zero + minutes), is right.
--
-- WHAT THIS DOES. It moves each prototype world's day zero back to the Perth midnight on or before
-- it (N minutes earlier; N = 480 for a UTC midnight) and moves every instant forward by the same N.
-- Every real moment stays exactly where it was: History, durations, due-in and overdue times and
-- ordering do not change; only the clock face does, from UTC to Perth. The instant field names are
-- the app's own guard-tested list (`INSTANT_FIELDS` in src/components/ward-management/ward-reanchor.ts);
-- day-zero-rebase.test.mjs fails if this list drifts from it, and checks this file against the
-- engine's `rebaseOntoPerthMidnight` on the real seed. A world already on a Perth midnight is left
-- alone, so running it twice changes nothing.
--
-- WHAT CHANGES. ward_flow.workspaces (day zero, small state fields, revision + 1, updated_at),
-- ward_flow.workspace_records (bodies holding an instant; those rows take the new revision),
-- ward_flow.archived_records (closed_at and body; archived_revision is kept, so restart the backend
-- afterwards to drop its in-process archive cache), and forecast_snapshots.taken_at and
-- forecast_miss_reasons.chosen_at (demo_day is kept). One audit row (REBASE_DAY_ZERO) records the
-- old and new day zero and the shift. NOT changed: ward_flow.audit (append-only by trigger; its
-- older rows keep the UTC-based numbers they were written with), command receipts, break glass,
-- record access history, sign-outs and every real timestamp column.
--
-- HOW TO RUN (only after approval, on a restored copy first, with the backend stopped):
--   psql "<named Ward Flow database URL>" -v ON_ERROR_STOP=1 --single-transaction \
--     -v actor_id=<the approver's account uuid> -v dry_run=on  -f 019-perth-day-zero.sql
-- dry_run=on prints what would change and rolls everything back; dry_run=off applies it. Without
-- actor_id or dry_run the file stops with a syntax error before changing anything.
--
-- ROLLBACK. Restore the backup taken just before, or run this same file again with
-- -v rollback_to=<the old day zero it printed, e.g. 2026-10-17T00:00:00.000Z> (also kept in the
-- REBASE_DAY_ZERO audit row). That rebases the world back onto the old day zero by the opposite
-- shift, which is exact, including for anything saved since.
--
-- This file is deliberately outside migrations/ and is not listed in migrations.mjs, so no deploy or
-- migrate run can apply it, and it adds no schema: its helper functions live in pg_temp and vanish
-- with the session.

SET LOCAL lock_timeout = '5s';
SELECT set_config('ward_flow.rebase_actor', :'actor_id', true);
SELECT set_config('ward_flow.rebase_dry_run', :'dry_run', true);
\if :{?rollback_to}
SELECT set_config('ward_flow.rebase_target', :'rollback_to', true);
\else
SELECT set_config('ward_flow.rebase_target', '', true);
\endif

-- The instant field names, exactly INSTANT_FIELDS (98 names, sorted).
CREATE FUNCTION pg_temp.wf_instant_fields() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'acceptedAt', 'addedAt', 'answerBy', 'answeredAt', 'appointmentAt', 'arrivalLateNotifiedAt',
    'arrivedAt', 'at', 'auditCaptureStartedAt', 'awayAtEmergencyDepartmentSince', 'bestAfter',
    'blockerRecordedAt', 'bookedAt', 'cancelledAt', 'changedAt', 'clearedAt',
    'clinicallyReadySince', 'closedAt', 'collectedAt', 'confirmedAt', 'consultantSeenAt',
    'contactedAt', 'continuedFormDueAt', 'convertedAt', 'correctedReceivedAt', 'crewArrivedAt',
    'crewHandedOverAt', 'crewReleasedAt', 'decidedAt', 'dischargeConfirmedAt', 'dischargeDateSetAt',
    'dispatchedAt', 'dueAt', 'enRouteAt', 'endedAt', 'estimatedArrivalAt', 'estimatedAt',
    'expectedArrivalAt', 'expectedAt', 'expectedDischargeAt', 'expectedReturn', 'expiresAt',
    'extendedHoldAt', 'firstExpectedAt', 'flaggedAt', 'formWrittenAt', 'formedAt', 'from',
    'handedAt', 'inDepartmentAt', 'lapsesAt', 'leftAt', 'leftDepartmentAt', 'legalFormReceivedAt',
    'madeAt', 'metAt', 'nextCallbackAt', 'nextReviewAt', 'notifiedAt', 'openWarningAt', 'openedAt',
    'plannedMoveAt', 'previousDueAt', 'previousExpectedAt', 'promisedFor', 'pullExpiresAt',
    'pulledAt', 'raisedAt', 'readAt', 'readmissionDischargedAt', 'readyAt', 'readyForNextAt',
    'receivedAt', 'recordedAt', 'referralDecisionOpenedAt', 'referredAt', 'registrarSeenAt',
    'reopenedAt', 'requestedAt', 'resumedAt', 'reviewAt', 'reviewBy', 'setAt', 'shiftStartAt',
    'since', 'startedAt', 'stoodDownAt', 'stoppedAt', 'to', 'triagedAt', 'until', 'updatedAt',
    'uploadedAt', 'waitlistedAt', 'wardConfirmedAt', 'weekendStart', 'withdrawnAt', 'writtenAt'
  ]::text[]
$$;

-- An explicit ISO time as `explicitIsoTime` (ward-referral-seed-time.ts) accepts it, or NULL.
CREATE FUNCTION pg_temp.wf_explicit_iso(value text) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  parts text[];
BEGIN
  parts := regexp_match(value, '^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$');
  IF parts IS NULL OR parts[4]::int > 23 OR parts[5]::int > 59 OR coalesce(parts[6], '0')::int > 59 THEN
    RETURN NULL;
  END IF;
  RETURN value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- `isSyntheticReferralTimelineBase`: an explicit ISO time that is exactly a Perth (UTC+8) midnight.
CREATE FUNCTION pg_temp.wf_synthetic_base(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  at timestamptz;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) <> 'string' THEN RETURN false; END IF;
  at := pg_temp.wf_explicit_iso(value #>> '{}');
  RETURN at IS NOT NULL
    AND to_char((at AT TIME ZONE 'UTC') + interval '8 hours', 'HH24:MI:SS.US') = '00:00:00.000000';
END $$;

-- `shiftInstants` (ward-reanchor.ts) in SQL: every number under an instant field name moves by
-- `delta` minutes, and a seeded intake target time (an ISO string read from day zero through its
-- `syntheticTimelineBase`) moves with them. `parent` and `grand` are the last two keys of the path to
-- `value`; a list does not add a key, as in the original.
CREATE FUNCTION pg_temp.wf_shift(value jsonb, delta integer, parent text, grand text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  key text;
  entry jsonb;
  moved timestamptz;
BEGIN
  IF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(pg_temp.wf_shift(e.value, delta, parent, grand) ORDER BY e.ordinality), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS e(value, ordinality);
    RETURN result;
  END IF;
  IF jsonb_typeof(value) IS DISTINCT FROM 'object' THEN RETURN value; END IF;
  FOR key, entry IN SELECT e.key, e.value FROM jsonb_each(value) AS e LOOP
    moved := NULL;
    IF delta <> 0 AND grand = 'intake'
      AND ((parent = 'medicalClearance' AND key = 'expectedAt') OR (parent = 'arrival' AND key = 'estimatedAt'))
      AND jsonb_typeof(entry) = 'string' AND pg_temp.wf_synthetic_base(value -> 'syntheticTimelineBase') THEN
      BEGIN
        moved := (entry #>> '{}')::timestamptz + make_interval(mins => delta);
      EXCEPTION WHEN others THEN
        moved := NULL;
      END;
    END IF;
    IF moved IS NOT NULL THEN
      result := result || jsonb_build_object(key, to_char(moved AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
    ELSIF key = ANY (pg_temp.wf_instant_fields()) AND jsonb_typeof(entry) = 'number' THEN
      result := result || jsonb_build_object(key, (entry::text)::numeric + delta);
    ELSE
      result := result || jsonb_build_object(key, pg_temp.wf_shift(entry, delta, key, parent));
    END IF;
  END LOOP;
  RETURN result;
END $$;

DO $$
DECLARE
  actor uuid := nullif(current_setting('ward_flow.rebase_actor'), '')::uuid;
  dry_run boolean := current_setting('ward_flow.rebase_dry_run')::boolean;
  target text := current_setting('ward_flow.rebase_target');
  w record;
  old_zero timestamptz;
  new_zero timestamptz;
  gap_ms numeric;
  delta integer;
  next_revision bigint;
  next_state jsonb;
  changed_fields jsonb;
  record_rows integer;
  archived_rows integer := 0;
  snapshot_rows integer := 0;
  reason_rows integer := 0;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Name the approving account: -v actor_id=<uuid>'; END IF;
  FOR w IN SELECT id, revision, payload FROM ward_flow.workspaces WHERE data_mode = 'prototype' ORDER BY id FOR UPDATE LOOP
    old_zero := pg_temp.wf_explicit_iso(w.payload ->> 'dayZero');
    IF old_zero IS NULL THEN RAISE EXCEPTION 'Workspace % has no readable day zero; nothing changed', w.id; END IF;
    IF target = '' THEN
      -- The Perth midnight on or before day zero (`demoDayZero`), with Perth fixed at UTC+8.
      new_zero := (date_trunc('day', (old_zero AT TIME ZONE 'UTC') + interval '8 hours') - interval '8 hours') AT TIME ZONE 'UTC';
    ELSE
      new_zero := pg_temp.wf_explicit_iso(target);
      IF new_zero IS NULL THEN RAISE EXCEPTION 'The rollback day zero % is not an explicit ISO time', target; END IF;
    END IF;
    gap_ms := round(extract(epoch FROM old_zero - new_zero) * 1000);
    IF gap_ms % 60000 <> 0 THEN RAISE EXCEPTION 'Workspace % day zero is not whole minutes from %', w.id, new_zero; END IF;
    delta := (gap_ms / 60000)::integer;
    IF delta = 0 THEN
      RAISE NOTICE 'Workspace %: day zero % is already the target; nothing to change', w.id, w.payload ->> 'dayZero';
      CONTINUE;
    END IF;
    next_revision := w.revision + 1;

    -- Each stored record, shifted exactly as it sits in the whole world (`{collection: [body]}` for a
    -- list entry, `{collection: {id: body}}` for a map entry). Only rows whose body changed move.
    WITH shifted AS (
      SELECT r.collection, r.record_id,
        CASE WHEN r.kind = 'entry'
          THEN pg_temp.wf_shift(jsonb_build_object(r.collection, jsonb_build_object(r.record_id, r.body)), delta, NULL, NULL) -> r.collection -> r.record_id
          ELSE pg_temp.wf_shift(jsonb_build_object(r.collection, jsonb_build_array(r.body)), delta, NULL, NULL) -> r.collection -> 0
        END AS body
      FROM ward_flow.workspace_records r WHERE r.workspace_id = w.id
    )
    UPDATE ward_flow.workspace_records r SET body = s.body, revision = next_revision, updated_at = now()
      FROM shifted s
      WHERE r.workspace_id = w.id AND r.collection = s.collection AND r.record_id = s.record_id AND r.body IS DISTINCT FROM s.body;
    GET DIAGNOSTICS record_rows = ROW_COUNT;

    -- The small fields on the workspace row (and any list still kept whole there). A field that moved
    -- takes the new revision in "$revisions", as a save would record it.
    next_state := pg_temp.wf_shift(w.payload -> 'state', delta, NULL, NULL);
    SELECT coalesce(jsonb_object_agg(f.key, next_revision), '{}'::jsonb) INTO changed_fields
      FROM jsonb_each(next_state) AS f
      WHERE f.value IS DISTINCT FROM w.payload -> 'state' -> f.key AND (w.payload -> '$revisions') ? f.key;
    UPDATE ward_flow.workspaces SET
      revision = next_revision,
      updated_at = now(),
      payload = w.payload
        || jsonb_build_object('state', next_state)
        || jsonb_build_object('dayZero', to_char(new_zero AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        || CASE WHEN w.payload ? '$revisions'
             THEN jsonb_build_object('$revisions', (w.payload -> '$revisions') || changed_fields)
             ELSE '{}'::jsonb END
      WHERE id = w.id;

    IF to_regclass('ward_flow.archived_records') IS NOT NULL THEN
      UPDATE ward_flow.archived_records a SET
        closed_at = a.closed_at + delta,
        body = pg_temp.wf_shift(jsonb_build_object(a.collection, jsonb_build_array(a.body)), delta, NULL, NULL) -> a.collection -> 0
        WHERE a.workspace_id = w.id;
      GET DIAGNOSTICS archived_rows = ROW_COUNT;
    END IF;
    IF to_regclass('ward_flow.forecast_snapshots') IS NOT NULL THEN
      UPDATE ward_flow.forecast_snapshots SET taken_at = taken_at + delta WHERE workspace_id = w.id;
      GET DIAGNOSTICS snapshot_rows = ROW_COUNT;
      UPDATE ward_flow.forecast_miss_reasons SET chosen_at = chosen_at + delta WHERE workspace_id = w.id;
      GET DIAGNOSTICS reason_rows = ROW_COUNT;
    END IF;

    INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes)
      VALUES (w.id, actor, 'REBASE_DAY_ZERO', 'accepted', w.revision, next_revision, jsonb_build_object(
        'fromDayZero', w.payload ->> 'dayZero',
        'toDayZero', to_char(new_zero AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'shiftMinutes', delta,
        'records', record_rows, 'archived', archived_rows, 'snapshots', snapshot_rows, 'reasons', reason_rows));
    RAISE NOTICE 'Workspace %: day zero % -> % (instants +% min); revision % -> %; % records, % archived, % snapshots, % reasons',
      w.id, w.payload ->> 'dayZero', to_char(new_zero AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), delta,
      w.revision, next_revision, record_rows, archived_rows, snapshot_rows, reason_rows;
  END LOOP;
  IF dry_run THEN RAISE EXCEPTION 'Dry run only: every change above was rolled back'; END IF;
END $$;
