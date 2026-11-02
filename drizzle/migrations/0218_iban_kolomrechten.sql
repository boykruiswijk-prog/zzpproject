-- Beveiligingscheck 2-11 (akkoord Boy): teamrollen lezen geen IBAN-kolommen meer rechtstreeks.
-- Volledige inzage alleen via iban_inzien (gelogd). Gemaskeerde weergave en geldigheid via iban_maskers.
-- service_role en security-definerfuncties houden volledige toegang.
DO $$
DECLARE t text; cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','ondernemingen','bav_aanmeldingen','screening_aanvragen','sepa_machtiging_bewijs','exact_mandaat_import','klant_mandaten'] LOOP
    SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) INTO cols
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name NOT IN ('iban','voorkeur_iban');
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', cols, t);
  END LOOP;
END $$;
REVOKE SELECT ON public.klant_mandaat_v FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.iban_skelet(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(c) >= 12 THEN left(c, 8) || repeat('*', length(c) - 12) || right(c, 4) WHEN c <> '' THEN '****' END
  FROM (SELECT upper(regexp_replace(coalesce(_t, ''), '\s', '', 'g')) AS c) a
$$;

CREATE OR REPLACE FUNCTION public.iban_mod97_geldig(_t text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE c text := upper(regexp_replace(coalesce(_t, ''), '\s', '', 'g')); r text; ch text; rest int := 0; i int; j int;
BEGIN
  IF c !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' THEN RETURN false; END IF;
  c := substr(c, 5) || substr(c, 1, 4);
  FOR i IN 1..length(c) LOOP
    ch := substr(c, i, 1);
    r := CASE WHEN ch ~ '[A-Z]' THEN (ascii(ch) - 55)::text ELSE ch END;
    FOR j IN 1..length(r) LOOP rest := (rest * 10 + substr(r, j, 1)::int) % 97; END LOOP;
  END LOOP;
  RETURN rest = 1;
END $$;

CREATE OR REPLACE FUNCTION public.iban_maskers(_bron text, _ids uuid[])
RETURNS TABLE(id uuid, iban text, geldig boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.a19_team();
  IF coalesce(array_length(_ids, 1), 0) > 500 THEN RAISE EXCEPTION 'te veel records'; END IF;
  IF _bron = 'lead' THEN RETURN QUERY SELECT t.id, public.iban_skelet(t.iban), public.iban_mod97_geldig(t.iban) FROM public.leads t WHERE t.id = ANY(_ids);
  ELSIF _bron = 'onderneming' THEN RETURN QUERY SELECT t.id, public.iban_skelet(t.iban), public.iban_mod97_geldig(t.iban) FROM public.ondernemingen t WHERE t.id = ANY(_ids);
  ELSIF _bron = 'bav' THEN RETURN QUERY SELECT t.id, public.iban_skelet(t.iban), public.iban_mod97_geldig(t.iban) FROM public.bav_aanmeldingen t WHERE t.id = ANY(_ids);
  ELSIF _bron = 'screening' THEN RETURN QUERY SELECT t.id, public.iban_skelet(t.iban), public.iban_mod97_geldig(t.iban) FROM public.screening_aanvragen t WHERE t.id = ANY(_ids);
  ELSIF _bron = 'sepa' THEN RETURN QUERY SELECT t.id, public.iban_skelet(t.iban), public.iban_mod97_geldig(t.iban) FROM public.sepa_machtiging_bewijs t WHERE t.id = ANY(_ids);
  ELSE RAISE EXCEPTION 'onbekende bron'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.klant_mandaat_overzicht(_codes text[] DEFAULT NULL)
RETURNS TABLE(relatiecode text, iban text, kenmerk text, ondertekend_op date, status text, vervaldatum date, bron text, in_exact boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE sup boolean;
BEGIN
  PERFORM public.a19_team();
  sup := public.is_supervisor_or_admin(auth.uid());
  IF NOT (sup OR public.has_role(auth.uid(), 'verzekering'::app_role)) THEN RETURN; END IF;
  RETURN QUERY SELECT v.relatiecode::text, public.iban_skelet(v.iban::text), v.kenmerk::text, v.ondertekend_op::date, v.status::text, v.vervaldatum::date, v.bron::text, v.in_exact::boolean
    FROM public.klant_mandaat_v v
   WHERE (_codes IS NULL OR v.relatiecode = ANY(_codes)) AND (sup OR v.bron <> 'exact_mandaat_import')
   ORDER BY v.relatiecode;
END $$;

REVOKE ALL ON FUNCTION public.iban_maskers(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klant_mandaat_overzicht(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iban_maskers(text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.klant_mandaat_overzicht(text[]) TO authenticated, service_role;