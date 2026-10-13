-- Besluit Boy 13 okt 2026 (A12 aangevuld): tijdelijk verplicht KVK-uittreksel bij het startertarief zolang de KVK API niet operationeel is.
CREATE TABLE public.kvk_uittreksels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id),
  pad text NOT NULL UNIQUE,
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png')),
  grootte integer NOT NULL CHECK (grootte > 0 AND grootte <= 10485760),
  geupload_op timestamptz NOT NULL DEFAULT now(),
  is_test boolean NOT NULL DEFAULT false
);
CREATE INDEX kvk_uittreksels_lead_idx ON public.kvk_uittreksels(lead_id);
CREATE INDEX kvk_uittreksels_concept_idx ON public.kvk_uittreksels(concept_id);
GRANT SELECT ON public.kvk_uittreksels TO authenticated;
GRANT ALL ON public.kvk_uittreksels TO service_role;
ALTER TABLE public.kvk_uittreksels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest KVK-uittreksels" ON public.kvk_uittreksels FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role));

-- Bestanden: alleen lezen (signed URL) door team; schrijven alleen via de server (service role).
CREATE POLICY "Team leest KVK-uittreksel bestanden" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kvk-uittreksels' AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'verzekering'::app_role)));

-- Inschrijfdatum volgens uittreksel, door het team, met audit.
CREATE OR REPLACE FUNCTION public.kvk_uittreksel_datum(_lead_id uuid, _datum date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); l public.leads; eind date; voldoet boolean;
BEGIN
  IF NOT (public.is_supervisor_or_admin(me) OR public.has_role(me, 'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF _datum IS NULL OR _datum < date '1900-01-01' OR _datum > (now() AT TIME ZONE 'Europe/Amsterdam')::date THEN RAISE EXCEPTION 'vul een geldige inschrijfdatum in (niet in de toekomst)'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  IF l.geactiveerd_op IS NOT NULL THEN RAISE EXCEPTION 'aanvraag is al geactiveerd'; END IF;
  IF l.starter_controle_status IS DISTINCT FROM 'te_controleren' THEN RAISE EXCEPTION 'startertarief is al beoordeeld of niet aangevraagd'; END IF;
  eind := (_datum + interval '12 months')::date;
  voldoet := l.ingangsdatum IS NOT NULL AND _datum <= l.ingangsdatum AND l.ingangsdatum < eind;
  PERFORM set_config('zp.starter_rpc', '1', true);
  UPDATE public.leads SET kvk_startdatum = _datum, kvk_datum_bron = 'uittreksel',
    activatie_log = coalesce(activatie_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'tijd', now(), 'actie', 'kvk_startdatum_uittreksel', 'oud', l.kvk_startdatum, 'nieuw', _datum, 'oud_bron', l.kvk_datum_bron, 'door', me))
  WHERE id = _lead_id;
  PERFORM set_config('zp.starter_rpc', '0', true);
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
  VALUES ('leads', _lead_id, 'kvk_startdatum_uittreksel', 'kvk_startdatum', l.kvk_startdatum::text, _datum::text, me, public.get_user_role_label(me));
  INSERT INTO public.activiteiten_log (actie_type, omschrijving, uitgevoerd_door, uitgevoerd_door_naam, lead_id, is_test)
  VALUES ('kvk_startdatum_uittreksel', 'Inschrijfdatum volgens KVK-uittreksel ingevuld: ' || to_char(_datum, 'DD-MM-YYYY'),
    me, (SELECT full_name FROM public.profiles WHERE id = me), _lead_id, l.is_test);
  RETURN jsonb_build_object('ok', true, 'voldoet', voldoet, 'vervalt_per', eind);
END $$;
REVOKE ALL ON FUNCTION public.kvk_uittreksel_datum(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kvk_uittreksel_datum(uuid, date) TO authenticated;