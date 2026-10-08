CREATE OR REPLACE FUNCTION public.cyber_datums_wijzigen(_lead_id uuid, _contract_id uuid, _ingang date, _eind date, _nieuwe_per date, _toelichting text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per,eind_datum=_eind WHERE cyber_lead_id=l.id AND product='cyber_clear';
  INSERT INTO public.activiteiten_log(actie_type,omschrijving,lead_id,uitgevoerd_door,uitgevoerd_door_naam,is_test) VALUES('cyber_datums_gewijzigd','Cyberdatums gewijzigd: '||_toelichting,l.id,auth.uid(),public.get_user_role_label(auth.uid()),l.is_test);
  v_id:=l.id;
 ELSIF _contract_id IS NOT NULL THEN
  SELECT * INTO k FROM public.klant_contracten WHERE id=_contract_id AND product='cyber_clear' FOR UPDATE; IF k.id IS NULL THEN RAISE EXCEPTION 'Cybercontract niet gevonden'; END IF;
  v_oud:=jsonb_build_object('ingang',k.cyber_ingangsdatum,'eind',k.cyber_einddatum,'nieuwe_per',k.cyber_nieuwe_voorwaarden_per);
  UPDATE public.klant_contracten SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per,eind_datum=_eind WHERE id=k.id;
  IF k.cyber_lead_id IS NOT NULL THEN UPDATE public.leads SET cyber_ingangsdatum=_ingang,cyber_einddatum=_eind,cyber_nieuwe_voorwaarden_per=_nieuwe_per WHERE id=k.cyber_lead_id; END IF;
  PERFORM public.crm_notitie_toevoegen(k.onderneming_id,NULL,'notitie','Cyberdatums gewijzigd: '||_toelichting,jsonb_build_object('contract_id',k.id)); v_id:=k.id;
 ELSE RAISE EXCEPTION 'Kies aanvraag of contract'; END IF;
 INSERT INTO public.sensitive_audit_log(target_table,target_id,actie,veld,oude_waarde,nieuwe_waarde,uitgevoerd_door,uitgevoerd_door_rol) VALUES(CASE WHEN _lead_id IS NOT NULL THEN 'leads' ELSE 'klant_contracten' END,v_id,'cyber_datums_gewijzigd','cyber_datums',v_oud::text,jsonb_build_object('ingang',_ingang,'eind',_eind,'nieuwe_per',_nieuwe_per,'toelichting',_toelichting)::text,auth.uid(),public.get_user_role_label(auth.uid()));
 PERFORM set_config('zp.cyber_datums','0',true); RETURN jsonb_build_object('ok',true);
END $function$;
REVOKE ALL ON FUNCTION public.cyber_datums_wijzigen(uuid,uuid,date,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cyber_datums_wijzigen(uuid,uuid,date,date,date,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.normaliseer_nieuwe_cyber_itemcode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
 IF NEW.product='cyber_clear' AND NEW.cyber_voorwaarden_versie='2026-10-08' THEN NEW.itemcode:=CASE WHEN NEW.cyclus='maand' THEN '102M' ELSE '102J' END; END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.normaliseer_nieuwe_cyber_itemcode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normaliseer_nieuwe_cyber_itemcode() TO service_role;
CREATE TRIGGER normaliseer_nieuwe_cyber_itemcode_trigger BEFORE INSERT OR UPDATE OF product,cyclus,itemcode,cyber_voorwaarden_versie ON public.klant_contracten FOR EACH ROW EXECUTE FUNCTION public.normaliseer_nieuwe_cyber_itemcode();