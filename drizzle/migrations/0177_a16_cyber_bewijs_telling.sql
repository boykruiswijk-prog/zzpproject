CREATE OR REPLACE FUNCTION public.leg_cyber_aanvraag_vast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=NEW.extra_data->'cyber'; v_tekst text:='Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.';
BEGIN
 IF c->>'versie'='2026-10-08' AND c->>'gekozen'='true' THEN
  IF c->>'akkoord' IS DISTINCT FROM 'true' OR NOT (c->'antwoorden' @> '{"a":false,"b":true,"c":true,"d":true,"e":false,"f":false}'::jsonb) OR NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL THEN RAISE EXCEPTION 'Cyber-akkoord, geldige antwoorden en datums verplicht'; END IF;
  INSERT INTO public.cyber_akkoord_bewijs(lead_id,versie,akkoord_tekst,client_akkoord_op,antwoorden,is_test) VALUES(NEW.id,c->>'versie',v_tekst,(c->>'client_akkoord_op')::timestamptz,c->'antwoorden',NEW.is_test);
 END IF;
 IF c->>'versie'='2026-10-08' AND c->>'afgewezen'='true' THEN
  INSERT INTO public.crm_taken(soort,omschrijving,details,team,is_test) VALUES('nieuwe_aanvraag_nodig','Ellen: cyber niet passend op acceptatievragen, bespreek een passende oplossing.',jsonb_build_object('lead_id',NEW.id,'cyber_antwoorden',c->'antwoorden'),'verzekering',NEW.is_test);
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test) VALUES('cyber_opvolging','Ellen: passende oplossing bespreken na cyberacceptatie',NEW.id,NEW.is_test);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.leg_cyber_aanvraag_vast() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tel_aanvragen_doel_rijen(_vanaf date DEFAULT '2026-10-06'::date)
RETURNS TABLE(sleutel uuid, dag date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT sleutel, min(d) FROM (
    SELECT l.id AS sleutel, (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date AS d FROM public.leads l
     WHERE l.type::text = 'verzekering_aanvraag' AND NOT coalesce(l.is_test,false) AND l.created_at >= _vanaf::timestamp AT TIME ZONE 'Europe/Amsterdam'
    UNION
    SELECT coalesce(b.lead_id, b.id), (b.aangemeld_op AT TIME ZONE 'Europe/Amsterdam')::date FROM public.bav_aanmeldingen b
     WHERE NOT coalesce(b.is_test,false) AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = b.lead_id AND coalesce(l.is_test,false)) AND b.aangemeld_op >= _vanaf::timestamp AT TIME ZONE 'Europe/Amsterdam'
  ) a GROUP BY sleutel
$$;
REVOKE ALL ON FUNCTION public.tel_aanvragen_doel_rijen(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tel_aanvragen_doel_rijen(date) TO authenticated, service_role;