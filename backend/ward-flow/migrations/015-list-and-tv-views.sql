-- The server logs each desk's reads of its whole list and of the TV board (H-0731, governance
-- GV-13), not only the patient and movement pages the browser reports. Adds 'list' and 'tv' to the
-- screens the record access log accepts. Such a row names no single record: its patient_id is '*'.
-- No row, grant or policy changes.
ALTER TABLE ward_flow.record_access DROP CONSTRAINT record_access_surface_check;
ALTER TABLE ward_flow.record_access ADD CONSTRAINT record_access_surface_check CHECK (surface IN ('patient', 'movement', 'referral', 'list', 'tv'));
INSERT INTO ward_flow.migrations(version) VALUES(15);
