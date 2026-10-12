CREATE OR REPLACE FUNCTION public.guard_datums_alleen_intern() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE kol text; o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW);
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' OR current_user IN ('postgres','supabase_admin') AND coalesce(auth.role(),'') NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'::app_role)) THEN RETURN NEW; END IF;
  FOR kol IN SELECT a.attname FROM pg_attribute a WHERE a.attrelid = TG_RELID AND a.attnum > 0 AND NOT a.attisdropped AND a.atttypid = 'date'::regtype LOOP
    IF (o -> kol) IS DISTINCT FROM (n -> kol) THEN
      RAISE EXCEPTION 'Datums wijzigen kan alleen intern (supervisor of verzekering)' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_datums_alleen_intern() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_datums_intern ON public.leads;
CREATE TRIGGER trg_guard_datums_intern BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_datums_alleen_intern();
DROP TRIGGER IF EXISTS trg_guard_datums_intern ON public.klant_contracten;
CREATE TRIGGER trg_guard_datums_intern BEFORE UPDATE ON public.klant_contracten FOR EACH ROW EXECUTE FUNCTION public.guard_datums_alleen_intern();
DROP TRIGGER IF EXISTS trg_guard_datums_intern ON public.policies;
CREATE TRIGGER trg_guard_datums_intern BEFORE UPDATE ON public.policies FOR EACH ROW EXECUTE FUNCTION public.guard_datums_alleen_intern();
DROP TRIGGER IF EXISTS trg_guard_datums_intern ON public.bav_aanmeldingen;
CREATE TRIGGER trg_guard_datums_intern BEFORE UPDATE ON public.bav_aanmeldingen FOR EACH ROW EXECUTE FUNCTION public.guard_datums_alleen_intern();