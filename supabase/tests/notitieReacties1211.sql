-- Databasetest reacties op notities (12-11-2026). Draait in één DO-blok dat eindigt met RAISE,
-- zodat alles wordt teruggedraaid en er geen testdata achterblijft. Verwacht: 'ALLES OK, rollback'.
DO $$
DECLARE r1 uuid; r2 uuid; p uuid; ok_del boolean := false; ln uuid; lr uuid; lead uuid; ok_upd boolean := false;
  hoofd uuid := (SELECT id FROM crm_notities WHERE parent_id IS NULL AND is_test LIMIT 1);
  teamlid uuid := (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1);
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', teamlid, 'role','authenticated','aal','aal2')::text, true);
  r1 := public.crm_reactie_toevoegen(hoofd, 'testreactie 1');
  r2 := public.crm_reactie_toevoegen(r1, 'reactie op reactie');
  SELECT parent_id INTO p FROM crm_notities WHERE id = r2;
  IF p <> hoofd THEN RAISE EXCEPTION 'FOUT een niveau'; END IF;
  PERFORM public.crm_notitie_intrekken(r1, 'test intrekken');
  IF (SELECT intrek_reden FROM crm_notities WHERE id = r1) <> 'test intrekken' THEN RAISE EXCEPTION 'FOUT intrekken'; END IF;
  BEGIN UPDATE crm_notities SET parent_id = NULL WHERE id = r1; EXCEPTION WHEN others THEN ok_upd := true; END;
  IF NOT ok_upd THEN RAISE EXCEPTION 'FOUT parent veranderbaar'; END IF;
  SELECT lead_id INTO lead FROM lead_notes LIMIT 1;
  INSERT INTO lead_notes(lead_id, user_id, content) VALUES (lead, teamlid, 'hoofd') RETURNING id INTO ln;
  INSERT INTO lead_notes(lead_id, user_id, content, parent_id) VALUES (lead, teamlid, 'reactie', ln) RETURNING id INTO lr;
  BEGIN DELETE FROM lead_notes WHERE id = lr; EXCEPTION WHEN others THEN ok_del := true; END;
  IF NOT ok_del THEN RAISE EXCEPTION 'FOUT reactie verwijderbaar'; END IF;
  PERFORM public.lead_notitie_intrekken(lr, 'test intrekken');
  RAISE EXCEPTION 'ALLES OK, rollback';
END $$;
