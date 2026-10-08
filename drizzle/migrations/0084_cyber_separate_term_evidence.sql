ALTER TABLE public.leads ADD COLUMN cyber_voorwaarden_versie text, ADD COLUMN cyber_ingangsdatum date, ADD COLUMN cyber_einddatum date, ADD COLUMN cyber_nieuwe_voorwaarden_per date;
ALTER TABLE public.klant_contracten ADD COLUMN cyber_voorwaarden_versie text, ADD COLUMN cyber_ingangsdatum date, ADD COLUMN cyber_einddatum date, ADD COLUMN cyber_nieuwe_voorwaarden_per date;
CREATE TABLE public.cyber_akkoord_bewijs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id), versie text NOT NULL, akkoord_tekst text NOT NULL, akkoord_op timestamptz NOT NULL DEFAULT now(), client_akkoord_op timestamptz, antwoorden jsonb NOT NULL, is_test boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.cyber_akkoord_bewijs TO authenticated;
GRANT SELECT, INSERT ON public.cyber_akkoord_bewijs TO service_role;
ALTER TABLE public.cyber_akkoord_bewijs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cyber_bewijs_team ON public.cyber_akkoord_bewijs FOR SELECT TO authenticated USING(public.is_team_member(auth.uid()));
CREATE FUNCTION public.guard_cyber_bewijs() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Cyber-akkoord is onveranderbaar'; END $$;
CREATE TRIGGER guard_cyber_bewijs BEFORE UPDATE OR DELETE ON public.cyber_akkoord_bewijs FOR EACH ROW EXECUTE FUNCTION public.guard_cyber_bewijs();
CREATE FUNCTION public.leg_cyber_aanvraag_vast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=NEW.extra_data->'cyber'; v_tekst text:='Ik begrijp dat de cyberdekking een looptijd heeft van 12 maanden en daarna stilzwijgend met 12 maanden wordt verlengd. De BAV + AVB blijft dagelijks opzegbaar.';
BEGIN
 IF c->>'versie'='2026-10-08' AND c->>'gekozen'='true' THEN
  IF c->>'akkoord' IS DISTINCT FROM 'true' OR c->'antwoorden' IS NULL THEN RAISE EXCEPTION 'Cyber-akkoord en antwoorden verplicht'; END IF;
  INSERT INTO public.cyber_akkoord_bewijs(lead_id,versie,akkoord_tekst,client_akkoord_op,antwoorden,is_test) VALUES(NEW.id,c->>'versie',v_tekst,(c->>'client_akkoord_op')::timestamptz,c->'antwoorden',NEW.is_test);
 END IF;
 IF c->>'afgewezen'='true' THEN
  INSERT INTO public.lead_notes(lead_id,content,type) VALUES(NEW.id,'Cyberdekking afgewezen op acceptatievragen. Ellen: neem contact op over een passende oplossing. Antwoorden staan in het dossier.','notitie');
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,is_test) VALUES('cyber_opvolging','Ellen: passende oplossing bespreken na cyberacceptatie',NEW.id,NEW.is_test);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_cyber_aanvraag AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.leg_cyber_aanvraag_vast();
CREATE FUNCTION public.guard_cyber_contract() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.cyber_voorwaarden_versie='2026-10-08' AND NEW.product='cyber_clear' THEN
  IF NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL OR NEW.cyber_einddatum<NEW.cyber_ingangsdatum THEN RAISE EXCEPTION 'Cyberdatums ontbreken of zijn ongeldig'; END IF;
  IF NEW.eind_datum IS NOT NULL AND NEW.eind_datum<NEW.cyber_einddatum THEN NEW.eind_datum:=NEW.cyber_einddatum; END IF;
  IF NEW.status='vervangen' AND current_setting('zp.cyber_datums',true) IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Cyber kan niet tussentijds gestopt of gepauzeerd worden'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_cyber_contract BEFORE INSERT OR UPDATE ON public.klant_contracten FOR EACH ROW EXECUTE FUNCTION public.guard_cyber_contract();
CREATE FUNCTION public.cyber_datums_wijzigen(_lead_id uuid, _contract_id uuid, _ingang date, _eind date, _nieuwe_per date, _toelichting text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.leads; k public.klant_contracten; v_id uuid; v_oud jsonb;
BEGIN
 IF NOT(public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
 IF length(btrim(coalesce(_toelichting,'')))<3 OR length(_toelichting)>500 THEN RAISE EXCEPTION 'Toelichting verplicht (3-500 tekens)'; END IF;
 IF _ingang IS NOT NULL AND (_eind IS NULL OR _eind<_ingang) THEN RAISE EXCEPTION 'Ongeldige cyberdatums'; END IF;
 PERFORM set_config('zp.cyber_datums','1',true);
 IF _lead_id IS NOT NULL THEN
  SELECT * INTO l FROM public.leads WHERE id=_lead_id FOR UPDATE; IF l.id IS NULL THEN RAISE EXCEPTION 'Aanvraag niet gevonden'; END IF;
  v_oud:=jsonb_build_object('ingang',l.cyber_ingangsdatum,'eind',l.cyber_einddatum,'nieuwe_per',l.cyber_nieuwe_voorwaarden_per);
  UPDATE public.leads SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=l.id;
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,uitgevoerd_door,uitgevoerd_door_naam,is_test) VALUES('cyber_datums_gewijzigd','Cyberdatums gewijzigd: '||_toelichting,l.id,auth.uid(),public.get_user_role_label(auth.uid()),l.is_test);
  v_id:=l.id;
 ELSIF _contract_id IS NOT NULL THEN
  SELECT * INTO k FROM public.klant_contracten WHERE id=_contract_id AND product='cyber_clear' FOR UPDATE; IF k.id IS NULL THEN RAISE EXCEPTION 'Cybercontract niet gevonden'; END IF;
  v_oud:=jsonb_build_object('ingang',k.cyber_ingangsdatum,'eind',k.cyber_einddatum,'nieuwe_per',k.cyber_nieuwe_voorwaarden_per);
  UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=k.id;
  PERFORM public.crm_notitie_toevoegen(k.onderneming_id,NULL,'notitie','Cyberdatums gewijzigd: '||_toelichting,jsonb_build_object('contract_id',k.id)); v_id:=k.id;
 ELSE RAISE EXCEPTION 'Kies aanvraag of contract'; END IF;
 INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol) VALUES(CASE WHEN _lead_id IS NOT NULL THEN 'leads' ELSE 'klant_contracten' END,v_id,'cyber_datums_gewijzigd','cyber_datums',v_oud::text,jsonb_build_object('ingang',_ingang,'eind',_eind,'nieuwe_per',_nieuwe_per,'toelichting',_toelichting)::text,auth.uid(),public.get_user_role_label(auth.uid()));
 PERFORM set_config('zp.cyber_datums','0',true); RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.mijn_cyber_polissen() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'geen toegang'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('lead_id',l.id,'versie',l.cyber_voorwaarden_versie,'ingang',l.cyber_ingangsdatum,'eind',l.cyber_einddatum,'pakket',l.gekozen_pakket)) FROM public.leads l WHERE l.cyber_voorwaarden_versie='2026-10-08' AND EXISTS(SELECT 1 FROM public.policies p WHERE p.lead_id=l.id AND p.user_id=auth.uid())),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.guard_cyber_bewijs(),public.leg_cyber_aanvraag_vast(),public.guard_cyber_contract() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cyber_datums_wijzigen(uuid,uuid,date,date,date,text),public.mijn_cyber_polissen() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cyber_datums_wijzigen(uuid,uuid,date,date,date,text),public.mijn_cyber_polissen() TO authenticated;
