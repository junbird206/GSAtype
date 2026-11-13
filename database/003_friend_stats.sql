-- Apply after 001 and 002. Existing cards keep their original score keys and meaning.
BEGIN;

CREATE OR REPLACE FUNCTION tiger_private.valid_scores(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item record;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(value)) <> 6 THEN RETURN false; END IF;
  IF NOT (
    value ?& ARRAY['grade', 'stamina', 'social', 'teamwork', 'mental', 'goyeon'] OR
    value ?& ARRAY['intelligence', 'stamina', 'character', 'wealth', 'charm', 'humor']
  ) THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_each(value) LOOP
    IF item.value NOT IN ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb, '5'::jsonb) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION tiger_private.card_snapshot(card tiger_private.cards, is_owner boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  total integer;
  averages jsonb;
  result jsonb;
BEGIN
  SELECT count(*) INTO total FROM tiger_private.ratings WHERE card_id = card.id;
  IF total >= 3 THEN
    SELECT jsonb_object_agg(stat.key, stat.mean) INTO averages FROM (
      SELECT entry.key, avg((entry.value #>> '{}')::numeric) AS mean
      FROM tiger_private.ratings AS rating CROSS JOIN LATERAL jsonb_each(rating.scores) AS entry
      WHERE rating.card_id = card.id GROUP BY entry.key
    ) AS stat;
  END IF;
  result := jsonb_build_object(
    'shareId', card.share_id, 'nickname', card.nickname, 'count', total,
    'statVersion', CASE WHEN card.self_scores ? 'intelligence' THEN 'friends-v2' ELSE 'campus-v1' END,
    'unlocked', total >= 3, 'averages', averages, 'createdAt', card.created_at
  );
  IF is_owner THEN result := result || jsonb_build_object('id', card.id, 'selfScores', card.self_scores); END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.tiger_submit_rating(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE card tiger_private.cards;
BEGIN
  IF NOT tiger_private.valid_scores(p_input->'scores') OR p_input->>'deviceHash' IS NULL THEN
    RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
  END IF;
  SELECT * INTO card FROM tiger_private.cards WHERE share_id = p_input->>'shareId' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'NOT_FOUND'); END IF;
  IF NOT (card.self_scores ?& ARRAY(SELECT jsonb_object_keys(p_input->'scores'))) THEN
    RETURN jsonb_build_object('error', 'VALIDATION_ERROR');
  END IF;
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

COMMIT;
