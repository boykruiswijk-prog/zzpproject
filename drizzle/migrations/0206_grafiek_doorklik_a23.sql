-- A23-aanvulling 2: doorklikken op grafiekelementen in de admin. Alleen lezen.
CREATE OR REPLACE FUNCTION public.admin_grafiek_bron(_grafiek text, _toon_test boolean)
RETURNS TABLE(sleutel text, dag date, id uuid, link text, naam text, bedrijfsnaam text, email text,
  product text, status text, binnengekomen timestamptz, bron text, behandelaar text, bedrag numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  vandaag date := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  maand0 date := (date_trunc('month', (now() AT TIME ZONE 'Europe/Amsterdam')) - interval '5 months')::date;
BEGIN
  IF _grafiek IN ('leads_dag','leads_status','leads_verzekering') THEN
    RETURN QUERY
    SELECT CASE _grafiek
             WHEN 'leads_dag' THEN to_char((l.created_at AT TIME ZONE 'Europe/Amsterdam')::date, 'YYYY-MM-DD')
             WHEN 'leads_status' THEN l.status::text
             ELSE l.verzekering_type END,
           (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date, l.id, '/admin/leads/' || l.id,
           nullif(trim(concat_ws(' ', l.voornaam, l.achternaam)), ''), l.bedrijfsnaam, l.email,
           coalesce(l.verzekering_type, l.gekozen_pakket), l.status::text, l.created_at, l.bron::text,
           p.full_name, NULL::numeric
    FROM public.leads l LEFT JOIN public.profiles p ON p.id = l.assigned_to
    WHERE (l.is_test = false OR _toon_test)
      AND (_grafiek <> 'leads_dag' OR (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date > vandaag - 14)
      AND (_grafiek <> 'leads_verzekering' OR l.verzekering_type IS NOT NULL);
  ELSIF _grafiek = 'activaties_maand' THEN
    RETURN QUERY
    SELECT to_char((a.aangemaakt_op AT TIME ZONE 'Europe/Amsterdam')::date, 'YYYY-MM'),
           (a.aangemaakt_op AT TIME ZONE 'Europe/Amsterdam')::date, a.id, '/admin/leads/' || l.id,
           nullif(trim(concat_ws(' ', l.voornaam, l.achternaam)), ''), l.bedrijfsnaam, l.email,
           coalesce(l.verzekering_type, l.gekozen_pakket), l.status::text, l.created_at, l.bron::text,
           p.full_name, NULL::numeric
    FROM public.activiteiten_log a JOIN public.leads l ON l.id = a.lead_id
    LEFT JOIN public.profiles p ON p.id = l.assigned_to
    WHERE a.actie_type = 'lead_geactiveerd' AND l.is_test = false
      AND (a.aangemaakt_op AT TIME ZONE 'Europe/Amsterdam')::date >= maand0;
  ELSIF _grafiek = 'aanvragen' THEN
    RETURN QUERY
    SELECT to_char(r.dag, 'YYYY-MM-DD'), r.dag, r.sleutel, CASE WHEN l.id IS NULL THEN NULL ELSE '/admin/leads/' || l.id END,
           nullif(trim(concat_ws(' ', l.voornaam, l.achternaam)), ''), l.bedrijfsnaam, l.email,
           coalesce(l.verzekering_type, l.gekozen_pakket), l.status::text, l.created_at, l.bron::text,
           p.full_name, NULL::numeric
    FROM public.tel_aanvragen_doel_rijen(date '2026-10-06') r
    LEFT JOIN public.leads l ON l.id = r.sleutel LEFT JOIN public.profiles p ON p.id = l.assigned_to;
  ELSIF _grafiek IN ('arr_nieuw','arr_aflopend','arr_netto') THEN
    RETURN QUERY
    SELECT to_char(date_trunc('month', e.d)::date, 'YYYY-MM-DD'), e.d, e.cid, '/admin/klanten/' || e.oid,
           NULL::text, e.onaam, NULL::text, e.prod, e.st, NULL::timestamptz, NULL::text, NULL::text, e.bedrag
    FROM (
      SELECT c.id cid, c.onderneming_id oid, o.naam onaam, c.product::text prod, c.status::text st,
             c.begin_datum d, round(c.maandwaarde * 12, 2) bedrag
      FROM public.klant_contracten c LEFT JOIN public.ondernemingen o ON o.id = c.onderneming_id
      WHERE _grafiek IN ('arr_nieuw','arr_netto') AND c.is_test = false AND c.status IN ('actief','loopt_af')
        AND c.begin_datum >= maand0 AND c.begin_datum <= vandaag
      UNION ALL
      SELECT c.id, c.onderneming_id, o.naam, c.product::text, c.status::text,
             c.eind_datum, CASE WHEN _grafiek = 'arr_netto' THEN -1 ELSE 1 END * round(c.maandwaarde * 12, 2)
      FROM public.klant_contracten c LEFT JOIN public.ondernemingen o ON o.id = c.onderneming_id
      WHERE _grafiek IN ('arr_aflopend','arr_netto') AND c.is_test = false AND c.status IN ('actief','loopt_af')
        AND c.eind_datum >= maand0 AND c.eind_datum <= vandaag
    ) e;
  ELSE
    RAISE EXCEPTION 'Onbekende grafiek' USING ERRCODE = '22023';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_grafiek_bron(text, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_grafiek_toegang(_grafiek text, _toon_test boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE sup boolean;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (
       public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'supervisor'::public.app_role)
       OR public.has_role(auth.uid(),'verzekering'::public.app_role)) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  sup := public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'supervisor'::public.app_role);
  IF _grafiek LIKE 'arr_%' AND NOT sup THEN
    RAISE EXCEPTION 'Geen toegang tot ARR' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(_toon_test, false) AND sup;
END $$;
REVOKE ALL ON FUNCTION public.admin_grafiek_toegang(text, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_grafiek(_grafiek text, _toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE t boolean := public.admin_grafiek_toegang(_grafiek, _toon_test); uit jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('sleutel', x.sleutel, 'waarde', x.waarde) ORDER BY x.sleutel), '[]'::jsonb) INTO uit
  FROM (SELECT b.sleutel, CASE WHEN _grafiek LIKE 'arr_%' THEN coalesce(sum(b.bedrag),0) ELSE count(*) END waarde
        FROM public.admin_grafiek_bron(_grafiek, t) b GROUP BY b.sleutel) x;
  RETURN uit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_grafiek_records(_grafiek text, _sleutel text DEFAULT NULL,
  _van date DEFAULT NULL, _tot date DEFAULT NULL, _toon_test boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE t boolean := public.admin_grafiek_toegang(_grafiek, _toon_test); uit jsonb;
BEGIN
  IF _sleutel IS NULL AND _tot IS NULL THEN
    RAISE EXCEPTION 'Geen element gekozen' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.dag DESC, b.binnengekomen DESC NULLS LAST), '[]'::jsonb) INTO uit
  FROM public.admin_grafiek_bron(_grafiek, t) b
  WHERE (_sleutel IS NULL OR b.sleutel = _sleutel)
    AND (_van IS NULL OR b.dag >= _van) AND (_tot IS NULL OR b.dag <= _tot);
  RETURN uit;
END $$;

REVOKE ALL ON FUNCTION public.admin_grafiek(text, boolean) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.admin_grafiek_records(text, text, date, date, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_grafiek(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grafiek_records(text, text, date, date, boolean) TO authenticated;
