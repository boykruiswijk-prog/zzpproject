REVOKE ALL ON public.cyber_e4_testbewijs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cyber_e4_testbewijs TO service_role;
REVOKE ALL ON public.cyber_activatie_config FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.cyber_activatie_config TO service_role;