DO $outer$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='cyber_toevoegen_activeren_intern';
 d:=replace(d,'ELSIF r.is_test OR r.status<>''akkoord_wacht_op_activatie'' OR r.beoordeeld_door IS NULL THEN','ELSIF r.is_test OR (r.geactiveerd_op IS NULL AND r.status<>''akkoord_wacht_op_activatie'') OR r.beoordeeld_door IS NULL THEN');
 d:=replace(d,'IF true IS NULL OR _notitie IS NULL','IF _notitie IS NULL');
 EXECUTE d;
END $outer$;