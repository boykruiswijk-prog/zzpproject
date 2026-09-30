DROP TRIGGER IF EXISTS update_exact_config_updated_at ON public.exact_config;
CREATE TRIGGER update_exact_config_updated_at
  BEFORE UPDATE ON public.exact_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();