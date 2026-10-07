DO $$ DECLARE src text; BEGIN
  src := pg_get_functiondef('public.portaltoegang_verlenen(uuid,uuid,boolean)'::regprocedure);
  src := replace(src, ' OR p.lead_id IN (SELECT kc.lead_id FROM public.klant_contracten kc WHERE kc.onderneming_id = o.id AND kc.lead_id IS NOT NULL)', '');
  EXECUTE src;
END $$;