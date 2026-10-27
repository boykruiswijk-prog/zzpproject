CREATE OR REPLACE FUNCTION public.crm_gegevens_wijzigen(_onderneming_id uuid, _persoon_id uuid, _wijzigingen jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.ondernemingen; p public.personen; k text; v text; oud text; regels text := ''; exact_velden text[] := '{}'; n int := 0;
  v_naam text; v_test boolean := false; mask text; v_bestaand uuid;
  ond_velden text[] := ARRAY['naam','kvk','rechtsvorm','straat','huisnummer','postcode','plaats','iban','factuur_email'];
  pers_velden text[] := ARRAY['voornaam','achternaam','email_weergave','telefoon'];
BEGIN
  IF NOT public.mag_crm_beeindigen(auth.uid()) OR public.has_role(auth.uid(),'medewerker') AND NOT (public.has_role(auth.uid(),'verzekering') OR public.is_supervisor_or_admin(auth.uid())) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _wijzigingen IS NULL OR jsonb_typeof(_wijzigingen) <> 'object' THEN RAISE EXCEPTION 'geen wijzigingen'; END IF;
  SELECT full_name INTO v_naam FROM public.profiles WHERE id = auth.uid();
  IF _onderneming_id IS NOT NULL THEN SELECT * INTO o FROM public.ondernemingen WHERE id = _onderneming_id FOR UPDATE; IF o.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF; v_test := o.is_test; END IF;
  IF _persoon_id IS NOT NULL THEN SELECT * INTO p FROM public.personen WHERE id = _persoon_id FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'persoon niet gevonden'; END IF; v_test := v_test OR p.is_test; END IF;
  FOR k, v IN SELECT key, nullif(btrim(value #>> '{}'),'') FROM jsonb_each(_wijzigingen) LOOP
    IF k = 'iban' THEN
      IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'IBAN wijzigen alleen supervisor of admin'; END IF;
      v := upper(replace(v,' ',''));
      IF v IS NOT NULL AND v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$' THEN RAISE EXCEPTION 'ongeldig IBAN'; END IF;
    END IF;
    IF k = 'kvk' AND v IS DISTINCT FROM o.kvk THEN
      IF o.kvk IS NOT NULL THEN RAISE EXCEPTION 'KvK-nummer is niet wijzigbaar. Bij een nieuw KvK-nummer is een nieuwe aanvraag en een nieuwe polis nodig (gebruik Ondernemingswijziging).'; END IF;
      IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Een leeg KvK-nummer invullen kan alleen een supervisor of admin'; END IF;
    END IF;
    IF k = 'kvk' AND v IS NOT NULL AND v !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'KvK moet 8 cijfers zijn'; END IF;
    IF k = 'postcode' AND v IS NOT NULL THEN v := upper(regexp_replace(v,'\s','','g')); IF v !~ '^[1-9][0-9]{3}[A-Z]{2}$' THEN RAISE EXCEPTION 'ongeldige postcode'; END IF; v := substr(v,1,4)||' '||substr(v,5,2); END IF;
    IF k = 'factuur_email' AND v IS NOT NULL THEN v := lower(v); END IF;
    IF k IN ('email_weergave','factuur_email') AND v IS NOT NULL AND v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'ongeldig e-mailadres'; END IF;
    IF length(coalesce(v,'')) > 200 THEN RAISE EXCEPTION 'waarde te lang'; END IF;
    IF k = ANY(ond_velden) THEN
      IF o.id IS NULL THEN RAISE EXCEPTION 'geen onderneming gekozen'; END IF;
      EXECUTE format('SELECT ($1).%I::text', k) INTO oud USING o;
      IF oud IS DISTINCT FROM v THEN
        EXECUTE format('UPDATE public.ondernemingen SET %I = $1, updated_at = now() WHERE id = $2', k) USING v, o.id;
        mask := CASE WHEN k = 'iban' THEN coalesce(left(oud,4)||'****'||right(oud,4),'-') || ' -> ' || coalesce(left(v,4)||'****'||right(v,4),'-') ELSE coalesce(oud,'-')||' -> '||coalesce(v,'-') END;
        INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
        VALUES ('ondernemingen', o.id, 'gegevens_gewijzigd', k, oud, v, auth.uid(), public.get_user_role_label(auth.uid()));
        regels := regels || E'\n- ' || k || ': ' || mask; n := n + 1;
        IF k IN ('naam','straat','huisnummer','postcode','plaats','iban','factuur_email') THEN exact_velden := exact_velden || k; END IF;
      END IF;
    ELSIF k = ANY(pers_velden) THEN
      IF p.id IS NULL THEN RAISE EXCEPTION 'geen persoon gekozen'; END IF;
      EXECUTE format('SELECT ($1).%I::text', k) INTO oud USING p;
      IF oud IS DISTINCT FROM v THEN
        IF k = 'email_weergave' THEN
          IF v IS NULL THEN RAISE EXCEPTION 'e-mailadres mag niet leeg'; END IF;
          UPDATE public.personen SET email_weergave = v, genormaliseerd_email = lower(v), updated_at = now() WHERE id = p.id;
        ELSE
          EXECUTE format('UPDATE public.personen SET %I = $1, updated_at = now() WHERE id = $2', k) USING v, p.id;
        END IF;
        INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
        VALUES ('personen', p.id, 'gegevens_gewijzigd', k, oud, v, auth.uid(), public.get_user_role_label(auth.uid()));
        regels := regels || E'\n- ' || k || ': ' || coalesce(oud,'-') || ' -> ' || coalesce(v,'-'); n := n + 1;
        IF k IN ('voornaam','achternaam') THEN exact_velden := exact_velden || k; END IF;
      END IF;
    ELSE
      RAISE EXCEPTION 'onbekend veld %', k;
    END IF;
  END LOOP;
  IF n = 0 THEN RETURN jsonb_build_object('gewijzigd', 0); END IF;
  INSERT INTO public.crm_notities (onderneming_id, persoon_id, soort, tekst, aangemaakt_door, aangemaakt_door_naam, is_test, details)
  VALUES (o.id, p.id, 'overig', 'Gegevens gewijzigd door ' || coalesce(v_naam,'teamlid') || ':' || regels, auth.uid(), coalesce(v_naam,'teamlid'), v_test, jsonb_build_object('soort','gegevenswijziging'));
  IF array_length(exact_velden,1) > 0 THEN
    SELECT t.id INTO v_bestaand FROM public.crm_taken t
     WHERE t.status = 'open' AND t.soort = 'exact_aanpassen' AND t.onderneming_id IS NOT DISTINCT FROM o.id
       AND coalesce(t.details->'velden','[]'::jsonb) @> to_jsonb(exact_velden)
     ORDER BY t.aangemaakt_op LIMIT 1;
  END IF;
  IF array_length(exact_velden,1) > 0 AND v_bestaand IS NOT NULL THEN
    UPDATE public.crm_taken SET details = coalesce(details,'{}'::jsonb) || jsonb_build_object('laatst_bijgewerkt_op', now(),
      'samengevoegd_aantal', coalesce((details->>'samengevoegd_aantal')::int, 0) + 1) WHERE id = v_bestaand;
  ELSIF array_length(exact_velden,1) > 0 THEN
    INSERT INTO public.crm_taken (soort, onderneming_id, persoon_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
    VALUES ('exact_aanpassen', o.id, p.id, 'Ook in Exact aanpassen: ' || array_to_string(exact_velden, ', ') || coalesce(' (' || o.naam || coalesce(', relatie ' || o.exact_relatie_code, '') || ')', ''),
      jsonb_build_object('velden', exact_velden), auth.uid(), coalesce(v_naam,'teamlid'), v_test);
  END IF;
  RETURN jsonb_build_object('gewijzigd', n, 'exact_taak', array_length(exact_velden,1) > 0);
END $function$;