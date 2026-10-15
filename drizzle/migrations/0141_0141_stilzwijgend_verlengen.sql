CREATE OR REPLACE FUNCTION public.contract_opzegging(_contract_id uuid)
 RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT k.eind_datum FROM public.klant_contracten k
   WHERE k.id = _contract_id AND (
     EXISTS (SELECT 1 FROM public.sensitive_audit_log a WHERE a.target_table = 'klant_contracten' AND a.target_id = k.id
              AND a.actie IN ('handmatig_beeindigd','opzegging_verwerken','opzegging_verwerkt','einddatum_opzegging_bevestigd'))
     OR EXISTS (SELECT 1 FROM public.leads l WHERE k.cyber_lead_id IS NOT NULL AND l.id = k.cyber_lead_id AND l.status IN ('opgezegd','gepauzeerd')))
$f$;
REVOKE ALL ON FUNCTION public.contract_opzegging(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_opzegging(uuid) TO authenticated, service_role;

DO $do$
DECLARE d text; oud text; nieuw text;
BEGIN
  d := pg_get_functiondef('public.facturatie_kandidaten(date,date)'::regprocedure);
  oud := 'p.eind_datum IS NOT NULL AND (CASE WHEN p.cyber_voorwaarden_versie = ''2026-10-08'' AND p.product = ''cyber_clear'' AND p.cyclus = ''maand'' THEN public.factuur_periode_eind(p.ps, p.cyclus) > p.eind_datum ELSE p.ps > p.eind_datum END)';
  nieuw := 'p.opz IS NOT NULL AND (CASE WHEN p.cyber_voorwaarden_versie = ''2026-10-08'' AND p.product = ''cyber_clear'' AND p.cyclus = ''maand'' THEN public.factuur_periode_eind(p.ps, p.cyclus) > p.opz ELSE p.ps > p.opz END)';
  IF position(oud IN d) = 0 THEN RAISE EXCEPTION 'einddatumregel niet gevonden'; END IF;
  d := replace(d, oud || ' THEN ''na einddatum contract''', nieuw || ' THEN ''Opgezegd per '' || to_char(p.opz, ''DD-MM-YYYY'')');
  d := replace(d, oud || ' THEN ''einddatum''', nieuw || ' THEN ''opgezegd''');
  d := replace(d, 'WHEN p.status = ''einddatum_controle'' THEN ''einddatum controleren door Ellen''', '');
  d := replace(d, 'WHEN p.status = ''einddatum_controle'' THEN ''einddatum''', '');
  d := replace(d, 'public.factuur_mapping_voor(k.itemcode) AS m', 'public.factuur_mapping_voor(k.itemcode) AS m, public.contract_opzegging(k.id) AS opz');
  IF position('na einddatum' IN d) > 0 OR position('THEN ''einddatum''' IN d) > 0 OR position('AS opz' IN d) = 0 THEN RAISE EXCEPTION 'vervanging onvolledig'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure);
  IF position('WHERE k.status = ''einddatum_controle'' AND' IN d) = 0 THEN RAISE EXCEPTION 'blok niet gevonden'; END IF;
  d := replace(d, 'WHERE k.status = ''einddatum_controle'' AND', 'WHERE false AND k.status = ''einddatum_controle'' AND');
  EXECUTE d;
END $do$;