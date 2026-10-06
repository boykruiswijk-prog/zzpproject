ALTER TABLE public.crm_taken DROP CONSTRAINT crm_taken_soort_check;
ALTER TABLE public.crm_taken ADD CONSTRAINT crm_taken_soort_check CHECK (soort IN ('exact_aanpassen','nieuwe_aanvraag_nodig'));
ALTER TABLE public.crm_taken ADD COLUMN IF NOT EXISTS team text;
COMMENT ON COLUMN public.crm_taken.team IS 'Team waaraan de taak is toegewezen (bijv. verzekering); NULL = facturatie (Roxy).';

CREATE OR REPLACE FUNCTION public.guard_kvk_onveranderbaar() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.kvk_override', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'ondernemingen' THEN
    IF OLD.kvk IS NOT NULL AND NEW.kvk IS DISTINCT FROM OLD.kvk THEN
      RAISE EXCEPTION 'KvK-nummer is niet wijzigbaar. Bij een nieuw KvK-nummer is een nieuwe aanvraag en een nieuwe polis nodig (gebruik Ondernemingswijziging).';
    END IF;
  ELSIF TG_TABLE_NAME = 'bav_aanmeldingen' THEN
    IF NEW.kvk_nummer IS DISTINCT FROM OLD.kvk_nummer AND OLD.lead_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.policies WHERE lead_id = OLD.lead_id) THEN
      RAISE EXCEPTION 'KvK-nummer is niet wijzigbaar. Bij een nieuw KvK-nummer is een nieuwe aanvraag en een nieuwe polis nodig (gebruik Ondernemingswijziging).';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_kvk_onveranderbaar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_kvk_ondernemingen BEFORE UPDATE OF kvk ON public.ondernemingen FOR EACH ROW EXECUTE FUNCTION public.guard_kvk_onveranderbaar();
CREATE TRIGGER trg_guard_kvk_bav_aanmeldingen BEFORE UPDATE OF kvk_nummer ON public.bav_aanmeldingen FOR EACH ROW EXECUTE FUNCTION public.guard_kvk_onveranderbaar();

