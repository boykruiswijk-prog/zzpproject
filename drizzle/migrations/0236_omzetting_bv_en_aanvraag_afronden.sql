-- A. Omzetten naar BV: zelfde polis, nieuwe versie bij de opvolger.
ALTER TABLE public.policy_versies DROP CONSTRAINT IF EXISTS policy_versies_actie_check;
ALTER TABLE public.policy_versies ADD CONSTRAINT policy_versies_actie_check CHECK (actie = ANY (ARRAY['aangepast','ingetrokken','gemaild','nummer_vervangen','vervangen_door_nieuw','omgezet']));

CREATE OR REPLACE FUNCTION public.polis_omzetten(_policy_id uuid, _naar uuid, _ingangsdatum date, _reden text, _lead_id uuid, _oude_pdf_pad text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); p public.policies; v_van uuid; vo public.ondernemingen; nn public.ondernemingen; v_email text; v_naam text; v_pers int; v_uid uuid;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 10 THEN RAISE EXCEPTION 'geef een toelichting (minimaal 10 tekens)'; END IF;
  IF _ingangsdatum IS NULL THEN RAISE EXCEPTION 'kies de ingangsdatum van de BV'; END IF;
  SELECT * INTO p FROM public.policies WHERE id = _policy_id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'certificaat niet gevonden'; END IF;
  IF p.status <> 'geldig' THEN RAISE EXCEPTION 'certificaat is ingetrokken'; END IF;
  v_van := coalesce(p.onderneming_id, (SELECT l.gekoppeld_onderneming_id FROM public.leads l WHERE l.id = p.lead_id));
  SELECT * INTO vo FROM public.ondernemingen WHERE id = v_van;
  SELECT * INTO nn FROM public.ondernemingen WHERE id = _naar;
  IF vo.id IS NULL THEN RAISE EXCEPTION 'certificaat hangt niet aan een klant'; END IF;
  IF nn.id IS NULL THEN RAISE EXCEPTION 'nieuwe onderneming niet gevonden'; END IF;
  IF nn.id = vo.id THEN RAISE EXCEPTION 'voorganger en opvolger zijn dezelfde onderneming'; END IF;
  IF nn.samengevoegd_naar IS NOT NULL THEN RAISE EXCEPTION 'nieuwe onderneming is samengevoegd; kies de hoofdkaart'; END IF;
  IF nn.is_test IS DISTINCT FROM vo.is_test THEN RAISE EXCEPTION 'test en echt niet door elkaar'; END IF;
  IF public.onderneming_is_partner(vo.id) IS NOT NULL THEN RAISE EXCEPTION 'voorganger komt via partner: BAV-nummer niet overnemen'; END IF;
  IF EXISTS (SELECT 1 FROM public.policies x WHERE x.onderneming_id = nn.id AND x.status = 'geldig' AND x.id <> p.id) THEN
    RAISE EXCEPTION 'de nieuwe onderneming heeft al een geldig certificaat'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = me;
  SELECT nullif(btrim(coalesce(full_name,'')),'') INTO v_naam FROM public.profiles WHERE id = me;

  INSERT INTO public.policy_versies (policy_id, certificate_number, versie, actie, oude_waarden, nieuwe_waarden, oude_pdf_pad, reden, uitgevoerd_door, uitgevoerd_door_email)
  VALUES (p.id, p.certificate_number, p.versie, 'omgezet',
    jsonb_build_object('onderneming_id', vo.id, 'lead_id', p.lead_id, 'certificate_holder', p.certificate_holder, 'insured_name', p.insured_name,
      'start_date', p.start_date, 'issued_date', p.issued_date, 'versie', p.versie, 'status', 'vervangen'),
    jsonb_build_object('onderneming_id', nn.id, 'lead_id', _lead_id, 'certificate_holder', nn.naam, 'insured_name', nn.naam, 'start_date', _ingangsdatum, 'versie', p.versie + 1),
    _oude_pdf_pad, 'Omzetting naar ' || nn.naam || ': ' || btrim(_reden), me, v_email);

  UPDATE public.policies SET onderneming_id = nn.id, lead_id = _lead_id, certificate_holder = nn.naam, insured_name = nn.naam,
    start_date = _ingangsdatum, issued_date = (now() AT TIME ZONE 'Europe/Amsterdam')::date, versie = versie + 1
   WHERE id = p.id;

  INSERT INTO public.onderneming_opvolging (van_onderneming_id, naar_onderneming_id, ingangsdatum, soort, toelichting, vastgelegd_door, is_test, bav_nummer, bav_nummer_herkomst, lead_id)
  VALUES (vo.id, nn.id, _ingangsdatum, 'rechtsvormwijziging', btrim(_reden), me, coalesce(nn.is_test,false), p.certificate_number, 'zp', _lead_id)
  ON CONFLICT (van_onderneming_id, naar_onderneming_id) DO UPDATE SET bav_nummer = EXCLUDED.bav_nummer, ingangsdatum = EXCLUDED.ingangsdatum;

  WITH ins AS (INSERT INTO public.persoon_onderneming (persoon_id, onderneming_id)
    SELECT po.persoon_id, nn.id FROM public.persoon_onderneming po WHERE po.onderneming_id = vo.id
    ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*) INTO v_pers FROM ins;

  IF (SELECT user_id FROM public.policies WHERE id = p.id) IS NULL THEN
    v_uid := public.portal_user_voor_onderneming(nn.id);
    IF v_uid IS NOT NULL THEN UPDATE public.policies SET user_id = v_uid WHERE id = p.id; END IF;
  END IF;

  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_email, uitgevoerd_door_rol, details)
  VALUES ('policies', p.id, 'polis_omgezet', 'onderneming_id', vo.id::text, nn.id::text, me, v_email, 'team',
    jsonb_build_object('certificaatnummer', p.certificate_number, 'van', vo.naam, 'naar', nn.naam, 'ingangsdatum', _ingangsdatum, 'reden', btrim(_reden), 'lead_id', _lead_id, 'personen_gekoppeld', v_pers, 'oude_pdf_pad', _oude_pdf_pad));
  INSERT INTO public.crm_notities (onderneming_id, soort, is_test, tekst, aangemaakt_door, aangemaakt_door_naam, details)
  VALUES (vo.id, 'overig', coalesce(vo.is_test,false), 'Omgezet naar ' || nn.naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '; certificaat ' || p.certificate_number || ' staat nu op de nieuwe onderneming (oude versie bewaard).', me, coalesce(v_naam,'team'), jsonb_build_object('soort','omzetting','policy_id',p.id)),
         (nn.id, 'overig', coalesce(nn.is_test,false), 'Omzetting van ' || vo.naam || ' per ' || to_char(_ingangsdatum,'DD-MM-YYYY') || '; certificaat ' || p.certificate_number || ' overgenomen. Contracten en facturatie zijn niet gewijzigd.', me, coalesce(v_naam,'team'), jsonb_build_object('soort','omzetting','policy_id',p.id));
  RETURN jsonb_build_object('ok', true, 'certificaatnummer', p.certificate_number, 'versie', p.versie + 1, 'personen_gekoppeld', v_pers);
