
CREATE OR REPLACE FUNCTION public.__delete_guard_verification()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $fn$
DECLARE
  _lead_id uuid; _pol_id uuid;
  _mede uuid; _sup uuid;
  _exists boolean; _r jsonb := '{}'::jsonb; _detail text;
BEGIN
  SELECT id INTO _lead_id FROM public.leads
   WHERE status='actief'::lead_status ORDER BY geactiveerd_op DESC LIMIT 1;
  SELECT id INTO _pol_id FROM public.policies ORDER BY created_at DESC LIMIT 1;
  SELECT user_id INTO _mede FROM public.user_roles WHERE role='medewerker' LIMIT 1;
  SELECT user_id INTO _sup FROM public.user_roles WHERE role='supervisor' LIMIT 1;
  IF _sup IS NULL THEN
    SELECT user_id INTO _sup FROM public.user_roles WHERE role='medewerker' AND user_id<>_mede LIMIT 1;
    IF _sup IS NULL THEN _sup := _mede; END IF;
    INSERT INTO public.user_roles(user_id,role) VALUES (_sup,'supervisor') ON CONFLICT DO NOTHING;
  END IF;

  -- medewerker DELETE lead
  BEGIN
    PERFORM set_config('request.jwt.claim.sub',_mede::text,true);
    PERFORM set_config('request.jwt.claims',json_build_object('sub',_mede,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id=_lead_id;
    SET LOCAL ROLE NONE;
    SELECT EXISTS(SELECT 1 FROM public.leads WHERE id=_lead_id) INTO _exists;
    _r := _r || jsonb_build_object('medewerker_delete_lead',
      CASE WHEN _exists THEN 'GEWEIGERD (RLS filterde de rij; lead bestaat nog)' ELSE 'TOEGESTAAN (onverwacht)' END);
    RAISE EXCEPTION 'ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    SET LOCAL ROLE NONE;
    IF SQLERRM<>'ROLLBACK' THEN _r := _r || jsonb_build_object('medewerker_delete_lead_err',SQLERRM); END IF;
  END;

  -- supervisor DELETE lead
  BEGIN
    PERFORM set_config('request.jwt.claim.sub',_sup::text,true);
    PERFORM set_config('request.jwt.claims',json_build_object('sub',_sup,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.leads WHERE id=_lead_id;
    SET LOCAL ROLE NONE;
    SELECT EXISTS(SELECT 1 FROM public.leads WHERE id=_lead_id) INTO _exists;
    _r := _r || jsonb_build_object('supervisor_delete_lead',
      CASE WHEN _exists THEN 'GEWEIGERD (onverwacht)' ELSE 'TOEGESTAAN (lead verwijderd in sub-tx)' END);
    RAISE EXCEPTION 'ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    SET LOCAL ROLE NONE;
    IF SQLERRM<>'ROLLBACK' THEN _r := _r || jsonb_build_object('supervisor_delete_lead_err',SQLERRM); END IF;
  END;

  -- medewerker DELETE policy
  IF _pol_id IS NOT NULL THEN
    BEGIN
      PERFORM set_config('request.jwt.claim.sub',_mede::text,true);
      PERFORM set_config('request.jwt.claims',json_build_object('sub',_mede,'role','authenticated')::text,true);
      SET LOCAL ROLE authenticated;
      DELETE FROM public.policies WHERE id=_pol_id;
      SET LOCAL ROLE NONE;
      SELECT EXISTS(SELECT 1 FROM public.policies WHERE id=_pol_id) INTO _exists;
      _r := _r || jsonb_build_object('medewerker_delete_policy',
        CASE WHEN _exists THEN 'GEWEIGERD (RLS filterde de rij; polis bestaat nog)' ELSE 'TOEGESTAAN (onverwacht)' END);
      RAISE EXCEPTION 'ROLLBACK';
    EXCEPTION WHEN OTHERS THEN
      SET LOCAL ROLE NONE;
      IF SQLERRM<>'ROLLBACK' THEN _r := _r || jsonb_build_object('medewerker_delete_policy_err',SQLERRM); END IF;
    END;
  END IF;

  RAISE EXCEPTION 'ROLLBACK_ALL' USING DETAIL = _r::text;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='ROLLBACK_ALL' THEN
    GET STACKED DIAGNOSTICS _detail = PG_EXCEPTION_DETAIL;
    RETURN _detail::jsonb;
  ELSE RAISE; END IF;
END;
$fn$;

INSERT INTO public.__verify_results(payload) VALUES (public.__delete_guard_verification());
