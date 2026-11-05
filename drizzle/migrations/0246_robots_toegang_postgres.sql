-- A30/A31: ook de beheerverbinding (sessie als postgres) mag de robotfuncties aanroepen.
-- session_user, niet current_user: binnen SECURITY DEFINER is current_user altijd de eigenaar.
CREATE OR REPLACE FUNCTION public.robot_toegang(_extra_rollen app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT session_user = 'postgres'
      OR coalesce(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_extra_rollen)));
$$;
REVOKE ALL ON FUNCTION public.robot_toegang(app_role[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.opvolger_ronde()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_open int; v_oudste numeric; v_items jsonb; v_nieuw int; v_tweede int;
BEGIN
  IF NOT public.robot_toegang(ARRAY['admin']::app_role[]) THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  CREATE TEMP TABLE _open ON COMMIT DROP AS SELECT * FROM public.opvolg_open_basis();
  SELECT count(*), round(coalesce(max(extract(epoch FROM now()-aangemaakt_op)/3600),0)::numeric,1) INTO v_open, v_oudste FROM _open;
  WITH s1 AS (
    INSERT INTO opvolg_signalen(item_soort,item_id,signaal_1_op)
    SELECT item_soort, item_id, now() FROM _open
    ON CONFLICT (item_soort,item_id) DO NOTHING RETURNING item_soort, item_id, 1 AS signaal),
  s2 AS (
    UPDATE opvolg_signalen s SET signaal_2_op = now() FROM _open o
    WHERE s.item_soort=o.item_soort AND s.item_id=o.item_id AND s.signaal_2_op IS NULL
      AND s.signaal_1_op IS NOT NULL AND s.signaal_1_op < now() - interval '1 minute'
      AND o.aangemaakt_op < now() - interval '24 hours'
    RETURNING s.item_soort, s.item_id, 2 AS signaal),
  alle AS (SELECT * FROM s1 UNION ALL SELECT * FROM s2)
  SELECT coalesce(jsonb_agg(jsonb_build_object('soort',a.item_soort,'id',a.item_id,'signaal',a.signaal,
           'uren_open',round((extract(epoch FROM now()-o.aangemaakt_op)/3600)::numeric,1),'stap',o.stap,'pakket',o.pakket)
           ORDER BY o.aangemaakt_op),'[]'::jsonb),
         count(*) FILTER (WHERE a.signaal=1), count(*) FILTER (WHERE a.signaal=2)
    INTO v_items, v_nieuw, v_tweede
  FROM alle a JOIN _open o ON o.item_soort=a.item_soort AND o.item_id=a.item_id;
  RETURN jsonb_build_object('open',v_open,'nieuw_gesignaleerd',v_nieuw,'tweede_signaal',v_tweede,'oudste_open_uren',v_oudste,'items',v_items);
END $$;

CREATE OR REPLACE FUNCTION public.hartslag_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.robot_toegang(ARRAY['admin','supervisor']::app_role[]) THEN
    RAISE EXCEPTION 'geen toegang' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('onderdeel', onderdeel, 'metingen', metingen,
           'rood', jsonb_array_length(metingen) = 2 AND NOT (metingen->0->>'ok')::boolean AND NOT (metingen->1->>'ok')::boolean) ORDER BY onderdeel)
    FROM (SELECT onderdeel, jsonb_agg(jsonb_build_object('op', gemeten_op, 'ok', ok, 'reden', reden) ORDER BY gemeten_op DESC) metingen
          FROM (SELECT *, row_number() OVER (PARTITION BY onderdeel ORDER BY gemeten_op DESC) rn FROM hartslag_metingen) x
          WHERE rn <= 2 GROUP BY onderdeel) y), '[]'::jsonb);
END $$;