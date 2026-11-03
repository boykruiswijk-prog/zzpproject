CREATE OR REPLACE FUNCTION public.portaltoegang_auto_match(_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e text := lower(btrim(coalesce(_email,''))); n_pers int; n_ond int; r record; testadres boolean; n_aflopend int; n_samengevoegd int;
BEGIN
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('match', false, 'reden', 'geen geldig e-mailadres'); END IF;
  testadres := e LIKE '%@zpzaken.nl';
  SELECT count(*) INTO n_pers FROM public.personen p
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e) AND (p.is_test = false OR testadres);
  IF n_pers = 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres staat bij geen contactpersoon van een klant'); END IF;
  SELECT count(DISTINCT o.id) INTO n_ond FROM public.personen p
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e)
     AND (p.is_test = false OR testadres) AND o.samengevoegd_naar IS NULL AND o.is_test = p.is_test
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND k.is_test = o.is_test);
  IF n_ond = 0 THEN
    SELECT count(*) FILTER (WHERE o.samengevoegd_naar IS NOT NULL),
           count(*) FILTER (WHERE o.samengevoegd_naar IS NULL AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.is_test = o.is_test))
      INTO n_samengevoegd, n_aflopend
      FROM public.personen p JOIN public.persoon_onderneming po ON po.persoon_id = p.id JOIN public.ondernemingen o ON o.id = po.onderneming_id
     WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e) AND (p.is_test = false OR testadres);
    IF n_aflopend > 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'klant gevonden, maar het contract loopt af of is beëindigd'); END IF;
    IF n_samengevoegd > 0 THEN RETURN jsonb_build_object('match', false, 'reden', 'contactpersoon hangt aan een samengevoegde klantkaart'); END IF;
    RETURN jsonb_build_object('match', false, 'reden', 'contactpersoon gevonden, maar geen contract in het klantenbestand (mogelijk online klant)');
  END IF;
  IF n_ond > 1 THEN RETURN jsonb_build_object('match', false, 'reden', 'adres hoort bij meerdere klanten (' || n_ond || '), kies zelf'); END IF;
  SELECT o.id AS ond, p.id AS pid, o.naam, p.voornaam INTO r FROM public.personen p
    JOIN public.persoon_onderneming po ON po.persoon_id = p.id
    JOIN public.ondernemingen o ON o.id = po.onderneming_id
   WHERE (lower(btrim(p.genormaliseerd_email)) = e OR lower(btrim(p.email_weergave)) = e)
     AND (p.is_test = false OR testadres) AND o.samengevoegd_naar IS NULL AND o.is_test = p.is_test
     AND EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = o.id AND k.status = 'actief' AND k.is_test = o.is_test)
   ORDER BY p.created_at LIMIT 1;
  RETURN jsonb_build_object('match', true, 'onderneming_id', r.ond, 'persoon_id', r.pid, 'klant', r.naam, 'voornaam', r.voornaam);
END $$;
REVOKE ALL ON FUNCTION public.portaltoegang_auto_match(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portaltoegang_auto_match(text) TO service_role;