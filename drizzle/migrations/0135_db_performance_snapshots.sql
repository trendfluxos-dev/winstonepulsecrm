CREATE TABLE public.db_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  db_size_bytes bigint NOT NULL,
  total_calls bigint NOT NULL,
  total_exec_ms double precision NOT NULL,
  top_queries jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT ALL ON public.db_performance_snapshots TO service_role;
ALTER TABLE public.db_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX db_performance_snapshots_captured_idx ON public.db_performance_snapshots (captured_at DESC);

CREATE OR REPLACE FUNCTION public.capture_db_performance_snapshot()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.db_performance_snapshots (db_size_bytes, total_calls, total_exec_ms, top_queries)
  SELECT pg_database_size(current_database()),
    COALESCE((SELECT sum(calls) FROM extensions.pg_stat_statements s WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())), 0),
    COALESCE((SELECT sum(total_exec_time) FROM extensions.pg_stat_statements s WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())), 0),
    COALESCE((SELECT jsonb_agg(q) FROM (
      SELECT left(regexp_replace(query, '\s+', ' ', 'g'), 240) AS query, calls, round(mean_exec_time::numeric, 2) AS mean_ms, round(total_exec_time::numeric, 0) AS total_ms
      FROM extensions.pg_stat_statements s
      WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database()) AND query ILIKE '%"public".%'
      ORDER BY total_exec_time DESC LIMIT 10) q), '[]'::jsonb)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.capture_db_performance_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_db_performance_snapshot() TO service_role;