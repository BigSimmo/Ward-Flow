-- Supabase-only privilege hardening. Apply after inspecting the exact helper.
-- Preserve its body, owner and automatic-RLS event trigger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0 AND p.prokind = 'f' AND p.prosecdef
      AND p.prorettype = 'event_trigger'::regtype
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND EXISTS (SELECT 1 FROM pg_event_trigger e
                  WHERE e.evtfoid = p.oid AND e.evtname = 'ensure_rls'
                    AND e.evtevent = 'ddl_command_end' AND e.evtenabled = 'O')
  ) THEN
    RAISE EXCEPTION 'Automatic RLS helper differs from reviewed Supabase identity';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
