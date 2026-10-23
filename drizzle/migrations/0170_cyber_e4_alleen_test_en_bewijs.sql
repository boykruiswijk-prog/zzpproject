ALTER TABLE public.cyber_activatie_config ADD COLUMN modus text NOT NULL DEFAULT 'uit' CHECK (modus IN ('uit','alleen_test','publiek'));
CREATE TABLE public.cyber_e4_testbewijs (
 verzoek_id uuid PRIMARY KEY REFERENCES public.cyber_toevoeg_verzoeken(id),
 label text NOT NULL CHECK(label IN ('TEST E4 jaar','TEST E4 maand')),
 is_test boolean NOT NULL DEFAULT true CHECK(is_test),
 vastgelegd_op timestamptz NOT NULL DEFAULT now(),
 bav_voor jsonb NOT NULL, planning_voor jsonb NOT NULL, polis_voor jsonb NOT NULL,
 telling_voor jsonb NOT NULL,
 uitkomst jsonb, gecontroleerd_op timestamptz
);
GRANT ALL ON public.cyber_e4_testbewijs TO service_role;
ALTER TABLE public.cyber_e4_testbewijs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.guard_cyber_e4_bewijs() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.verzoek_id,NEW.label,NEW.is_test,NEW.vastgelegd_op,NEW.bav_voor,NEW.planning_voor,NEW.polis_voor,NEW.telling_voor) IS DISTINCT FROM (OLD.verzoek_id,OLD.label,OLD.is_test,OLD.vastgelegd_op,OLD.bav_voor,OLD.planning_voor,OLD.polis_voor,OLD.telling_voor) THEN RAISE EXCEPTION 'E4 voorsnapshot is onveranderlijk'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cyber_toevoeg_verzoeken r JOIN public.policies p ON p.id=r.policy_id JOIN public.leads l ON l.id=r.lead_id JOIN public.ondernemingen o ON o.id=r.onderneming_id WHERE r.id=NEW.verzoek_id AND r.is_test AND p.is_test AND l.is_test AND o.is_test AND lower(l.email) LIKE '%@zpzaken.nl' AND p.onderneming_id=o.id AND p.lead_id=l.id) THEN RAISE EXCEPTION 'Volledige testkoppeling vereist'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_cyber_e4_bewijs() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_cyber_e4_bewijs BEFORE INSERT OR UPDATE ON public.cyber_e4_testbewijs FOR EACH ROW EXECUTE FUNCTION public.guard_cyber_e4_bewijs();
DO $migration$
DECLARE d text; n text;
BEGIN
 SELECT pg_get_functiondef('public.cyber_toevoegen_beoordelen(uuid,boolean,text)'::regprocedure) INTO d;
 n:=replace(d, 'IF r.id IS NULL THEN RAISE EXCEPTION ''Verzoek niet gevonden''; END IF;', 'IF r.id IS NULL THEN RAISE EXCEPTION ''Verzoek niet gevonden''; END IF;
 IF coalesce((SELECT modus FROM public.cyber_activatie_config WHERE id),''uit'')=''alleen_test'' THEN
  IF NOT r.is_test OR NOT EXISTS(SELECT 1 FROM public.cyber_e4_testbewijs b WHERE b.verzoek_id=r.id) THEN RAISE EXCEPTION ''Alleen gemarkeerde E4-testverzoeken met voorsnapshot toegestaan'' USING ERRCODE=''42501''; END IF;
 ELSIF NOT coalesce((SELECT actief FROM public.cyber_activatie_config WHERE id),false) AND NOT r.is_test THEN RAISE EXCEPTION ''Cyberactivatie is nog niet vrijgegeven'' USING ERRCODE=''42501''; END IF;');
 IF n=d THEN RAISE EXCEPTION 'Beoordelingsgarde niet gevonden'; END IF; EXECUTE n;
 SELECT pg_get_functiondef('public.cyber_toevoegen_activeren_intern(uuid,text,boolean)'::regprocedure) INTO d;
 n:=replace(d, 'AND l.onderneming_id=o.id ', '');
 n:=replace(n, 'IF _test THEN', 'IF coalesce((SELECT modus FROM public.cyber_activatie_config WHERE id),''uit'')=''alleen_test'' THEN
  IF NOT _test OR NOT r.is_test OR r.beoordeeld_door IS NULL OR r.beoordeeld_op IS NULL OR NOT EXISTS(SELECT 1 FROM public.cyber_e4_testbewijs e WHERE e.verzoek_id=r.id) THEN RAISE EXCEPTION ''Menselijke MFA-beoordeling en E4-testvoorsnapshot vereist'' USING ERRCODE=''42501''; END IF;
 END IF;
 IF _test THEN');
 n:=replace(n, 'v_cyclus:=b.cyclus;', 'IF _test AND b.is_test IS DISTINCT FROM true THEN RAISE EXCEPTION ''Test-BAV vereist''; END IF; v_cyclus:=b.cyclus;');
 IF n=d OR position('l.onderneming_id' IN n)>0 THEN RAISE EXCEPTION 'Testkern niet aangepast'; END IF; EXECUTE n;
END $migration$;
REVOKE ALL ON public.cyber_activatie_config FROM anon,authenticated;
GRANT ALL ON public.cyber_activatie_config TO service_role;
COMMENT ON TABLE public.cyber_e4_testbewijs IS 'Alleen gemarkeerde E4-tests. Onveranderlijke BAV/polis/planning-voorsnapshot; droge planner/mailuitkomst zonder echte verzending of Exact-boeking.';