END $function$;
REVOKE ALL ON FUNCTION public.polis_omzetten(uuid, uuid, date, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.polis_omzetten(uuid, uuid, date, text, uuid, text) TO authenticated;

-- B. Herkenning: zelfde bedrijfsnaam zonder rechtsvorm telt als signaal (Volpracht vs Volpracht B.V.).
CREATE OR REPLACE FUNCTION public.bedrijfsnaam_kern(_naam text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(lower(coalesce(_naam,'')), '\m(b\.?\s?v\.?|v\.?o\.?f\.?|eenmanszaak|holding|c\.?v\.?)(?=\s|$)', ' ', 'g'), '[^a-z0-9]+', '', 'g')), '')
$$;
DO $do$
DECLARE src text; anker text := E'    UNION ALL\n    SELECT o.id, ''zelfde IBAN''';
BEGIN
  src := pg_get_functiondef('public.omzetting_kandidaten'::regproc);
  IF position('zelfde bedrijfsnaam' in src) = 0 THEN
    IF position(anker in src) = 0 THEN RAISE EXCEPTION 'anker niet gevonden in omzetting_kandidaten'; END IF;
    src := replace(src, anker, E'    UNION ALL\n    SELECT o.id, ''zelfde bedrijfsnaam ('' || o.naam || '')'', 2 FROM public.ondernemingen o\n     WHERE length(coalesce(public.bedrijfsnaam_kern(l.bedrijfsnaam),'''')) >= 4 AND public.bedrijfsnaam_kern(o.naam) = public.bedrijfsnaam_kern(l.bedrijfsnaam) AND o.samengevoegd_naar IS NULL AND o.is_test = l.is_test\n' || anker);
    EXECUTE src;
  END IF;
END $do$;

-- C. Aanvraag pas afgerond na certificaat verstuurd of expliciete handmatige keuze.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS aanvraag_afgerond_op timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS aanvraag_afgerond_reden text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS aanvraag_afgerond_door uuid;
GRANT SELECT (aanvraag_afgerond_op, aanvraag_afgerond_reden, aanvraag_afgerond_door) ON public.leads TO authenticated;

UPDATE public.leads l SET aanvraag_afgerond_op = x.op, aanvraag_afgerond_reden = 'certificaat verstuurd'
  FROM (SELECT p.lead_id, min(v.created_at) op FROM public.policies p JOIN public.policy_versies v ON v.policy_id = p.id AND v.actie = 'gemaild' WHERE p.lead_id IS NOT NULL GROUP BY 1
        UNION ALL SELECT lead_id, min(created_at) FROM public.lead_notification_log WHERE lead_type = 'certificaat' AND status = 'sent' AND lead_id IS NOT NULL GROUP BY 1) x
 WHERE x.lead_id = l.id AND l.aanvraag_afgerond_op IS NULL;

CREATE OR REPLACE FUNCTION public.aanvraag_afronden_bij_certificaatmail() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_lead uuid;
BEGIN
  IF TG_TABLE_NAME = 'policy_versies' THEN
    IF NEW.actie <> 'gemaild' THEN RETURN NEW; END IF;
    SELECT lead_id INTO v_lead FROM public.policies WHERE id = NEW.policy_id;
  ELSE
    IF NEW.lead_type <> 'certificaat' OR NEW.status <> 'sent' THEN RETURN NEW; END IF;
    v_lead := NEW.lead_id;
  END IF;
  IF v_lead IS NOT NULL THEN
    UPDATE public.leads SET aanvraag_afgerond_op = now(), aanvraag_afgerond_reden = 'certificaat verstuurd' WHERE id = v_lead AND aanvraag_afgerond_op IS NULL;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW; -- nooit de mail-registratie laten falen
END $$;
DROP TRIGGER IF EXISTS trg_aanvraag_afronden_versie ON public.policy_versies;
CREATE TRIGGER trg_aanvraag_afronden_versie AFTER INSERT ON public.policy_versies FOR EACH ROW EXECUTE FUNCTION public.aanvraag_afronden_bij_certificaatmail();
DROP TRIGGER IF EXISTS trg_aanvraag_afronden_mail ON public.lead_notification_log;
CREATE TRIGGER trg_aanvraag_afronden_mail AFTER INSERT OR UPDATE OF status ON public.lead_notification_log FOR EACH ROW EXECUTE FUNCTION public.aanvraag_afronden_bij_certificaatmail();

CREATE OR REPLACE FUNCTION public.aanvraag_handmatig_afronden(_lead_id uuid, _reden text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); l public.leads;
BEGIN
  IF me IS NULL OR coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.is_supervisor_or_admin(me) OR public.has_role(me,'verzekering')) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  IF length(btrim(coalesce(_reden,''))) < 10 THEN RAISE EXCEPTION 'geef een reden (minimaal 10 tekens)'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF l.id IS NULL OR l.type <> 'verzekering_aanvraag' THEN RAISE EXCEPTION 'aanvraag niet gevonden'; END IF;
  IF l.aanvraag_afgerond_op IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'al_afgerond', true); END IF;
  UPDATE public.leads SET aanvraag_afgerond_op = now(), aanvraag_afgerond_reden = 'handmatig: ' || btrim(_reden), aanvraag_afgerond_door = me WHERE id = l.id;
  INSERT INTO public.sensitive_audit_log (target_table, target_id, actie, veld, oude_waarde, nieuwe_waarde, uitgevoerd_door, uitgevoerd_door_rol, details)
  VALUES ('leads', l.id, 'aanvraag_handmatig_afgerond', 'aanvraag_afgerond_op', NULL, now()::text, me, 'team', jsonb_build_object('reden', btrim(_reden)));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.aanvraag_handmatig_afronden(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aanvraag_handmatig_afronden(uuid, text) TO authenticated;

-- Stappen van een aanvraag (alleen lezen) met wie/wat ze afrondt.
CREATE OR REPLACE FUNCTION public.aanvraag_stappen(_lead_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l public.leads; v_ond uuid; v_pol uuid; r jsonb;
BEGIN
  IF NOT public.is_team_member(auth.uid()) THEN RAISE EXCEPTION 'geen toegang'; END IF;
  SELECT * INTO l FROM public.leads WHERE id = _lead_id;
  IF l.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_ond := coalesce(l.gekoppeld_onderneming_id, (SELECT o.id FROM public.ondernemingen o WHERE l.kvk_nummer IS NOT NULL AND regexp_replace(coalesce(o.kvk,''),'\D','','g') = regexp_replace(l.kvk_nummer,'\D','','g') AND o.samengevoegd_naar IS NULL ORDER BY o.created_at LIMIT 1));
  SELECT id INTO v_pol FROM public.policies WHERE lead_id = l.id AND status = 'geldig' ORDER BY created_at DESC LIMIT 1;
  r := jsonb_build_array(
    jsonb_build_object('sleutel','beoordeeld','label','Aanvraag beoordeeld','automatisch','team','klaar', l.status NOT IN ('nieuw','nieuw_te_beoordelen')),
    jsonb_build_object('sleutel','sepa','label','SEPA-machtiging getekend','automatisch','klant, bij de aanvraag','klaar', EXISTS (SELECT 1 FROM public.sepa_machtiging_bewijs s WHERE s.bron_tabel = 'leads' AND s.bron_id = l.id)),
    jsonb_build_object('sleutel','activatie','label','Geactiveerd','automatisch','team (knop activeren)','klaar', l.geactiveerd_op IS NOT NULL, 'op', l.geactiveerd_op),
    jsonb_build_object('sleutel','exact_relatie','label','Exact-relatie','automatisch','automatisch bij activatie','klaar', l.exact_account_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.ondernemingen o WHERE o.id = v_ond AND o.exact_account_id IS NOT NULL)),
    jsonb_build_object('sleutel','contract','label','Contract in klantenbestand','automatisch','automatisch bij activatie','klaar', EXISTS (SELECT 1 FROM public.klant_contracten k WHERE k.onderneming_id = v_ond AND k.status IN ('actief','loopt_af','einddatum_controle'))),
    jsonb_build_object('sleutel','factuur','label','Eerste factuur (concept in Exact)','automatisch','automatisch bij activatie of op de ingangsdatum','klaar', l.exact_invoice_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.factuur_planning fp JOIN public.klant_contracten k ON k.id = fp.klant_contract_id WHERE k.onderneming_id = v_ond)),
    jsonb_build_object('sleutel','certificaat','label','Certificaat gemaakt','automatisch','team','klaar', v_pol IS NOT NULL),
    jsonb_build_object('sleutel','mijn_zp','label','Uitnodiging Mijn ZP','automatisch','automatisch bij het maken van het certificaat','klaar', EXISTS (SELECT 1 FROM public.lead_notification_log n WHERE n.lead_id = l.id AND n.lead_type = 'portal_invite' AND n.status = 'sent') OR EXISTS (SELECT 1 FROM public.policies p WHERE p.lead_id = l.id AND p.user_id IS NOT NULL)),
    jsonb_build_object('sleutel','verstuurd','label','Certificaat verstuurd','automatisch','team (laatste stap, rondt de aanvraag af)','klaar', l.aanvraag_afgerond_op IS NOT NULL AND coalesce(l.aanvraag_afgerond_reden,'') = 'certificaat verstuurd')
  );
  RETURN jsonb_build_object('stappen', r, 'afgerond_op', l.aanvraag_afgerond_op, 'afgerond_reden', l.aanvraag_afgerond_reden);
END $$;
REVOKE ALL ON FUNCTION public.aanvraag_stappen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aanvraag_stappen(uuid) TO authenticated;

-- Menuteller Aanvragen: ook geactiveerde aanvragen waarvan het certificaat nog niet verstuurd is.
DO $do$
DECLARE src text; anker text := '''aanvragen'', public.tel_cyber_aanvragen_open(false) + ';
BEGIN
  src := pg_get_functiondef('public.menu_tellers'::regproc);
  IF position('aanvraag_afgerond_op' in src) = 0 THEN
    IF position(anker in src) = 0 THEN RAISE EXCEPTION 'anker niet gevonden in menu_tellers'; END IF;
    src := replace(src, anker, anker || '(SELECT count(*) FROM leads WHERE NOT is_test AND type = ''verzekering_aanvraag'' AND status = ''actief'' AND aanvraag_afgerond_op IS NULL AND NOT public.lead_vlag_geparkeerd(vlag, vlag_datum, (now() AT TIME ZONE ''Europe/Amsterdam'')::date)) + ');
    EXECUTE src;
  END IF;
END $do$;