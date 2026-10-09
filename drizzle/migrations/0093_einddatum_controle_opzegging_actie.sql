CREATE OR REPLACE FUNCTION public.heeft_geregistreerde_opzegging(_contract_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM klant_contracten k WHERE k.id = _contract_id AND (
    k.cyber_lead_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM klant_service_aanvragen s WHERE s.type = 'opzeggen' AND NOT s.is_test AND s.onderneming_id = k.onderneming_id)
    OR EXISTS (SELECT 1 FROM sensitive_audit_log a WHERE a.target_table = 'klant_contracten' AND a.target_id = k.id
               AND a.actie IN ('handmatig_beeindigd','opzegging_verwerken','opzegging_verwerkt','einddatum_opzegging_bevestigd'))));
$$;