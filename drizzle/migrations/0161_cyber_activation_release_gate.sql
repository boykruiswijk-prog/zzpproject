CREATE TABLE public.cyber_activatie_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),actief boolean NOT NULL DEFAULT false);
GRANT ALL ON public.cyber_activatie_config TO service_role;
ALTER TABLE public.cyber_activatie_config ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.cyber_activatie_config IS 'Release gate defaults off (also absent row). Enable only after all E4 tests and joint release; service_role only.';
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_beoordelen';
 d:=replace(d,E' IF _akkoord THEN\n  SELECT * INTO p',E' IF _akkoord AND NOT coalesce((SELECT actief FROM public.cyber_activatie_config WHERE id),false) THEN\n  UPDATE public.cyber_toevoeg_verzoeken SET status=''akkoord_wacht_op_activatie'',beoordeling_notitie=btrim(_notitie),beoordeeld_door=auth.uid(),beoordeeld_op=now() WHERE id=r.id;\n  RETURN ''akkoord_wacht_op_activatie'';\n END IF;\n IF _akkoord THEN\n  SELECT * INTO p');
 EXECUTE d;
END $$;