-- Undo migration 009. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-009-access-cover-requests.sql
-- Ends every cover now, then removes cover rows' kind, requests for access, last used times and the
-- role on phone alert devices. Devices turned on by membership are revoked, because the backend
-- before 9 sends alerts to the WARD_COORDINATOR_USER_IDS accounts only. The backend accepts
-- versions 5 to 9, so it keeps working. Refuses unless the database is at exactly 9.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 9 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 9';
  END IF;
END $$;
-- Cover rows stay as ended records (break glass rows may point at them), so nothing is deleted.
UPDATE ward_flow.memberships SET revoked_at = now(), revoked_by = granted_by WHERE kind = 'cover' AND revoked_at IS NULL;
UPDATE ward_flow.push_subscriptions SET revoked_at = now() WHERE membership_id IS NOT NULL AND revoked_at IS NULL;
DELETE FROM ward_flow.push_deliveries d USING ward_flow.push_subscriptions s
  WHERE d.subscription_id = s.id AND s.membership_id IS NOT NULL;
ALTER TABLE ward_flow.push_subscriptions DROP COLUMN membership_id;
DROP TABLE ward_flow.access_requests;
ALTER TABLE ward_flow.memberships DROP CONSTRAINT memberships_cover_role;
ALTER TABLE ward_flow.memberships DROP COLUMN last_used_at;
ALTER TABLE ward_flow.memberships DROP COLUMN kind;
DELETE FROM ward_flow.migrations WHERE version = 9;
