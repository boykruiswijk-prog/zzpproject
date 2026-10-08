CREATE FUNCTION public.cyber_term_eind(_start date,_vandaag date) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE n int:=1; BEGIN WHILE (_start+make_interval(years=>n))::date<=_vandaag LOOP n:=n+1; END LOOP; RETURN (_start+make_interval(years=>n))::date-1; END $$;
CREATE OR REPLACE FUNCTION public.guard_cyber_contract() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.cyber_voorwaarden_versie='2026-10-08' AND NEW.product='cyber_clear' THEN
  IF NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL OR NEW.cyber_einddatum<NEW.cyber_ingangsdatum THEN RAISE EXCEPTION 'Cyberdatums ontbreken of zijn ongeldig'; END IF;
  IF NEW.eind_datum IS NOT NULL THEN
   NEW.cyber_einddatum:=greatest(NEW.cyber_einddatum,public.cyber_term_eind(NEW.cyber_ingangsdatum,(now() AT TIME ZONE 'Europe/Amsterdam')::date));
   IF NEW.eind_datum<NEW.cyber_einddatum THEN NEW.eind_datum:=NEW.cyber_einddatum; END IF;
  END IF;
  IF NEW.status='vervangen' AND current_setting('zp.cyber_datums',true) IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Cyber kan niet tussentijds gestopt of gepauzeerd worden'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.cyber_lead_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ond uuid; v_eind date; v_datum date:=coalesce(NEW.opzeg_datum,NEW.pauze_start_datum,(now() AT TIME ZONE 'Europe/Amsterdam')::date);
BEGIN
 IF NEW.cyber_voorwaarden_versie IS DISTINCT FROM '2026-10-08' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 SELECT onderneming_id INTO v_ond FROM public.klant_contracten WHERE bron='site_activatie' AND bron_rij=(SELECT bron_rij FROM public.klant_contracten WHERE bron='site_cyber_20261008' AND onderneming_id IN(SELECT id FROM public.ondernemingen WHERE exact_account_id=NEW.exact_account_id) LIMIT 1) LIMIT 1;
 IF v_ond IS NULL THEN RETURN NEW; END IF;
 IF NEW.status IN('gepauzeerd','opgezegd') THEN
  UPDATE public.klant_contracten SET eind_datum=v_datum,status='loopt_af' WHERE onderneming_id=v_ond AND bron='site_activatie' AND product='bav_avb';
  IF NEW.status='opgezegd' THEN
   v_eind:=greatest(NEW.cyber_einddatum,public.cyber_term_eind(NEW.cyber_ingangsdatum,v_datum));
   UPDATE public.klant_contracten SET eind_datum=v_eind,status='loopt_af',cyber_einddatum=v_eind WHERE onderneming_id=v_ond AND bron='site_cyber_20261008' AND product='cyber_clear';
  END IF;
 ELSIF NEW.status IN('actief','klant') AND OLD.status='gepauzeerd' THEN
  UPDATE public.klant_contracten SET eind_datum=NULL,status='actief' WHERE onderneming_id=v_ond AND bron='site_activatie' AND product='bav_avb';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_cyber_lead_lifecycle AFTER UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION public.cyber_lead_lifecycle();
DO $do$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.plan_opzeg_credit(uuid,uuid,date)'::regprocedure);
 d:=replace(d,'  SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;',E'  IF k.cyber_voorwaarden_versie = ''2026-10-08'' AND k.product = ''cyber_clear'' THEN\n    RETURN jsonb_build_object(''status'',''niet_nodig'',''melding'',''Cyber loopt door tot einde cyberjaar; geen tussentijdse creditnota'');\n  END IF;\n  SELECT * INTO o FROM public.ondernemingen WHERE id = k.onderneming_id;');
 EXECUTE d;
 d:=pg_get_functiondef('public.facturatie_kandidaten(date,date)'::regprocedure);
 d:=replace(d,'WHEN p.eind_datum IS NOT NULL AND p.ps > p.eind_datum', 'WHEN p.eind_datum IS NOT NULL AND (CASE WHEN p.cyber_voorwaarden_versie = ''2026-10-08'' AND p.product = ''cyber_clear'' AND p.cyclus = ''maand'' THEN (date_trunc(''month'',p.ps)+interval ''1 month''-interval ''1 day'')::date > p.eind_datum ELSE p.ps > p.eind_datum END)');
 EXECUTE d;
END $do$;
CREATE FUNCTION public.guard_cyber_lead_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF current_setting('zp.cyber_datums',true)='1' OR auth.role()='service_role' OR current_user IN('postgres','supabase_admin') THEN RETURN NEW; END IF;
 IF NEW.cyber_voorwaarden_versie IS DISTINCT FROM OLD.cyber_voorwaarden_versie OR NEW.cyber_ingangsdatum IS DISTINCT FROM OLD.cyber_ingangsdatum OR NEW.cyber_einddatum IS DISTINCT FROM OLD.cyber_einddatum OR NEW.cyber_nieuwe_voorwaarden_per IS DISTINCT FROM OLD.cyber_nieuwe_voorwaarden_per THEN RAISE EXCEPTION 'Gebruik Cyberdatums wijzigen'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER trg_guard_cyber_lead_fields BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_cyber_lead_fields();
REVOKE ALL ON FUNCTION public.cyber_term_eind(date,date),public.cyber_lead_lifecycle(),public.guard_cyber_lead_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cyber_term_eind(date,date) TO service_role;
