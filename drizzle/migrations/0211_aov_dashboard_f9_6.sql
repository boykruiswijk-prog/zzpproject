ALTER TABLE public.aov_aanmeldingen ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.aov_doorverwijzingen ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 22-10: aantoonbare tests (bron 'test', naam 'Test Aanmelding', test.aov@zpzaken.nl). Markeren, niets verwijderen.
UPDATE public.aov_aanmeldingen SET is_test = true WHERE bron = 'test' AND email = 'test.aov@zpzaken.nl' AND created_at::date = '2026-10-22';
UPDATE public.aov_doorverwijzingen SET is_test = true WHERE bron = 'test' AND created_at::date = '2026-10-22' AND user_id IS NULL;

CREATE OR REPLACE FUNCTION public.aov_team_lezen() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(auth.jwt()->>'aal','') = 'aal2' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'verzekering'));
$$;
REVOKE ALL ON FUNCTION public.aov_team_lezen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aov_team_lezen() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aov_aanmeldingen_overzicht()
RETURNS TABLE(id uuid, created_at timestamptz, naam text, email text, telefoon text, doel text, bron text, user_id uuid, status text, notitie text, behandeld_op timestamptz, lead_id uuid, lead_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.id, a.created_at, a.naam, a.email, a.telefoon, a.doel, a.bron, a.user_id, a.status, a.notitie, a.behandeld_op, l.id, l.status::text
 FROM public.aov_aanmeldingen a
 LEFT JOIN LATERAL (SELECT x.id, x.status FROM public.leads x WHERE lower(x.email) = lower(a.email) AND coalesce(x.is_test,false) = false ORDER BY (x.status = 'klant') DESC, x.created_at DESC LIMIT 1) l ON true
 WHERE public.aov_team_lezen() AND NOT a.is_test
 ORDER BY a.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.aov_doorverwijzingen_overzicht() RETURNS TABLE(id uuid,created_at timestamptz,klik_id uuid,bron text,doel text,user_id uuid,klant_ref text,klant_naam text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,a.created_at,a.klik_id,a.bron,a.doel,a.user_id,a.klant_ref,p.full_name FROM public.aov_doorverwijzingen a LEFT JOIN public.profiles p ON p.id=a.user_id WHERE public.aov_team_lezen() AND NOT a.is_test ORDER BY a.created_at DESC;
$$;

CREATE FUNCTION public.aov_dashboard_lijst()
RETURNS TABLE(id uuid, created_at timestamptz, naam text, email text, telefoon text, doorgeklikt boolean, ingelogde_klant boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.aov_team_lezen() THEN RAISE EXCEPTION 'geen_toegang' USING ERRCODE = '42501'; END IF;
 RETURN QUERY SELECT a.id, a.created_at, a.naam, a.email, a.telefoon,
  EXISTS (SELECT 1 FROM public.aov_doorverwijzingen d WHERE d.klik_id = a.id), a.user_id IS NOT NULL
 FROM public.aov_aanmeldingen a WHERE NOT a.is_test ORDER BY a.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.aov_dashboard_lijst() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aov_dashboard_lijst() TO authenticated, service_role;