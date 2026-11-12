-- Databasetest contract_wijzig_ingangsdatum (besluit Boy 12-11-2026). Alles in één DO-blok dat eindigt met een
-- exception: de transactie wordt altijd teruggedraaid, er blijft geen testdata achter.
DO $$
DECLARE o uuid; k uuid; p uuid; k2 uuid; v jsonb; c record; pol record; fout text; uit text := '';
  d0 date := (now() AT TIME ZONE 'Europe/Amsterdam')::date + 20; d1 date := d0 - 1;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','5d591f12-d010-4640-ae68-2b4f58953320','role','authenticated','aal','aal2')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '5d591f12-d010-4640-ae68-2b4f58953320', true);
  INSERT INTO public.ondernemingen (naam, is_test) VALUES ('TEST ingangsdatum BV', true) RETURNING id INTO o;
  INSERT INTO public.klant_contracten (onderneming_id, bron, bron_rij, type, itemcode, product, cyclus, bedrag_per_periode, begin_datum, factureren_vanaf, volgende_factuurdatum, gefactureerd_tm, is_test)
    VALUES (o, 'test', 1, 'verzekering', '100M', 'bav_avb', 'maand', 55, d0, d0, d0, d0 - 1, true) RETURNING id INTO k;
  INSERT INTO public.policies (certificate_number, certificate_holder, insured_name, start_date, profession, onderneming_id, is_test)
    VALUES ('ZPBAVTEST9901', 'TEST ingangsdatum BV', 'TEST', d0, 'Test', o, true) RETURNING id INTO p;

  -- reden te kort
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k, d1, 'kort'); uit := uit || 'FAIL reden; '; EXCEPTION WHEN others THEN uit := uit || 'ok reden_kort[' || SQLERRM || ']; '; END;
  -- gelijke datum
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k, d0, 'klant wil eerder starten'); uit := uit || 'FAIL gelijk; '; EXCEPTION WHEN others THEN uit := uit || 'ok gelijk[' || SQLERRM || ']; '; END;
  -- te ver in de toekomst / verleden
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k, d0 + 400, 'klant wil eerder starten'); uit := uit || 'FAIL toekomst; '; EXCEPTION WHEN others THEN uit := uit || 'ok toekomst; '; END;
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k, d0 - 100, 'klant wil eerder starten'); uit := uit || 'FAIL verleden; '; EXCEPTION WHEN others THEN uit := uit || 'ok verleden; '; END;

  -- geslaagde wijziging
  v := public.contract_wijzig_ingangsdatum(k, d1, 'Klant wil een dag eerder starten (test)');
  SELECT * INTO c FROM public.klant_contracten WHERE id = k;
  SELECT * INTO pol FROM public.policies WHERE id = p;
  IF c.begin_datum = d1 AND c.factureren_vanaf = d1 AND c.volgende_factuurdatum = d1 AND c.gefactureerd_tm = d1 - 1
     AND c.gefactureerd_tm_bron = 'ingangsdatum_gewijzigd' AND pol.start_date = d1 AND pol.certificate_number = 'ZPBAVTEST9901'
     AND EXISTS (SELECT 1 FROM public.sensitive_audit_log WHERE target_id = k AND actie = 'ingangsdatum_gewijzigd' AND oude_waarde = d0::text AND nieuwe_waarde = d1::text)
     AND EXISTS (SELECT 1 FROM public.crm_notities WHERE onderneming_id = o AND tekst LIKE 'Ingangsdatum gewijzigd van%')
  THEN uit := uit || 'ok velden+polis+audit+notitie; ' ELSE uit := uit || 'FAIL velden ' || row_to_json(c)::text || ' polis ' || pol.start_date || '; '; END IF;

  -- blokkade: factuur_planning-regel
  INSERT INTO public.factuur_planning (klant_contract_id, periode_start, periode_eind, aantal, bedrag_per_periode, bedrag, exact_account_id, exact_item_id, planningssleutel, status, is_test)
    VALUES (k, d1, d1 + 30, 1, 55, 55, 'test', 'test', 'ZPF-7E579901', 'verwerkt', true);
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k, d1 - 1, 'klant wil eerder starten'); uit := uit || 'FAIL planning; '; EXCEPTION WHEN others THEN uit := uit || 'ok planning[' || SQLERRM || ']; '; END;

  -- blokkade: beëindigd contract
  INSERT INTO public.klant_contracten (onderneming_id, bron, bron_rij, type, itemcode, product, cyclus, begin_datum, eind_datum, is_test)
    VALUES (o, 'test', 2, 'verzekering', '100M', 'bav_avb', 'maand', d0, d0 + 60, true) RETURNING id INTO k2;
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k2, d1, 'klant wil eerder starten'); uit := uit || 'FAIL beeindigd; '; EXCEPTION WHEN others THEN uit := uit || 'ok beeindigd; '; END;

  -- zonder 2FA
  PERFORM set_config('request.jwt.claims', json_build_object('sub','5d591f12-d010-4640-ae68-2b4f58953320','role','authenticated','aal','aal1')::text, true);
  BEGIN PERFORM public.contract_wijzig_ingangsdatum(k2, d1, 'klant wil eerder starten'); uit := uit || 'FAIL aal1; '; EXCEPTION WHEN others THEN uit := uit || 'ok aal1[' || SQLERRM || ']; '; END;

  RAISE EXCEPTION 'TESTUITKOMST (teruggedraaid): %', uit;
END $$;
