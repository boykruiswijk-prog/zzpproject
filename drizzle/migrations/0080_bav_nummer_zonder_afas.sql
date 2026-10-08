CREATE TABLE public.bav_nummer_bevestigingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  nummer text NOT NULL CHECK (length(btrim(nummer)) >= 3),
  herkomst text NOT NULL,
  toelichting text,
  bevestigd_door uuid NOT NULL,
  bevestigd_op timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onderneming_id, nummer)
);
GRANT SELECT ON public.bav_nummer_bevestigingen TO authenticated;
GRANT ALL ON public.bav_nummer_bevestigingen TO service_role;
ALTER TABLE public.bav_nummer_bevestigingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest BAV-bevestigingen" ON public.bav_nummer_bevestigingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
COMMENT ON TABLE public.bav_nummer_bevestigingen IS 'Door het team bevestigde BAV-nummers (alleen via RPC bav_nummer_bevestigen).';

-- AFAS-abonnementsnummers zijn geen BAV-nummer: bron afas_abonnement, nooit gekozen als BAV-nummer.
CREATE OR REPLACE VIEW public.crm_bav_nummers WITH (security_invoker = on) AS
WITH basis AS (
SELECT 'zp'::text AS bron, btrim(p.certificate_number) AS nummer, p.onderneming_id, p.lead_id, p.id AS policy_id, NULL::uuid AS contract_id, p.status, p.created_at AS datum
  FROM public.policies p WHERE coalesce(btrim(p.certificate_number),'') <> ''
UNION ALL
SELECT 'zp', btrim(kc.certificaatnummer), kc.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, kc.koppeling_status, kc.aanvraagdatum::timestamptz
  FROM public.klant_certificaten kc WHERE kc.onderneming_id IS NOT NULL AND kc.koppeling_status = 'bevestigd' AND coalesce(btrim(kc.certificaatnummer),'') <> ''
UNION ALL
SELECT 'afas_abonnement', btrim(k.abonnement_nr), k.onderneming_id, NULL::uuid, NULL::uuid, k.id, k.status, k.begin_datum::timestamptz
  FROM public.klant_contracten k WHERE coalesce(btrim(k.abonnement_nr),'') <> ''
UNION ALL
SELECT CASE WHEN a.polisnummer ~* '^\s*HPI\.' THEN 'hiscox' ELSE 'klant' END, upper(btrim(a.polisnummer)), a.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, a.status, a.created_at
  FROM public.klant_service_aanvragen a WHERE coalesce(btrim(a.polisnummer),'') <> ''
UNION ALL
SELECT 'bevestigd', btrim(v.nummer), v.onderneming_id, NULL::uuid, NULL::uuid, NULL::uuid, 'bevestigd', v.bevestigd_op
  FROM public.bav_nummer_bevestigingen v
)
SELECT * FROM basis
UNION ALL
SELECT 'overgenomen', btrim(o.bav_nummer), o.naar_onderneming_id, o.lead_id, NULL::uuid, NULL::uuid, 'leidend',
       coalesce((SELECT min(b.datum) FROM basis b WHERE b.onderneming_id = o.van_onderneming_id AND b.nummer = btrim(o.bav_nummer)), o.vastgelegd_op)
  FROM public.onderneming_opvolging o WHERE coalesce(btrim(o.bav_nummer),'') <> ''
UNION ALL
SELECT 'overgenomen', b.nummer, o.naar_onderneming_id, o.lead_id, NULL::uuid, NULL::uuid, 'meegenomen', min(b.datum)
  FROM public.onderneming_opvolging o JOIN basis b ON b.onderneming_id = o.van_onderneming_id AND b.bron IN ('zp','bevestigd') AND b.nummer <> btrim(o.bav_nummer)
 WHERE coalesce(btrim(o.bav_nummer),'') <> ''
 GROUP BY b.nummer, o.naar_onderneming_id, o.lead_id;
REVOKE ALL ON public.crm_bav_nummers FROM anon, public;
GRANT SELECT ON public.crm_bav_nummers TO authenticated;
GRANT SELECT ON public.crm_bav_nummers TO service_role;

