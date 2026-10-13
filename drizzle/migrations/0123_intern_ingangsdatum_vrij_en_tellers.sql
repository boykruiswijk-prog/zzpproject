-- Besluit D4 aangevuld (Boy 13 okt 2026): intern mag elke ingangsdatum; klantgrenzen bij INSERT blijven.
DO $do$
DECLARE def text; blok text := $b$
  IF _datum <= (l.created_at AT TIME ZONE 'Europe/Amsterdam')::date THEN
    RAISE EXCEPTION 'De ingangsdatum is vroegst de dag na de aanvraag (%).', to_char((l.created_at AT TIME ZONE 'Europe/Amsterdam')::date + 1, 'DD-MM-YYYY');
  END IF;$b$;
BEGIN
  def := pg_get_functiondef('public.lead_ingangsdatum_wijzigen(uuid,date,text)'::regprocedure);
  IF position(blok in def) > 0 THEN
    EXECUTE replace(def, blok, '');
  END IF;
  IF position('vroegst de dag na de aanvraag' in pg_get_functiondef('public.lead_ingangsdatum_wijzigen(uuid,date,text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'weigering niet verwijderd uit lead_ingangsdatum_wijzigen';
  END IF;
END $do$;

-- Creditnota's uit het oude systeem die al in AFAS zijn afgehandeld.
ALTER TABLE public.factuur_credit_planning DROP CONSTRAINT factuur_credit_planning_status_check;
ALTER TABLE public.factuur_credit_planning ADD CONSTRAINT factuur_credit_planning_status_check CHECK (status = ANY (ARRAY['te_maken','concept_niet_verwerkt','geen_planner_factuur','geblokkeerd','geclaimd','concept_aangemaakt','verwerkt','verwijderd_in_exact','te_laat','fout','wacht_op_akkoord','niet_crediteren','handmatig_afgehandeld']));

CREATE OR REPLACE FUNCTION public.credit_handmatig_afgehandeld(_id uuid, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); c public.factuur_credit_planning%ROWTYPE; t text := btrim(coalesce(_toelichting,''));
BEGIN
  IF NOT (public.is_supervisor_or_admin(me) OR public.has_role(me, 'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(t) < 3 OR length(t) > 500 THEN RAISE EXCEPTION 'toelichting is verplicht (3-500 tekens)'; END IF;
  SELECT * INTO c FROM public.factuur_credit_planning WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'creditnota niet gevonden'; END IF;
  IF coalesce(c.melding,'') NOT LIKE '%oud systeem%' THEN RAISE EXCEPTION 'alleen voor creditnota''s uit het oude systeem'; END IF;
  IF c.status IN ('verwerkt','handmatig_afgehandeld','niet_crediteren','concept_aangemaakt','geclaimd') THEN RAISE EXCEPTION 'deze creditnota is al afgehandeld of loopt'; END IF;
  UPDATE public.factuur_credit_planning SET status = 'handmatig_afgehandeld', beoordeeld_door = me,
    beoordeeld_door_naam = (SELECT coalesce(p.full_name, p.email) FROM public.profiles p WHERE p.id = me),
    beoordeeld_op = now(), beoordeling_reden = t WHERE id = _id;
  INSERT INTO public.sensitive_audit_log(target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
  VALUES ('factuur_credit_planning', _id, 'credit_handmatig_afgehandeld_afas', 'status', c.status, 'handmatig_afgehandeld', me,
    (SELECT email FROM auth.users WHERE id = me), public.get_user_role_label(me), jsonb_build_object('toelichting', t, 'melding', c.melding));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.credit_handmatig_afgehandeld(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_handmatig_afgehandeld(uuid, text) TO authenticated;

-- Menu: uitsplitsing van de klantenteller voor uitleg en doorklik.
DO $do$
DECLARE def text; anker text := $a$    'credits_akkoord',$a$;
BEGIN
  def := pg_get_functiondef('public.menu_tellers()'::regprocedure);
  IF position('klanten_credits' in def) = 0 THEN
    IF position(anker in def) = 0 THEN RAISE EXCEPTION 'anker niet gevonden in menu_tellers'; END IF;
    def := replace(def, anker, $n$    'klanten_credits', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')),
    'klanten_credits_oud', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout') AND coalesce(melding,'') LIKE '%oud systeem%'),
    'klanten_taken', (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'nieuwe_aanvraag_nodig'),
$n$ || anker);
    EXECUTE def;
  END IF;
END $do$;