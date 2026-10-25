-- Undoes infra/supabase-prune-role.sql: removes the receipt clean-up function, its schema and the
-- wardflow_pruner login. Removes no Ward Flow data. Apply as the migration administrator.
DROP FUNCTION IF EXISTS ward_flow_ops.prune_receipts(integer);
DROP SCHEMA IF EXISTS ward_flow_ops;
DROP ROLE IF EXISTS wardflow_pruner;