DO $do$
DECLARE d text; n text;
BEGIN
  -- crm_gegevens_wijzigen: kvk alleen eenmalig invullen door supervisor/admin
  d := pg_get_functiondef('public.crm_gegevens_wijzigen'::regproc);
  n := replace(d, $x$    IF k = 'kvk' AND v IS NOT NULL AND v !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'KvK moet 8 cijfers zijn'; END IF;$x$,
$x$    IF k = 'kvk' AND v IS DISTINCT FROM o.kvk THEN
      IF o.kvk IS NOT NULL THEN RAISE EXCEPTION 'KvK-nummer is niet wijzigbaar. Bij een nieuw KvK-nummer is een nieuwe aanvraag en een nieuwe polis nodig (gebruik Ondernemingswijziging).'; END IF;
      IF NOT public.is_supervisor_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Een leeg KvK-nummer invullen kan alleen een supervisor of admin'; END IF;
    END IF;
    IF k = 'kvk' AND v IS NOT NULL AND v !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'KvK moet 8 cijfers zijn'; END IF;$x$);
  IF n = d THEN RAISE EXCEPTION 'patch crm_gegevens_wijzigen mislukt'; END IF;
  EXECUTE n;

  -- crm_ondernemingswijziging: taak nieuwe aanvraag nodig
  d := pg_get_functiondef('public.crm_ondernemingswijziging'::regproc);
  n := replace(d, $x$  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar,$x$,
$x$  DECLARE v_nieuw public.ondernemingen; v_had boolean; BEGIN
    SELECT * INTO v_nieuw FROM public.ondernemingen WHERE id = v_naar;
    v_had := EXISTS (SELECT 1 FROM public.klant_contracten WHERE onderneming_id = _van) OR EXISTS (SELECT 1 FROM public.policies WHERE onderneming_id = _van);
    IF v_nieuw.kvk IS DISTINCT FROM o.kvk OR v_had THEN
      INSERT INTO public.crm_taken (soort, team, onderneming_id, omschrijving, details, aangemaakt_door, aangemaakt_door_naam, is_test)
      VALUES ('nieuwe_aanvraag_nodig', 'verzekering', v_naar,
        'Nieuwe aanvraag nodig: ' || o.naam || ' gaat verder als ' || v_nieuw.naam || ' (KvK ' || coalesce(v_nieuw.kvk,'onbekend') || ') per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '. Polis kan niet worden overgezet.',
        jsonb_build_object('opvolging_id', v_opv, 'van_onderneming_id', _van, 'oude_kvk', o.kvk, 'nieuwe_kvk', v_nieuw.kvk),
        auth.uid(), coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()),'teamlid'), o.is_test OR v_nieuw.is_test);
    END IF;
  END;
  RETURN jsonb_build_object('ok', true, 'naar_onderneming_id', v_naar,$x$);
  IF n = d THEN RAISE EXCEPTION 'patch crm_ondernemingswijziging mislukt'; END IF;
  EXECUTE n;

  -- mijn_acties_vandaag: facturatie alleen exact-taken, nieuwe categorie nieuwe_aanvraag
  d := pg_get_functiondef('public.mijn_acties_vandaag'::regproc);
  n := replace(d, $x$       WHERE t.status = 'open' AND (_toon_test OR NOT t.is_test)$x$, $x$       WHERE t.status = 'open' AND t.soort = 'exact_aanpassen' AND (_toon_test OR NOT t.is_test)$x$);
  n := replace(n, $x$  r := r || jsonb_build_object('facturatie', c);$x$,
$x$  r := r || jsonb_build_object('facturatie', c);
  WITH b AS (
    SELECT t.onderneming_id AS id, coalesce(o.naam,'') AS naam, o.naam AS bedrijfsnaam, t.aangemaakt_op AS sinds, t.omschrijving AS reden, 'taak'::text AS bron
      FROM crm_taken t LEFT JOIN ondernemingen o ON o.id = t.onderneming_id
     WHERE t.status = 'open' AND t.soort = 'nieuwe_aanvraag_nodig' AND (_toon_test OR NOT t.is_test))
  SELECT jsonb_build_object('aantal', (SELECT count(*) FROM b),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'bedrijfsnaam', bedrijfsnaam, 'sinds', sinds, 'reden', reden, 'bron', bron) ORDER BY sinds) FROM (SELECT * FROM b ORDER BY sinds LIMIT 10) s), '[]'::jsonb)) INTO c;
  r := r || jsonb_build_object('nieuwe_aanvraag', c);$x$);
  IF n = d OR position('nieuwe_aanvraag_nodig' in n) = 0 OR position($x$t.soort = 'exact_aanpassen'$x$ in n) = 0 THEN RAISE EXCEPTION 'patch mijn_acties_vandaag mislukt'; END IF;
  EXECUTE n;

  -- menu_tellers
  d := pg_get_functiondef('public.menu_tellers'::regproc);
  n := replace(d, $x$(SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open')$x$, $x$(SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'exact_aanpassen')$x$);
  n := replace(n, $x$'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')),$x$,
    $x$'klanten', (SELECT count(*) FROM factuur_credit_planning WHERE NOT is_test AND status IN ('geblokkeerd','fout')) + (SELECT count(*) FROM crm_taken WHERE NOT is_test AND status = 'open' AND soort = 'nieuwe_aanvraag_nodig'),$x$);
  IF position($x$soort = 'nieuwe_aanvraag_nodig'$x$ in n) = 0 OR position($x$soort = 'exact_aanpassen'$x$ in n) = 0 THEN RAISE EXCEPTION 'patch menu_tellers mislukt'; END IF;
  EXECUTE n;
END $do$;