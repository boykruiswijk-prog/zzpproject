CREATE OR REPLACE FUNCTION public.zet_activiteit_is_test()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads WHERE id = NEW.lead_id AND is_test) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.zet_activiteit_is_test() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_activiteit_is_test BEFORE INSERT ON public.activiteiten_log
FOR EACH ROW EXECUTE FUNCTION public.zet_activiteit_is_test();