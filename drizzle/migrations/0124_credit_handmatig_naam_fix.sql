DO $do$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.credit_handmatig_afgehandeld(uuid,text)'::regprocedure);
  def := replace(def, 'coalesce(p.full_name, p.email)', 'p.full_name');
  EXECUTE def;
END $do$;