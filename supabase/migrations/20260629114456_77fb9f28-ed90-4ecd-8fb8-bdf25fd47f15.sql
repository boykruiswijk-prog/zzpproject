
CREATE OR REPLACE FUNCTION public.__role_guard_verification()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _lead_id   uuid;
  _mede_uid  uuid;
  _sup_uid   uuid;
  _new_iban  text := 'NL00TEST0000000099';
  _results   jsonb := '{}'::jsonb;
  _result    text;
  _audit_before bigint;
  _audit_after  bigint;
  _audit_row    jsonb;
  _onb_id       uuid;
BEGIN
  SELECT id INTO _lead_id FROM public.leads
   WHERE status = 'actief'::lead_status AND geactiveerd_op IS NOT NULL
   ORDER BY geactiveerd_op DESC LIMIT 1;

  SELECT user_id INTO _mede_uid FROM public.user_roles WHERE role = 'medewerker' LIMIT 1;

  SELECT user_id INTO _sup_uid FROM public.user_roles WHERE role = 'supervisor' LIMIT 1;
  IF _sup_uid IS NULL THEN
    SELECT user_id INTO _sup_uid FROM public.user_roles
     WHERE role = 'medewerker' AND user_id <> _mede_uid LIMIT 1;
    IF _sup_uid IS NULL THEN _sup_uid := _mede_uid; END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_sup_uid, 'supervisor')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  _results := _results
    || jsonb_build_object('lead_id', _lead_id,
                          'medewerker_uid', _mede_uid,
                          'supervisor_uid', _sup_uid);

  -- helper inline: per test een subtransactie
  -- (a) medewerker IBAN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_mede_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN (onverwacht)' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('medewerker_iban_actieve_lead', _result);

  -- (b) medewerker opzeggen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_mede_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET status='opgezegd'::lead_status WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN (onverwacht)' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('medewerker_polis_opzeggen', _result);

  -- (c) medewerker delete
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_mede_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN (onverwacht)' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('medewerker_lead_verwijderen', _result);

  -- (a) supervisor IBAN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_sup_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('supervisor_iban_actieve_lead', _result);

  -- (b) supervisor opzeggen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_sup_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET status='opgezegd'::lead_status WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('supervisor_polis_opzeggen', _result);

  -- (c) supervisor delete
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_sup_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    _result := CASE WHEN SQLERRM='X_ALLOWED' THEN 'TOEGESTAAN' ELSE 'GEWEIGERD: '||SQLERRM END;
  END;
  _results := _results || jsonb_build_object('supervisor_lead_verwijderen', _result);

  -- Onboarding (medewerker) op niet-geactiveerde lead
  BEGIN
    INSERT INTO public.leads(voornaam, achternaam, email, type, status)
      VALUES ('Test','Onboarding','onb+verify@example.org','verzekering_aanvraag','nieuw'::lead_status)
      RETURNING id INTO _onb_id;

    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_mede_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads
       SET iban='NL91ABNA0417164300', gekozen_pakket='basis',
           verzekerd_bedrag='1.250.000', eigen_risico=250,
           status='in_behandeling'::lead_status
     WHERE id = _onb_id;
    RESET ROLE;
    _result := 'TOEGESTAAN (medewerker mag onboarding doen)';
    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM <> 'X_ALLOWED' THEN _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  _results := _results || jsonb_build_object('medewerker_onboarding_pre_activatie', _result);

  -- Audit-log voorbeeld
  BEGIN
    SELECT COUNT(*) INTO _audit_before FROM public.sensitive_audit_log;

    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub',_sup_uid,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
    RESET ROLE;

    SELECT to_jsonb(s.*) INTO _audit_row
      FROM public.sensitive_audit_log s
     WHERE target_id = _lead_id AND veld='iban'
     ORDER BY uitgevoerd_op DESC LIMIT 1;

    RAISE EXCEPTION 'X_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    SELECT COUNT(*) INTO _audit_after FROM public.sensitive_audit_log;
  END;
  _results := _results || jsonb_build_object(
    'audit_voorbeeldregel', _audit_row,
    'audit_rijen_voor', _audit_before,
    'audit_rijen_na_rollback', _audit_after);

  -- alle wijzigingen binnen deze functie terugrollen (incl. tijdelijke supervisor-rol en testlead)
  RAISE EXCEPTION 'ROLLBACK_ALL' USING DETAIL = _results::text;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'ROLLBACK_ALL' THEN
    RETURN ((PG_EXCEPTION_DETAIL))::jsonb;
  ELSE
    RAISE;
  END IF;
END;
$fn$;
