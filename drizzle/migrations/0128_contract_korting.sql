-- Korting per contractregel (besluit Boy 13 okt 2026, A13). bedrag_per_periode blijft ongewijzigd; korting wordt berekend.
ALTER TABLE public.klant_contracten
  ADD COLUMN IF NOT EXISTS korting_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS korting_reden text,
  ADD COLUMN IF NOT EXISTS korting_vanaf date,
  ADD COLUMN IF NOT EXISTS korting_tot date,
  ADD COLUMN IF NOT EXISTS korting_door uuid,
  ADD COLUMN IF NOT EXISTS korting_op timestamptz;
ALTER TABLE public.klant_contracten ADD CONSTRAINT klant_contracten_korting_geldig CHECK (
  korting_pct IS NULL OR (korting_pct > 0 AND korting_pct < 100 AND korting_vanaf IS NOT NULL AND length(trim(coalesce(korting_reden,''))) >= 3
    AND (korting_tot IS NULL OR korting_tot >= korting_vanaf)));

-- Percentage dat geldt voor een periode die op _ps begint (null = geen korting).
CREATE OR REPLACE FUNCTION public.korting_voor_periode(_pct numeric, _vanaf date, _tot date, _ps date)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _pct IS NOT NULL AND _vanaf IS NOT NULL AND _ps >= _vanaf AND (_tot IS NULL OR _ps <= _tot) THEN _pct END
$$;
-- Stuksprijs na korting: round(basis * (1 - pct/100), 2).
CREATE OR REPLACE FUNCTION public.korting_netto(_basis numeric, _pct numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _pct IS NULL THEN _basis ELSE round(_basis * (1 - _pct / 100), 2) END
$$;

-- Eerstvolgende niet-gefactureerde periode: max(gefactureerd_tm + 1, volgende_factuurdatum, vandaag).
CREATE OR REPLACE FUNCTION public.korting_grens(_contract_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(coalesce(k.gefactureerd_tm + 1, k.volgende_factuurdatum, (now() AT TIME ZONE 'Europe/Amsterdam')::date),
                  coalesce(k.volgende_factuurdatum, (now() AT TIME ZONE 'Europe/Amsterdam')::date),
                  (now() AT TIME ZONE 'Europe/Amsterdam')::date)
  FROM public.klant_contracten k WHERE k.id = _contract_id
$$;

-- Kortingvelden alleen via de RPC's
CREATE OR REPLACE FUNCTION public.guard_contract_korting()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('zp.korting_rpc', true),'0') <> '1' AND (
       NEW.korting_pct IS DISTINCT FROM OLD.korting_pct OR NEW.korting_reden IS DISTINCT FROM OLD.korting_reden
    OR NEW.korting_vanaf IS DISTINCT FROM OLD.korting_vanaf OR NEW.korting_tot IS DISTINCT FROM OLD.korting_tot
    OR NEW.korting_door IS DISTINCT FROM OLD.korting_door OR NEW.korting_op IS DISTINCT FROM OLD.korting_op) THEN
    RAISE EXCEPTION 'Korting alleen wijzigen via de knop Korting' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_contract_korting ON public.klant_contracten;
CREATE TRIGGER trg_guard_contract_korting BEFORE UPDATE ON public.klant_contracten FOR EACH ROW EXECUTE FUNCTION public.guard_contract_korting();

-- Voorbeeld voor de dialoog: eerste periode met korting, oude en nieuwe stuksprijs, en of er al een concept in Exact staat.
CREATE OR REPLACE FUNCTION public.contract_korting_voorbeeld(_contract_id uuid, _pct numeric, _vanaf date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.klant_contracten; g date; ps date; n int := 0; basis numeric; conc date;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  SELECT * INTO k FROM public.klant_contracten WHERE id=_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  g := public.korting_grens(_contract_id);
  IF k.volgende_factuurdatum IS NOT NULL THEN
    LOOP
      ps := public.factuur_periode_start(k.volgende_factuurdatum, k.cyclus, n);
      EXIT WHEN ps >= coalesce(_vanaf, g) OR n > 500;
      n := n + 1;
    END LOOP;
  END IF;
  basis := CASE WHEN ps IS NULL THEN NULL ELSE public.contract_bedrag_voor_periode(k.tarief_type, k.starter_tot, k.bedrag_per_periode, k.bedrag_na_starter, ps) END;
  SELECT min(periode_start) INTO conc FROM public.factuur_planning
   WHERE klant_contract_id=_contract_id AND status IN ('concept_aangemaakt','te_laat') AND periode_start >= coalesce(_vanaf, g);
  RETURN jsonb_build_object('grens', g, 'periode_start', ps, 'periode_eind', CASE WHEN ps IS NULL THEN NULL ELSE public.factuur_periode_eind(ps, k.cyclus) END,
    'cyclus', k.cyclus, 'aantal', k.aantal, 'itemcode', k.itemcode, 'product', k.product,
    'basis', basis, 'netto', CASE WHEN basis IS NULL OR _pct IS NULL THEN NULL ELSE public.korting_netto(basis, _pct) END,
    'concept_periode', conc, 'status', k.status);
END $$;

CREATE OR REPLACE FUNCTION public.zet_contract_korting(_contract_id uuid, _pct numeric, _reden text, _vanaf date, _tot date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.klant_contracten; g date; naam text; oud jsonb; nieuw jsonb; conc date; ond_test boolean;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF _pct IS NULL OR _pct <= 0 OR _pct >= 100 THEN RAISE EXCEPTION 'percentage moet groter dan 0 en kleiner dan 100 zijn'; END IF;
  IF length(trim(coalesce(_reden,''))) < 3 OR length(trim(_reden)) > 500 THEN RAISE EXCEPTION 'reden verplicht (3-500 tekens)'; END IF;
  IF _vanaf IS NULL THEN RAISE EXCEPTION 'vanaf-datum ontbreekt'; END IF;
  IF _tot IS NOT NULL AND _tot < _vanaf THEN RAISE EXCEPTION 'tot-datum ligt voor de vanaf-datum'; END IF;
  SELECT * INTO k FROM public.klant_contracten WHERE id=_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  IF k.status NOT IN ('actief','loopt_af','einddatum_controle') THEN RAISE EXCEPTION 'Korting kan alleen op een lopend contract (status %)', k.status; END IF;
  g := public.korting_grens(_contract_id);
  IF _vanaf < g THEN
    RAISE EXCEPTION 'Korting kan alleen vanaf de volgende factuurperiode (%); al gefactureerde perioden via een creditnota.', to_char(g,'DD-MM-YYYY');
  END IF;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  oud := CASE WHEN k.korting_pct IS NULL THEN NULL ELSE jsonb_build_object('pct',k.korting_pct,'reden',k.korting_reden,'vanaf',k.korting_vanaf,'tot',k.korting_tot) END;
  nieuw := jsonb_build_object('pct',_pct,'reden',trim(_reden),'vanaf',_vanaf,'tot',_tot);
  PERFORM set_config('zp.korting_rpc','1',true);
  UPDATE public.klant_contracten SET korting_pct=_pct, korting_reden=trim(_reden), korting_vanaf=_vanaf, korting_tot=_tot, korting_door=auth.uid(), korting_op=now() WHERE id=_contract_id;
  PERFORM set_config('zp.korting_rpc','0',true);
  INSERT INTO public.sensitive_audit_log (target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol,details)
  VALUES ('klant_contracten',_contract_id, CASE WHEN oud IS NULL THEN 'korting_gezet' ELSE 'korting_vervangen' END,'korting',oud::text,nieuw::text,auth.uid(),public.get_user_role_label(auth.uid()),
    jsonb_build_object('onderneming_id',k.onderneming_id,'grens',g));
  SELECT o.is_test INTO ond_test FROM public.ondernemingen o WHERE o.id=k.onderneming_id;
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,is_test)
  VALUES (CASE WHEN oud IS NULL THEN 'korting_gezet' ELSE 'korting_vervangen' END,
    CASE WHEN oud IS NULL THEN 'Korting ingesteld: ' ELSE 'Korting vervangen (was ' || (oud->>'pct') || '%): ' END
    || _pct::text || '% vanaf ' || to_char(_vanaf,'DD-MM-YYYY') || CASE WHEN _tot IS NULL THEN ' (onbepaald)' ELSE ' t/m ' || to_char(_tot,'DD-MM-YYYY') END
    || ', contractregel ' || coalesce(k.bron_rij::text,'?') || ' (' || coalesce(k.itemcode,'') || '): ' || trim(_reden),
    auth.uid(), naam, coalesce(k.is_test,false) OR coalesce(ond_test,false));
  SELECT min(periode_start) INTO conc FROM public.factuur_planning WHERE klant_contract_id=_contract_id AND status IN ('concept_aangemaakt','te_laat') AND periode_start >= _vanaf;
  RETURN jsonb_build_object('ok',true,'grens',g,'concept_periode',conc,'vervangen',oud);
END $$;

CREATE OR REPLACE FUNCTION public.verwijder_contract_korting(_contract_id uuid, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.klant_contracten; g date; naam text; oud jsonb; nieuw_tot date; conc date; ond_test boolean;
BEGIN
  IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(_toelichting,''))) < 3 OR length(trim(_toelichting)) > 500 THEN RAISE EXCEPTION 'toelichting verplicht (3-500 tekens)'; END IF;
  SELECT * INTO k FROM public.klant_contracten WHERE id=_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract niet gevonden'; END IF;
  IF k.korting_pct IS NULL THEN RAISE EXCEPTION 'er staat geen korting op deze regel'; END IF;
  g := public.korting_grens(_contract_id);
  IF k.korting_tot IS NOT NULL AND k.korting_tot < g THEN RAISE EXCEPTION 'korting is al afgelopen'; END IF;
  oud := jsonb_build_object('pct',k.korting_pct,'reden',k.korting_reden,'vanaf',k.korting_vanaf,'tot',k.korting_tot);
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  PERFORM set_config('zp.korting_rpc','1',true);
  IF k.korting_vanaf >= g THEN
    -- nog niet ingegaan: niets gefactureerd met korting, velden leeg (oude waarden staan in het audit-log)
    UPDATE public.klant_contracten SET korting_pct=NULL, korting_reden=NULL, korting_vanaf=NULL, korting_tot=NULL, korting_door=auth.uid(), korting_op=now() WHERE id=_contract_id;
  ELSE
    nieuw_tot := g - 1;
    UPDATE public.klant_contracten SET korting_tot=nieuw_tot, korting_door=auth.uid(), korting_op=now() WHERE id=_contract_id;
  END IF;
  PERFORM set_config('zp.korting_rpc','0',true);
  INSERT INTO public.sensitive_audit_log (target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol,details)
  VALUES ('klant_contracten',_contract_id,'korting_gestopt','korting',oud::text,
    CASE WHEN nieuw_tot IS NULL THEN NULL ELSE jsonb_build_object('pct',k.korting_pct,'vanaf',k.korting_vanaf,'tot',nieuw_tot)::text END,
    auth.uid(),public.get_user_role_label(auth.uid()), jsonb_build_object('onderneming_id',k.onderneming_id,'grens',g,'toelichting',trim(_toelichting)));
  SELECT o.is_test INTO ond_test FROM public.ondernemingen o WHERE o.id=k.onderneming_id;
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,is_test)
  VALUES ('korting_gestopt', 'Korting ' || k.korting_pct::text || '% gestopt per ' || to_char(g,'DD-MM-YYYY') || ', contractregel ' || coalesce(k.bron_rij::text,'?') || ': ' || trim(_toelichting),
    auth.uid(), naam, coalesce(k.is_test,false) OR coalesce(ond_test,false));
  SELECT min(periode_start) INTO conc FROM public.factuur_planning WHERE klant_contract_id=_contract_id AND status IN ('concept_aangemaakt','te_laat') AND periode_start >= g;
  RETURN jsonb_build_object('ok',true,'per',g,'concept_periode',conc);
