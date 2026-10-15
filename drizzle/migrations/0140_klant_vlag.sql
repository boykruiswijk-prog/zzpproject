ALTER TABLE public.ondernemingen
  ADD COLUMN IF NOT EXISTS vlag text,
  ADD COLUMN IF NOT EXISTS vlag_notitie text,
  ADD COLUMN IF NOT EXISTS vlag_datum date,
  ADD COLUMN IF NOT EXISTS vlag_door uuid,
  ADD COLUMN IF NOT EXISTS vlag_op timestamptz;
ALTER TABLE public.ondernemingen ADD CONSTRAINT ondernemingen_vlag_soort CHECK (vlag IS NULL OR vlag IN ('later','actie'));
ALTER TABLE public.ondernemingen ADD CONSTRAINT ondernemingen_vlag_later_datum CHECK (vlag IS DISTINCT FROM 'later' OR vlag_datum IS NOT NULL);
CREATE INDEX IF NOT EXISTS ondernemingen_vlag_idx ON public.ondernemingen (vlag, vlag_datum) WHERE vlag IS NOT NULL;

CREATE TABLE public.klant_vlag_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onderneming_id uuid NOT NULL REFERENCES public.ondernemingen(id),
  actie text NOT NULL CHECK (actie IN ('vlag_gezet','vlag_verwijderd')),
  soort text, vorige text, datum date, notitie text, toelichting text,
  door uuid, door_naam text,
  op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.klant_vlag_log TO authenticated;
GRANT ALL ON public.klant_vlag_log TO service_role;
ALTER TABLE public.klant_vlag_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest klantvlaglog" ON public.klant_vlag_log FOR SELECT TO authenticated
  USING (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role));
CREATE INDEX klant_vlag_log_ond_idx ON public.klant_vlag_log (onderneming_id, op DESC);

CREATE OR REPLACE FUNCTION public.guard_klant_vlag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('zp.vlag_rpc', true),'0') <> '1' AND (
       NEW.vlag IS DISTINCT FROM OLD.vlag OR NEW.vlag_notitie IS DISTINCT FROM OLD.vlag_notitie
    OR NEW.vlag_datum IS DISTINCT FROM OLD.vlag_datum OR NEW.vlag_door IS DISTINCT FROM OLD.vlag_door
    OR NEW.vlag_op IS DISTINCT FROM OLD.vlag_op) THEN
    RAISE EXCEPTION 'Vlag alleen wijzigen via Vlag aanpassen' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_klant_vlag ON public.ondernemingen;
CREATE TRIGGER trg_guard_klant_vlag BEFORE UPDATE ON public.ondernemingen FOR EACH ROW EXECUTE FUNCTION public.guard_klant_vlag();

