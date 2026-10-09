-- Existing Ward Flow worlds were exclusively synthetic. Live workspaces must be
-- created separately, never by relabelling demonstration records.
ALTER TABLE ward_flow.workspaces ADD COLUMN data_mode text NOT NULL DEFAULT 'prototype'
  CHECK (data_mode IN ('prototype', 'live'));
ALTER TABLE ward_flow.workspaces ADD CONSTRAINT workspace_mode_unique UNIQUE(id, data_mode);
ALTER TABLE ward_flow.commands ADD COLUMN data_mode text NOT NULL DEFAULT 'prototype';
ALTER TABLE ward_flow.commands ADD CONSTRAINT command_workspace_mode FOREIGN KEY(workspace_id, data_mode)
  REFERENCES ward_flow.workspaces(id, data_mode);
ALTER TABLE ward_flow.audit ADD COLUMN data_mode text NOT NULL DEFAULT 'prototype';
ALTER TABLE ward_flow.audit ADD CONSTRAINT audit_workspace_mode FOREIGN KEY(workspace_id, data_mode)
  REFERENCES ward_flow.workspaces(id, data_mode);
CREATE FUNCTION ward_flow.protect_workspace_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_mode IS DISTINCT FROM OLD.data_mode THEN
    RAISE EXCEPTION 'Ward Flow workspace data mode cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_workspace_mode BEFORE UPDATE ON ward_flow.workspaces
FOR EACH ROW EXECUTE FUNCTION ward_flow.protect_workspace_mode();
INSERT INTO ward_flow.migrations(version) VALUES(2);
