-- A23: Leads per status gestapeld naar leadtype (sleutel status|type). Alleen lezen; leads_status ongewijzigd.
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
  IF _grafiek IN ('leads_dag','leads_status','leads_status_type','leads_verzekering') THEN
    RETURN QUERY
    SELECT CASE _grafiek
             WHEN 'leads_dag' THEN to_char((l.created_at AT TIME ZONE 'Europe/Amsterdam')::date, 'YYYY-MM-DD')
             WHEN 'leads_status' THEN l.status::text
             WHEN 'leads_status_type' THEN l.status::text || '|' || coalesce(l.type::text, 'onbekend')
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
