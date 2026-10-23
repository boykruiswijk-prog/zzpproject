UPDATE public.e4_testtokens SET verloopt_op = least(verloopt_op, now()) WHERE verloopt_op > now();
DROP FUNCTION public.e4_token_beoordeel(uuid, uuid);
REVOKE ALL ON public.e4_testtokens FROM PUBLIC, anon, authenticated, service_role;
UPDATE public.cyber_activatie_config SET actief = true, modus = 'publiek' WHERE id;
COMMENT ON TABLE public.e4_testtokens IS 'DEPRECATED: E4-testtoegang afgerond 23-10; alle tokens verlopen, geen rechten.';