-- Ward Flow holds synthetic data only (D-55), so no workspace may be labelled live. Stops before
-- changing anything if any workspace is not prototype. commands and audit follow through their
-- composite foreign keys, and the trigger that blocks relabelling stays.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ward_flow.workspaces WHERE data_mode <> 'prototype') THEN
    RAISE EXCEPTION 'A Ward Flow workspace is not prototype; inspect before removing the live mode';
  END IF;
END $$;
ALTER TABLE ward_flow.workspaces DROP CONSTRAINT workspaces_data_mode_check;
ALTER TABLE ward_flow.workspaces ADD CONSTRAINT workspaces_data_mode_check CHECK (data_mode = 'prototype');
INSERT INTO ward_flow.migrations(version) VALUES(7);
