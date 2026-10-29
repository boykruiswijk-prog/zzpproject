DO $$
DECLARE d text := pg_get_functiondef('public.mijn_acties_vandaag_basis(boolean)'::regprocedure); n text;
BEGIN
 n := replace(d, 'AND l.vlag IS NOT NULL AND l.vlag_datum IS NOT NULL AND l.vlag_datum <= vandaag', 'AND l.status NOT IN (''afgerond'',''klant_geworden'',''geen_interesse'',''vraag_beantwoord'') AND l.vlag IS NOT NULL AND l.vlag_datum IS NOT NULL AND l.vlag_datum <= vandaag');
 IF n = d THEN RAISE EXCEPTION 'Opvolgselectie niet gevonden'; END IF;
 EXECUTE n;
END $$;