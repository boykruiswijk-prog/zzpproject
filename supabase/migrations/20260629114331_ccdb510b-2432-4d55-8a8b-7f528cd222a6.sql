
DO $verify$
DECLARE
  _lead_id   uuid;
  _mede_uid  uuid;
  _sup_uid   uuid;
  _result    text;
  _new_iban  text := 'NL00TEST0000000099';
BEGIN
  -- Kies een echte, geactiveerde lead
  SELECT id INTO _lead_id FROM public.leads
   WHERE status = 'actief'::lead_status AND geactiveerd_op IS NOT NULL
   ORDER BY geactiveerd_op DESC LIMIT 1;
  IF _lead_id IS NULL THEN RAISE EXCEPTION 'geen geactiveerde lead gevonden'; END IF;

  -- Pak een echte medewerker
  SELECT user_id INTO _mede_uid FROM public.user_roles WHERE role = 'medewerker' LIMIT 1;
  IF _mede_uid IS NULL THEN RAISE EXCEPTION 'geen medewerker gevonden'; END IF;

  -- Pak (of fabriceer tijdelijk) een supervisor: voeg supervisor-rol toe aan een tweede medewerker
  SELECT user_id INTO _sup_uid FROM public.user_roles WHERE role = 'supervisor' LIMIT 1;
  IF _sup_uid IS NULL THEN
    SELECT user_id INTO _sup_uid FROM public.user_roles
     WHERE role = 'medewerker' AND user_id <> _mede_uid LIMIT 1;
    IF _sup_uid IS NULL THEN _sup_uid := _mede_uid; END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (_sup_uid, 'supervisor')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RAISE NOTICE '=== TESTSET ===';
  RAISE NOTICE 'lead_id = %', _lead_id;
  RAISE NOTICE 'medewerker uid = %', _mede_uid;
  RAISE NOTICE 'supervisor uid = % (tijdelijk in savepoint)', _sup_uid;

  -- Helper: stel JWT-claims en rol zo in dat auth.uid() de gewenste uid teruggeeft en RLS authenticated is.
  -- We doen alle echte mutaties in een sub-blok dat altijd terugrolt.

  ---------- MEDEWERKER ----------
  RAISE NOTICE '--- ROL: medewerker ---';

  -- (a) IBAN wijzigen op actieve lead
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _mede_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN (onverwacht!)';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'medewerker / IBAN-wijziging op actieve lead => %', _result;

  -- (b) Polis opzeggen (status -> opgezegd)
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _mede_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET status = 'opgezegd'::lead_status WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN (onverwacht!)';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'medewerker / polis opzeggen          => %', _result;

  -- (c) Lead verwijderen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _mede_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN (onverwacht!)';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'medewerker / lead verwijderen        => %', _result;

  ---------- SUPERVISOR ----------
  RAISE NOTICE '--- ROL: supervisor ---';

  -- (a) IBAN wijzigen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _sup_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'supervisor / IBAN-wijziging op actieve lead => %', _result;

  -- (b) Polis opzeggen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _sup_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    UPDATE public.leads SET status = 'opgezegd'::lead_status WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'supervisor / polis opzeggen          => %', _result;

  -- (c) Lead verwijderen
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', _sup_uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id = _lead_id;
    RESET ROLE;
    RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM = 'TEST_ALLOWED_ROLLBACK' THEN _result := 'TOEGESTAAN';
    ELSE _result := 'GEWEIGERD: '||SQLERRM; END IF;
  END;
  RAISE NOTICE 'supervisor / lead verwijderen        => %', _result;

  ---------- ONBOARDING (medewerker) ----------
  RAISE NOTICE '--- ROL: medewerker, normale onboarding pre-activatie ---';

  -- Maak tijdelijke niet-geactiveerde testlead voor onboarding-check
  DECLARE _onb_id uuid; BEGIN
    INSERT INTO public.leads(voornaam, achternaam, email, type, status)
      VALUES ('Test','Onboarding','onb-test+verify@example.org','verzekering_aanvraag','nieuw'::lead_status)
      RETURNING id INTO _onb_id;

    BEGIN
      PERFORM set_config('request.jwt.claim.sub', _mede_uid::text, true);
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', _mede_uid, 'role','authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.leads
         SET iban='NL91ABNA0417164300', gekozen_pakket='basis',
             verzekerd_bedrag='1.250.000', eigen_risico=250,
             status='in_behandeling'::lead_status
       WHERE id = _onb_id;
      RESET ROLE;
      _result := 'TOEGESTAAN (medewerker mag onboarding doen)';
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      _result := 'GEWEIGERD: '||SQLERRM;
    END;
    RAISE NOTICE 'medewerker / onboarding-velden vóór activatie => %', _result;
  END;

  ---------- AUDIT LOG ----------
  RAISE NOTICE '--- AUDIT LOG ---';
  DECLARE _audit_before bigint; _audit_after bigint; _row jsonb; BEGIN
    SELECT COUNT(*) INTO _audit_before FROM public.sensitive_audit_log;

    -- Voer als supervisor één gevoelige IBAN-wijziging uit en rol meteen terug,
    -- maar lees de log-rij die de trigger schreef vóór rollback.
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', _sup_uid::text, true);
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', _sup_uid, 'role','authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      UPDATE public.leads SET iban = _new_iban WHERE id = _lead_id;
      RESET ROLE;

      SELECT to_jsonb(s.*) INTO _row
        FROM public.sensitive_audit_log s
       WHERE target_id = _lead_id AND veld='iban'
       ORDER BY uitgevoerd_op DESC LIMIT 1;
      RAISE NOTICE 'audit-voorbeeldregel: %', _row::text;

      RAISE EXCEPTION 'TEST_ALLOWED_ROLLBACK';
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      IF SQLERRM <> 'TEST_ALLOWED_ROLLBACK' THEN
        RAISE NOTICE 'audit-test fout: %', SQLERRM;
      END IF;
    END;

    SELECT COUNT(*) INTO _audit_after FROM public.sensitive_audit_log;
    RAISE NOTICE 'audit-log rijen voor/na (moet gelijk zijn na rollback): % / %', _audit_before, _audit_after;
  END;

  -- Rol alle test-mutaties (zoals de tijdelijke supervisor-rol en de onboarding-lead) terug
  RAISE EXCEPTION 'TEST_OK_ROLLBACK_ALL';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'TEST_OK_ROLLBACK_ALL' THEN
    RAISE NOTICE '=== Alle test-wijzigingen teruggerold. Geen permanente data-veranderingen. ===';
  ELSE
    RAISE;
  END IF;
END
$verify$;
