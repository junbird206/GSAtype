-- Apply once as the Supabase postgres/admin role. No browser-accessible tables.
BEGIN;

CREATE SCHEMA tiger_private;
REVOKE ALL ON SCHEMA tiger_private FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION tiger_private.valid_scores(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  item record;
  keys constant text[] := ARRAY['grade', 'stamina', 'social', 'teamwork', 'mental', 'goyeon'];
BEGIN
  IF value IS NULL OR jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(value)) <> 6 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(value) LOOP
    IF NOT (item.key = ANY(keys)) OR item.value NOT IN ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb, '5'::jsonb) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE TABLE tiger_private.cards (
  id uuid PRIMARY KEY,
  share_id text NOT NULL UNIQUE CHECK (share_id ~ '^[A-Za-z0-9_-]{12}$'),
  owner_key_hash text NOT NULL CHECK (owner_key_hash ~ '^[0-9a-f]{64}$'),
  owner_device_hash text NOT NULL CHECK (owner_device_hash ~ '^[0-9a-f]{64}$'),
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 10 AND nickname !~ '[[:cntrl:]]'),
  self_scores jsonb NOT NULL CHECK (tiger_private.valid_scores(self_scores)),
  channel text CHECK (channel ~ '^[a-zA-Z0-9_-]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tiger_private.ratings (
  card_id uuid NOT NULL REFERENCES tiger_private.cards(id) ON DELETE CASCADE,
  device_hash text NOT NULL CHECK (device_hash ~ '^[0-9a-f]{64}$'),
  scores jsonb NOT NULL CHECK (tiger_private.valid_scores(scores)),
  channel text CHECK (channel ~ '^[a-zA-Z0-9_-]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, device_hash)
);

CREATE TABLE tiger_private.rate_limits (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry ON tiger_private.rate_limits(expires_at);

ALTER TABLE tiger_private.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiger_private.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiger_private.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA tiger_private FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION tiger_private.card_snapshot(card tiger_private.cards, is_owner boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  total integer;
  averages jsonb;
  result jsonb;
BEGIN
  SELECT count(*), jsonb_build_object(
    'grade', avg((scores->>'grade')::numeric),
    'stamina', avg((scores->>'stamina')::numeric),
    'social', avg((scores->>'social')::numeric),
    'teamwork', avg((scores->>'teamwork')::numeric),
    'mental', avg((scores->>'mental')::numeric),
    'goyeon', avg((scores->>'goyeon')::numeric)
  ) INTO total, averages FROM tiger_private.ratings WHERE card_id = card.id;
  result := jsonb_build_object(
    'shareId', card.share_id, 'nickname', card.nickname, 'count', total,
    'unlocked', total >= 3, 'averages', CASE WHEN total >= 3 THEN averages ELSE NULL END,
    'createdAt', card.created_at
  );
  IF is_owner THEN result := result || jsonb_build_object('id', card.id, 'selfScores', card.self_scores); END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.tiger_consume_rate(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  request_time timestamptz := clock_timestamp();
  maximum integer := (p_input->>'limit')::integer;
  consumed integer;
BEGIN
  IF maximum IS NULL OR maximum < 1 OR maximum > 1000 OR p_input->>'key' IS NULL THEN
    RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
  END IF;
  DELETE FROM tiger_private.rate_limits WHERE expires_at <= request_time;
  INSERT INTO tiger_private.rate_limits AS rate (key, count, expires_at)
    VALUES (p_input->>'key', 1, date_trunc('minute', request_time) + interval '1 minute')
    ON CONFLICT (key) DO UPDATE SET count = rate.count + 1 WHERE rate.count < maximum
    RETURNING count INTO consumed;
  RETURN jsonb_build_object('data', jsonb_build_object('allowed', consumed IS NOT NULL));
EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
END;
$$;

CREATE FUNCTION public.tiger_create_card(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  nickname text := p_input->>'nickname';
  folded text;
BEGIN
  -- Baseline moderation is also enforced in the HTTP handler, including invisible characters.
  folded := regexp_replace(normalize(lower(nickname), NFKC), '[[:punct:][:space:]]', '', 'g');
  IF folded ~ U&'fuck|shit|bitch|\C2DC\BC1C|\C528\BC1C|\BCD1\C2E0|\AC1C\C0C8\B07C|\C9C0\B784' THEN
    RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
  END IF;
  INSERT INTO tiger_private.cards (id, share_id, owner_key_hash, owner_device_hash, nickname, self_scores, channel)
    VALUES ((p_input->>'id')::uuid, p_input->>'shareId', p_input->>'ownerHash', p_input->>'deviceHash',
      nickname, p_input->'selfScores', p_input->>'channel');
  RETURN jsonb_build_object('data', NULL);
EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
  RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
END;
$$;

CREATE FUNCTION public.tiger_get_public_card(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE card tiger_private.cards;
BEGIN
  SELECT * INTO card FROM tiger_private.cards WHERE share_id = p_input->>'shareId';
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  RETURN jsonb_build_object('data', tiger_private.card_snapshot(card));
END;
$$;

CREATE FUNCTION public.tiger_get_owner_card(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE card tiger_private.cards;
BEGIN
  SELECT * INTO card FROM tiger_private.cards WHERE id = (p_input->>'id')::uuid;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF card.owner_key_hash IS DISTINCT FROM p_input->>'ownerHash' THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;
  RETURN jsonb_build_object('data', tiger_private.card_snapshot(card, true));
END;
$$;

CREATE FUNCTION public.tiger_submit_rating(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE card tiger_private.cards;
BEGIN
  IF NOT tiger_private.valid_scores(p_input->'scores') OR p_input->>'deviceHash' IS NULL THEN
    RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
  END IF;
  -- All inserts for a card take this row lock before checking duplicate/count limits.
  SELECT * INTO card FROM tiger_private.cards WHERE share_id = p_input->>'shareId' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF card.owner_device_hash = p_input->>'deviceHash' THEN RETURN jsonb_build_object('error', 'OWNER_CANNOT_RATE'); END IF;
  IF EXISTS (SELECT 1 FROM tiger_private.ratings WHERE card_id = card.id AND device_hash = p_input->>'deviceHash') THEN
    RETURN jsonb_build_object('error', 'ALREADY_RATED');
  END IF;
  IF (SELECT count(*) FROM tiger_private.ratings WHERE card_id = card.id) >= 30 THEN
    RETURN jsonb_build_object('error', 'RATING_LIMIT');
  END IF;
  INSERT INTO tiger_private.ratings (card_id, device_hash, scores, channel)
    VALUES (card.id, p_input->>'deviceHash', p_input->'scores', p_input->>'channel');
  RETURN jsonb_build_object('data', tiger_private.card_snapshot(card));
EXCEPTION WHEN check_violation OR not_null_violation THEN
  RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
END;
$$;

CREATE FUNCTION public.tiger_delete_card(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE card tiger_private.cards;
BEGIN
  SELECT * INTO card FROM tiger_private.cards WHERE id = (p_input->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF card.owner_key_hash IS DISTINCT FROM p_input->>'ownerHash' THEN RETURN jsonb_build_object('error', 'UNAUTHORIZED'); END IF;
  DELETE FROM tiger_private.cards WHERE id = card.id;
  RETURN jsonb_build_object('data', NULL);
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tiger_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.tiger_consume_rate(jsonb), public.tiger_create_card(jsonb),
  public.tiger_get_public_card(jsonb), public.tiger_get_owner_card(jsonb),
  public.tiger_submit_rating(jsonb), public.tiger_delete_card(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tiger_consume_rate(jsonb), public.tiger_create_card(jsonb),
  public.tiger_get_public_card(jsonb), public.tiger_get_owner_card(jsonb),
  public.tiger_submit_rating(jsonb), public.tiger_delete_card(jsonb) TO service_role;

COMMIT;
