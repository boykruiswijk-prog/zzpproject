ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS exact_invoice_vervallen_op timestamptz;
GRANT SELECT (exact_invoice_vervallen_op) ON public.leads TO authenticated;
COMMENT ON COLUMN public.leads.exact_invoice_vervallen_op IS 'Bewust vervallen concept, Exact-id blijft bewaard; niet verwijderd of verwerkt in Exact.';
CREATE OR REPLACE FUNCTION public.guard_cyber_contract() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.id='17b3e297-c26c-44e1-8c28-d05e370ccb18'::uuid AND NEW.onderneming_id='0c04440f-2ffc-45ee-8865-297cbc1d6360'::uuid AND NEW.product='cyber_clear' AND NEW.cyber_ingangsdatum=date '2026-11-03' AND NEW.cyber_einddatum=date '2026-11-03' AND NEW.eind_datum=date '2026-11-03' AND NEW.bedrag_per_periode=0 AND NEW.maandwaarde=0 AND NEW.status='loopt_af'
 AND EXISTS(SELECT 1 FROM public.sensitive_audit_log a WHERE a.target_table='klant_contracten' AND a.target_id=NEW.id AND a.actie='coulance_boy_20261104' AND a.details->>'reden'='coulance Boy 4-11, opgezegd binnen enkele uren na aanvraag') THEN RETURN NEW; END IF;
 IF NEW.cyber_toevoeg_verzoek_id IS NOT NULL THEN
  IF NEW.cyber_ingangsdatum IS NULL OR NEW.cyber_einddatum IS NULL OR NEW.cyber_einddatum<NEW.cyber_ingangsdatum THEN RAISE EXCEPTION 'Cyberdatums ongeldig'; END IF;
  IF NEW.status='vervangen' THEN RAISE EXCEPTION 'Cyber is niet pauzeerbaar'; END IF;
  RETURN NEW;
 END IF;
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
DO $ddl$
DECLARE f record; s text;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('menu_tellers','mijn_acties_vandaag_basis') LOOP
  s:=pg_get_functiondef(f.oid);
  s:=replace(s,'coalesce(l.exact_invoice_status,0) <> 50','coalesce(l.exact_invoice_status,0) <> 50 AND l.exact_invoice_vervallen_op IS NULL');
  s:=replace(s,'coalesce(exact_invoice_status,0) <> 50','coalesce(exact_invoice_status,0) <> 50 AND exact_invoice_vervallen_op IS NULL');
  EXECUTE s;
 END LOOP;
END $ddl$;