END $$;

REVOKE ALL ON FUNCTION public.contract_korting_voorbeeld(uuid,numeric,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.zet_contract_korting(uuid,numeric,text,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verwijder_contract_korting(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.korting_grens(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_korting_voorbeeld(uuid,numeric,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zet_contract_korting(uuid,numeric,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verwijder_contract_korting(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.korting_grens(uuid) TO authenticated, service_role;

-- facturatie_kandidaten: netto stuksprijs en korting_pct in de kandidaatregel (returntype wijzigt, dus opnieuw aanmaken)
DO $do$
DECLARE d text := pg_get_functiondef('public.facturatie_kandidaten(date,date)'::regprocedure); n text;
  oud_bpp text := $a$public.contract_bedrag_voor_periode(c.tarief_type, c.starter_tot, c.bedrag_per_periode, c.bedrag_na_starter, public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n)) AS bpp$a$;
  kp text := $a$public.korting_voor_periode(c.korting_pct, c.korting_vanaf, c.korting_tot, public.factuur_periode_start(c.volgende_factuurdatum, c.cyclus, n))$a$;
BEGIN
  IF position(oud_bpp in d) = 0 OR position($a$btw_code text)$a$ in d) = 0 OR position($a$coalesce((p.m).btw_code, '0')
  FROM p LEFT JOIN$a$ in d) = 0 THEN RAISE EXCEPTION 'facturatie_kandidaten onverwacht'; END IF;
  n := replace(d, oud_bpp, 'public.korting_netto(' || replace(oud_bpp, ' AS bpp', '') || ', ' || kp || ') AS bpp, ' || kp || ' AS kp');
  n := replace(n, $a$btw_code text)$a$, $a$btw_code text, korting_pct numeric)$a$);
  n := replace(n, $a$coalesce((p.m).btw_code, '0')
  FROM p LEFT JOIN$a$, $a$coalesce((p.m).btw_code, '0'), p.kp
  FROM p LEFT JOIN$a$);
  DROP FUNCTION public.facturatie_kandidaten(date,date);
  EXECUTE n;
END $do$;
REVOKE ALL ON FUNCTION public.facturatie_kandidaten(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturatie_kandidaten(date,date) TO authenticated, service_role;

-- MRR/ARR met de korting die vandaag geldt
DO $do$
DECLARE d text := pg_get_functiondef('public.dashboard_tellers(boolean)'::regprocedure); n text;
BEGIN
  n := replace(d, $a$CASE WHEN cyclus = 'jaar' THEN bedrag_per_periode*aantal/12 ELSE bedrag_per_periode*aantal END$a$,
    $a$CASE WHEN cyclus = 'jaar' THEN public.korting_netto(bedrag_per_periode, public.korting_voor_periode(korting_pct, korting_vanaf, korting_tot, vandaag))*aantal/12 ELSE public.korting_netto(bedrag_per_periode, public.korting_voor_periode(korting_pct, korting_vanaf, korting_tot, vandaag))*aantal END$a$);
  IF n = d THEN RAISE EXCEPTION 'dashboard_tellers onverwacht'; END IF;
  EXECUTE n;
END $do$;