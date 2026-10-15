-- Undo migration 007. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-007-prototype-only.sql
-- Restores the original check exactly. The backend accepts versions 5 to 7, so it keeps working.
ALTER TABLE ward_flow.workspaces DROP CONSTRAINT workspaces_data_mode_check;
ALTER TABLE ward_flow.workspaces ADD CONSTRAINT workspaces_data_mode_check CHECK (data_mode IN ('prototype', 'live'));
DELETE FROM ward_flow.migrations WHERE version = 7;