CREATE OR REPLACE FUNCTION public.bav_nummer_bevestigen(_onderneming_id uuid, _nummer text, _toelichting text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nr text := upper(btrim(coalesce(_nummer,''))); v_id uuid;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_bav_nummers b WHERE b.onderneming_id = _onderneming_id AND b.bron = 'klant' AND upper(b.nummer) = v_nr) THEN
    RAISE EXCEPTION 'alleen een door de klant opgegeven BAV-nummer van deze klant kan worden bevestigd'; END IF;
  INSERT INTO public.bav_nummer_bevestigingen (onderneming_id, nummer, herkomst, toelichting, bevestigd_door)
  VALUES (_onderneming_id, v_nr, 'klant', nullif(btrim(coalesce(_toelichting,'')),''), auth.uid())
  ON CONFLICT (onderneming_id, nummer) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
    VALUES ('bav_nummer_bevestigingen', v_id, 'bav_nummer_bevestigd', 'nummer', NULL, v_nr, auth.uid(), public.get_user_role_label(auth.uid()), jsonb_build_object('onderneming_id', _onderneming_id, 'herkomst', 'klant'));
    PERFORM public.crm_notitie_toevoegen(_onderneming_id, NULL, 'notitie', 'BAV-nummer ' || v_nr || ' bevestigd (opgegeven door klant).', jsonb_build_object('bav_nummer', v_nr));
  END IF;
  RETURN jsonb_build_object('nummer', v_nr, 'nieuw', v_id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.bav_nummer_bevestigen(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bav_nummer_bevestigen(uuid, text, text) TO authenticated;

-- Leidend bij omzetting: overgenomen leidend, bevestigd of ZP-certificaat (oudste); anders opgave klant (bevestigd=false). Nooit AFAS.
CREATE OR REPLACE FUNCTION public.omzetting_leidend_bav(_van uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT b.nummer, b.bron, min(b.datum)::date AS datum INTO r FROM public.crm_bav_nummers b
   WHERE b.onderneming_id = _van AND (b.bron IN ('zp','bevestigd','klant') OR (b.bron = 'overgenomen' AND b.status = 'leidend'))
   GROUP BY b.nummer, b.bron
   ORDER BY (b.bron = 'overgenomen') DESC, (b.bron = 'klant'), min(b.datum) NULLS LAST, b.nummer LIMIT 1;
  IF r.nummer IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('nummer', r.nummer, 'bron', r.bron, 'datum', r.datum, 'bevestigd', r.bron <> 'klant');
END $$;
REVOKE ALL ON FUNCTION public.omzetting_leidend_bav(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.omzetting_leidend_bav(uuid) TO authenticated;

-- omzetting_vastleggen: onbevestigd leidend nummer wordt eerst (gelogd) bevestigd bij de voorganger.
DO $do$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.omzetting_vastleggen(uuid,uuid,text,text,text)'::regprocedure);
  d := replace(d, $a$IF v_nummer IS NULL THEN RAISE EXCEPTION 'bij de voorganger is geen BAV-nummer bekend'; END IF;$a$,
    $a$IF v_nummer IS NULL THEN RAISE EXCEPTION 'bij de voorganger is geen BAV-nummer bekend'; END IF;
    IF NOT coalesce((v_leidend->>'bevestigd')::boolean, false) THEN
      PERFORM public.bav_nummer_bevestigen(_van, v_nummer, 'bevestigd bij omzetting');
      v_herkomst := 'bevestigd';
    END IF;$a$);
  IF position('bav_nummer_bevestigen' in d) = 0 THEN RAISE EXCEPTION 'vervanging omzetting_vastleggen mislukt'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.zoek_universeel'::regproc);
  d := replace(d, $a$'BAV-/polisnummer ' || b.nummer$a$, $a$CASE WHEN b.bron = 'afas_abonnement' THEN 'AFAS-abonnementsnummer (oud systeem) ' WHEN b.bron = 'klant' THEN 'BAV-nummer (opgegeven door klant) ' WHEN b.bron = 'hiscox' THEN 'Hiscox-polis ' ELSE 'BAV-nummer ' END || b.nummer$a$);
  IF position('afas_abonnement' in d) = 0 THEN RAISE EXCEPTION 'vervanging zoek_universeel mislukt'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.zoek_koppel_kandidaten'::regproc);
  d := replace(d, $a$'BAV-nummer ' || b.nummer || ' komt overeen'$a$, $a$CASE WHEN b.bron = 'afas_abonnement' THEN 'AFAS-abonnementsnummer (oud systeem) ' ELSE 'BAV-nummer ' END || b.nummer || ' komt overeen'$a$);
  IF position('afas_abonnement' in d) = 0 THEN RAISE EXCEPTION 'vervanging zoek_koppel_kandidaten mislukt'; END IF;
  EXECUTE d;
END $do$;