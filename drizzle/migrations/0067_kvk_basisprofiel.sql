CREATE TABLE public.kvk_profielen (
  kvk_nummer text PRIMARY KEY CHECK (kvk_nummer ~ '^\d{8}$'),
  profiel jsonb NOT NULL,
  opgehaald_op timestamptz NOT NULL DEFAULT now(),
  bron text NOT NULL DEFAULT 'kvk_api'
);
GRANT ALL ON public.kvk_profielen TO service_role;
GRANT SELECT ON public.kvk_profielen TO authenticated;
ALTER TABLE public.kvk_profielen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest KVK-profielen" ON public.kvk_profielen FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));

CREATE TABLE public.kvk_opvraag_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kvk_nummer text,
  bron text NOT NULL,
  resultaat text NOT NULL,
  http_status int,
  uit_cache boolean NOT NULL DEFAULT false,
  ip_hash text,
  uitgevoerd_door uuid,
  melding text
);
CREATE INDEX kvk_opvraag_log_ip_idx ON public.kvk_opvraag_log (ip_hash, created_at);
GRANT ALL ON public.kvk_opvraag_log TO service_role;
GRANT SELECT ON public.kvk_opvraag_log TO authenticated;
ALTER TABLE public.kvk_opvraag_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisor leest KVK-log" ON public.kvk_opvraag_log FOR SELECT TO authenticated USING (public.is_supervisor_or_admin(auth.uid()));

ALTER TABLE public.ondernemingen
  ADD COLUMN IF NOT EXISTS kvk_naam text,
  ADD COLUMN IF NOT EXISTS kvk_handelsnamen text[],
  ADD COLUMN IF NOT EXISTS kvk_rechtsvorm text,
  ADD COLUMN IF NOT EXISTS kvk_straat text,
  ADD COLUMN IF NOT EXISTS kvk_huisnummer text,
  ADD COLUMN IF NOT EXISTS kvk_postcode text,
  ADD COLUMN IF NOT EXISTS kvk_plaats text,
  ADD COLUMN IF NOT EXISTS kvk_postadres jsonb,
  ADD COLUMN IF NOT EXISTS kvk_adres_afgeschermd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kvk_datum_inschrijving date,
  ADD COLUMN IF NOT EXISTS kvk_datum_aanvang date,
  ADD COLUMN IF NOT EXISTS kvk_sbi jsonb,
  ADD COLUMN IF NOT EXISTS kvk_opgehaald_op timestamptz,
  ADD COLUMN IF NOT EXISTS kvk_bron text,
  ADD COLUMN IF NOT EXISTS kvk_status text,
  ADD COLUMN IF NOT EXISTS kvk_overgenomen_op timestamptz,
  ADD COLUMN IF NOT EXISTS kvk_overgenomen_door uuid;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS kvk_datum_bron text,
  ADD COLUMN IF NOT EXISTS kvk_gegevens jsonb;

-- Admin bevestigt per onderneming dat KVK-naam en/of -adres de eigen gegevens vervangen. Exact wordt niet aangeraakt.
CREATE OR REPLACE FUNCTION public.kvk_gegevens_overnemen(_ids uuid[], _naam boolean, _adres boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); o record; n int := 0; overgeslagen int := 0;
BEGIN
  IF NOT (public.is_team_member(me) AND public.is_admin(me)) THEN RAISE EXCEPTION 'alleen admin'; END IF;
  IF coalesce(array_length(_ids, 1), 0) = 0 OR array_length(_ids, 1) > 1000 THEN RAISE EXCEPTION 'ongeldige selectie'; END IF;
  FOR o IN SELECT * FROM ondernemingen WHERE id = ANY(_ids) AND kvk_opgehaald_op IS NOT NULL LOOP
    IF _naam AND coalesce(o.kvk_naam, '') <> '' AND o.kvk_naam IS DISTINCT FROM o.naam THEN
      INSERT INTO sensitive_audit_log(target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
      VALUES ('ondernemingen', o.id, 'kvk_overgenomen', 'naam', o.naam, o.kvk_naam, me, public.get_user_role_label(me));
      UPDATE ondernemingen SET naam = o.kvk_naam WHERE id = o.id;
    END IF;
    IF _adres AND NOT o.kvk_adres_afgeschermd AND coalesce(o.kvk_postcode, '') <> '' THEN
      INSERT INTO sensitive_audit_log(target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol)
      VALUES ('ondernemingen', o.id, 'kvk_overgenomen', 'adres',
        concat_ws(' ', o.straat, o.huisnummer, o.postcode, o.plaats), concat_ws(' ', o.kvk_straat, o.kvk_huisnummer, o.kvk_postcode, o.kvk_plaats), me, public.get_user_role_label(me));
      UPDATE ondernemingen SET straat = o.kvk_straat, huisnummer = o.kvk_huisnummer, postcode = o.kvk_postcode, plaats = o.kvk_plaats WHERE id = o.id;
    ELSIF _adres THEN overgeslagen := overgeslagen + 1;
    END IF;
    UPDATE ondernemingen SET kvk_overgenomen_op = now(), kvk_overgenomen_door = me WHERE id = o.id;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('verwerkt', n, 'adres_overgeslagen_afgeschermd', overgeslagen);
END $function$;
REVOKE ALL ON FUNCTION public.kvk_gegevens_overnemen(uuid[], boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kvk_gegevens_overnemen(uuid[], boolean, boolean) TO authenticated;