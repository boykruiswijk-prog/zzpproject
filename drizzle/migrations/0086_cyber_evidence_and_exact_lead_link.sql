ALTER TABLE public.klant_contracten ADD COLUMN cyber_lead_id uuid REFERENCES public.leads(id);
CREATE INDEX klant_contracten_cyber_lead_idx ON public.klant_contracten(cyber_lead_id) WHERE cyber_lead_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.leg_cyber_aanvraag_vast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=NEW.extra_data->'cyber'; v_tekst text:='Ik begrijp dat de cyberdekking een looptijd heeft van 12 maanden en daarna stilzwijgend met 12 maanden wordt verlengd. De BAV + AVB blijft dagelijks opzegbaar.';
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
CREATE OR REPLACE FUNCTION public.cyber_lead_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ond uuid; v_eind date; v_datum date:=coalesce(NEW.opzeg_datum,NEW.pauze_start_datum,(now() AT TIME ZONE 'Europe/Amsterdam')::date);
BEGIN
 IF NEW.cyber_voorwaarden_versie IS DISTINCT FROM '2026-10-08' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 SELECT onderneming_id INTO v_ond FROM public.klant_contracten WHERE cyber_lead_id=NEW.id AND product='cyber_clear' LIMIT 1;
 IF v_ond IS NULL THEN RETURN NEW; END IF;
 IF NEW.status IN('gepauzeerd','opgezegd') THEN
  UPDATE public.klant_contracten SET eind_datum=v_datum,status='loopt_af' WHERE onderneming_id=v_ond AND cyber_lead_id=NEW.id AND product='bav_avb';
  IF NEW.status='opgezegd' THEN
   v_eind:=greatest(NEW.cyber_einddatum,public.cyber_term_eind(NEW.cyber_ingangsdatum,v_datum));
   UPDATE public.klant_contracten SET eind_datum=v_eind,status='loopt_af',cyber_einddatum=v_eind WHERE cyber_lead_id=NEW.id AND product='cyber_clear';
  END IF;
 ELSIF NEW.status IN('actief','klant') AND OLD.status='gepauzeerd' THEN
  UPDATE public.klant_contracten SET eind_datum=NULL,status='actief' WHERE cyber_lead_id=NEW.id AND product='bav_avb';
 END IF;
 RETURN NEW;
END $$;
DO $do$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.cyber_datums_wijzigen(uuid,uuid,date,date,date,text)'::regprocedure);
 d:=replace(d,'   UPDATE public.leads SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=l.id;',E'   UPDATE public.leads SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=l.id;\n   UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE cyber_lead_id=l.id AND product=''cyber_clear'';');
 d:=replace(d,'   UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=k.id;',E'   UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=k.id;\n   UPDATE public.leads SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=k.cyber_lead_id;');
 EXECUTE d;
END $do$;
CREATE OR REPLACE FUNCTION public.mijn_cyber_polissen() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('lead_id',l.id,'versie',l.cyber_voorwaarden_versie,'ingang',l.cyber_ingangsdatum,'eind',greatest(l.cyber_einddatum,public.cyber_term_eind(l.cyber_ingangsdatum,(now() AT TIME ZONE 'Europe/Amsterdam')::date)),'pakket',l.gekozen_pakket)) FROM public.leads l WHERE l.cyber_voorwaarden_versie='2026-10-08' AND EXISTS(SELECT 1 FROM public.policies p WHERE p.lead_id=l.id AND p.user_id=auth.uid())),'[]'::jsonb);
END $$;