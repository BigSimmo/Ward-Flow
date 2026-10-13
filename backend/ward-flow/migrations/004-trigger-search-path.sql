-- Pin the existing trigger functions to trusted schemas without changing their bodies.
ALTER FUNCTION ward_flow.protect_audit() SET search_path = pg_catalog, ward_flow;
ALTER FUNCTION ward_flow.protect_workspace_mode() SET search_path = pg_catalog, ward_flow;
INSERT INTO ward_flow.migrations(version) VALUES(4);
