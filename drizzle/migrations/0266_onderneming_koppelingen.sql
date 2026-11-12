CREATE TABLE public.onderneming_koppelingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vorige_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  nieuwe_onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  reden text NOT NULL,
  lead_id uuid,
  vastgelegd_door uuid NOT NULL,
  vastgelegd_op timestamptz NOT NULL DEFAULT now(),
  is_test boolean NOT NULL DEFAULT false,
  CHECK (vorige_onderneming_id <> nieuwe_onderneming_id),
  UNIQUE (vorige_onderneming_id, nieuwe_onderneming_id)
);
COMMENT ON TABLE public.onderneming_koppelingen IS 'Rechtsvormwijziging (besluit D 12-11-2026): oude en nieuwe onderneming gekoppeld voor gegevens en historie. Verplaatst geen polis, contract of BAV-nummer; schrijven alleen via RPC onderneming_koppel_vorige.';
GRANT SELECT ON public.onderneming_koppelingen TO authenticated;
GRANT ALL ON public.onderneming_koppelingen TO service_role;
ALTER TABLE public.onderneming_koppelingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest koppelingen" ON public.onderneming_koppelingen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.onderneming_koppel_vorige(_nieuw uuid, _vorig uuid, _reden text, _lead_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; n public.ondernemingen; v public.ondernemingen; r text := btrim(coalesce(_reden,''));
BEGIN
  IF coalesce(auth.jwt()->>'aal','') <> 'aal2' THEN RAISE EXCEPTION 'tweestapsverificatie vereist'; END IF;
  IF NOT public.mag_crm_beeindigen(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(r) < 10 OR length(r) > 500 THEN RAISE EXCEPTION 'reden is verplicht (10 tot 500 tekens)'; END IF;
  IF _nieuw IS NULL OR _vorig IS NULL OR _nieuw = _vorig THEN RAISE EXCEPTION 'kies een andere onderneming'; END IF;
  SELECT * INTO n FROM public.ondernemingen WHERE id = _nieuw;
  SELECT * INTO v FROM public.ondernemingen WHERE id = _vorig;
  IF n.id IS NULL OR v.id IS NULL THEN RAISE EXCEPTION 'onderneming niet gevonden'; END IF;
  IF EXISTS (SELECT 1 FROM public.onderneming_koppelingen WHERE (vorige_onderneming_id = _vorig AND nieuwe_onderneming_id = _nieuw) OR (vorige_onderneming_id = _nieuw AND nieuwe_onderneming_id = _vorig)) THEN
    RAISE EXCEPTION 'deze ondernemingen zijn al gekoppeld'; END IF;
  INSERT INTO public.onderneming_koppelingen (vorige_onderneming_id, nieuwe_onderneming_id, reden, lead_id, vastgelegd_door, is_test)
  VALUES (_vorig, _nieuw, r, _lead_id, auth.uid(), n.is_test OR v.is_test) RETURNING id INTO v_id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('onderneming_koppelingen', v_id, 'koppel_vorige_onderneming', 'vorige_onderneming_id', NULL, _vorig::text, auth.uid(), public.get_user_role_label(auth.uid()),
    jsonb_build_object('nieuwe_onderneming_id', _nieuw, 'reden', r, 'lead_id', _lead_id));
  PERFORM public.crm_notitie_toevoegen(_nieuw, NULL, 'ondernemingswijziging', 'Gekoppeld aan vorige onderneming ' || v.naam || E'\nReden: ' || r, jsonb_build_object('koppeling_id', v_id, 'vorige_onderneming_id', _vorig));
  PERFORM public.crm_notitie_toevoegen(_vorig, NULL, 'ondernemingswijziging', 'Gekoppeld aan nieuwe onderneming ' || n.naam || E'\nReden: ' || r, jsonb_build_object('koppeling_id', v_id, 'nieuwe_onderneming_id', _nieuw));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.onderneming_koppel_vorige(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onderneming_koppel_vorige(uuid, uuid, text, uuid) TO authenticated, service_role;