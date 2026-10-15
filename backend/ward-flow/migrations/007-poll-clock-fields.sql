-- Keep the small poll projection independent of the bounded workspace JSON document.
ALTER TABLE ward_flow.workspaces ADD COLUMN started_at timestamptz;
ALTER TABLE ward_flow.workspaces ADD COLUMN clock_offset_minutes numeric;
UPDATE ward_flow.workspaces
SET started_at = (payload->>'startedAt')::timestamptz,
    clock_offset_minutes = (payload->'state'->>'clockOffsetMinutes')::numeric;
CREATE FUNCTION ward_flow.sync_poll_clock_fields() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.started_at := (NEW.payload->>'startedAt')::timestamptz;
  NEW.clock_offset_minutes := (NEW.payload->'state'->>'clockOffsetMinutes')::numeric;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_poll_clock_fields BEFORE INSERT OR UPDATE OF payload ON ward_flow.workspaces
FOR EACH ROW EXECUTE FUNCTION ward_flow.sync_poll_clock_fields();
INSERT INTO ward_flow.migrations(version) VALUES(7);