CREATE OR REPLACE FUNCTION public.zet_klant_vlag(_onderneming_id uuid, _soort text, _notitie text, _datum date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ondernemingen; naam text; oms text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF _soort IS NULL OR _soort NOT IN ('later','actie') THEN RAISE EXCEPTION 'kies Later aandacht of Actie nodig'; END IF;
  IF length(trim(coalesce(_notitie,''))) < 3 OR length(trim(_notitie)) > 500 THEN RAISE EXCEPTION 'notitie verplicht (3-500 tekens)'; END IF;
  IF _soort = 'later' AND _datum IS NULL THEN RAISE EXCEPTION 'opvolgdatum verplicht bij Later aandacht'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id=_onderneming_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  oms := CASE WHEN o.vlag IS NULL THEN 'Klantvlag gezet' ELSE 'Klantvlag aangepast' END || ' bij ' || coalesce(o.naam,'klant') || ': '
    || CASE WHEN _soort='later' THEN 'Later aandacht' ELSE 'Actie nodig' END
    || CASE WHEN _datum IS NOT NULL THEN ' (opvolgen ' || to_char(_datum,'DD-MM-YYYY') || ')' ELSE '' END || ': ' || trim(_notitie);
  PERFORM set_config('zp.vlag_rpc','1',true);
  UPDATE public.ondernemingen SET vlag=_soort, vlag_notitie=trim(_notitie), vlag_datum=_datum, vlag_door=auth.uid(), vlag_op=now() WHERE id=_onderneming_id;
  PERFORM set_config('zp.vlag_rpc','0',true);
  INSERT INTO public.klant_vlag_log (onderneming_id,actie,soort,vorige,datum,notitie,door,door_naam)
  VALUES (_onderneming_id,'vlag_gezet',_soort,o.vlag,_datum,trim(_notitie),auth.uid(),naam);
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
  VALUES ('klant_vlag_gezet', oms, auth.uid(), naam, NULL, NULL, coalesce(o.is_test,false));
  RETURN jsonb_build_object('vlag',_soort,'datum',_datum);
END $$;

CREATE OR REPLACE FUNCTION public.verwijder_klant_vlag(_onderneming_id uuid, _toelichting text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ondernemingen; naam text;
BEGIN
  IF NOT (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RAISE EXCEPTION 'geen toegang' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(_toelichting,''))) < 3 OR length(trim(_toelichting)) > 500 THEN RAISE EXCEPTION 'toelichting verplicht (3-500 tekens)'; END IF;
  SELECT * INTO o FROM public.ondernemingen WHERE id=_onderneming_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'klant niet gevonden'; END IF;
  IF o.vlag IS NULL THEN RAISE EXCEPTION 'er staat geen vlag'; END IF;
  naam := (SELECT full_name FROM public.profiles WHERE id=auth.uid());
  PERFORM set_config('zp.vlag_rpc','1',true);
  UPDATE public.ondernemingen SET vlag=NULL, vlag_notitie=NULL, vlag_datum=NULL, vlag_door=NULL, vlag_op=NULL WHERE id=_onderneming_id;
  PERFORM set_config('zp.vlag_rpc','0',true);
  INSERT INTO public.klant_vlag_log (onderneming_id,actie,soort,vorige,datum,notitie,toelichting,door,door_naam)
  VALUES (_onderneming_id,'vlag_verwijderd',NULL,o.vlag,o.vlag_datum,o.vlag_notitie,trim(_toelichting),auth.uid(),naam);
  INSERT INTO public.activiteiten_log (actie_type,omschrijving,uitgevoerd_door,uitgevoerd_door_naam,lead_id,klant_email,is_test)
  VALUES ('klant_vlag_verwijderd', 'Klantvlag verwijderd bij ' || coalesce(o.naam,'klant') || ' (' || CASE WHEN o.vlag='later' THEN 'Later aandacht' ELSE 'Actie nodig' END || '): ' || trim(_toelichting), auth.uid(), naam, NULL, NULL, coalesce(o.is_test,false));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.zet_klant_vlag(uuid,text,text,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verwijder_klant_vlag(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zet_klant_vlag(uuid,text,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verwijder_klant_vlag(uuid,text) TO authenticated;

DO $do$
DECLARE d text := pg_get_functiondef('public.mijn_acties_vandaag(boolean)'::regprocedure); n text;
BEGIN
  n := replace(d, $a$  r := r || jsonb_build_object('vlaggen', c);
$a$, $a$  r := r || jsonb_build_object('vlaggen', c);

  -- Gemarkeerde bestaande klanten waarvan de opvolgdatum vandaag of eerder is
  WITH kb AS (
    SELECT o.* FROM ondernemingen o WHERE (_toon_test OR NOT o.is_test) AND o.vlag IS NOT NULL AND o.vlag_datum IS NOT NULL AND o.vlag_datum <= vandaag
  )
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM kb),
    'items', coalesce((SELECT jsonb_agg(x ORDER BY sinds) FROM (
      SELECT jsonb_build_object('id', id, 'naam', naam, 'sinds', vlag_datum,
        'reden', CASE WHEN vlag='later' THEN 'Vandaag opvolgen: ' ELSE 'Actie nodig: ' END || coalesce(vlag_notitie,'')) x, vlag_datum sinds
      FROM kb ORDER BY vlag_datum LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('klant_vlaggen', c);
$a$);
  n := replace(n, $a$'einddatum_controle','vlaggen']$a$, $a$'einddatum_controle','vlaggen','klant_vlaggen']$a$);
  IF position($a$'klant_vlaggen', c$a$ in n) = 0 OR position($a$'vlaggen','klant_vlaggen']$a$ in n) = 0 THEN RAISE EXCEPTION 'mijn_acties_vandaag niet aangepast'; END IF;
  EXECUTE n;
END $do$;