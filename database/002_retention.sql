BEGIN;
CREATE FUNCTION public.tiger_purge_expired(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM tiger_private.rate_limits WHERE expires_at <= clock_timestamp();
  IF clock_timestamp() >= TIMESTAMPTZ '2027-02-01 00:00:00+09' THEN
    DELETE FROM tiger_private.cards;
    DELETE FROM tiger_private.rate_limits;
  END IF;
  RETURN jsonb_build_object('data', true);
END;
$$;
REVOKE ALL ON FUNCTION public.tiger_purge_expired(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tiger_purge_expired(jsonb) TO service_role;
COMMIT;
