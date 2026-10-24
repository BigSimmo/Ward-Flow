-- Opening a referral's full detail is logged as a record view too (role access plan v2, D-80):
-- since D-79 a ward sees the person's name, UMRN and documents there before it answers. Adds
-- 'referral' to the screens the record access log accepts. No row, grant or policy changes.
ALTER TABLE ward_flow.record_access DROP CONSTRAINT record_access_surface_check;
ALTER TABLE ward_flow.record_access ADD CONSTRAINT record_access_surface_check CHECK (surface IN ('patient', 'movement', 'referral'));
INSERT INTO ward_flow.migrations(version) VALUES(13);
