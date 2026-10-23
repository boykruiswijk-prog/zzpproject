DO $outer$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_activeren_intern';
 d:=replace(d,'WHERE l.id=r.lead_id AND l.is_test AND p.is_test AND o.is_test','WHERE l.id=r.lead_id AND p.lead_id=l.id AND p.onderneming_id=o.id AND l.onderneming_id=o.id AND l.is_test AND p.is_test AND o.is_test');
 EXECUTE d;
END $outer$;