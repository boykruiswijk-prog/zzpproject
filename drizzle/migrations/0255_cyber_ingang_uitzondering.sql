CREATE TABLE public.cyber_ingang_uitzonderingen (
  onderneming_id uuid PRIMARY KEY REFERENCES public.ondernemingen(id),
  vroegst date NOT NULL,
  reden text NOT NULL CHECK (length(btrim(reden)) >= 10),
  besloten_door text NOT NULL,
  aangemaakt_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cyber_ingang_uitzonderingen TO service_role;
ALTER TABLE public.cyber_ingang_uitzonderingen ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.cyber_ingang_uitzonderingen IS 'Per-onderneming uitzondering op vroegste cyberingangsdatum; alleen via besluit, beheer door service_role. Gebruikt door cyber_terugwerkend_vroegst.';

CREATE OR REPLACE FUNCTION public.cyber_terugwerkend_vroegst(_policy_id uuid)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT min(d) FROM (
   SELECT p.start_date AS d FROM public.policies p JOIN public.leads l ON l.id=p.lead_id
   WHERE p.id=_policy_id AND auth.uid() IS NOT NULL
     AND lower((SELECT u.email FROM auth.users u WHERE u.id=auth.uid()))='ellen.baars@zpzaken.nl'
     AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))
     AND l.extra_data ? 'cyber' AND jsonb_typeof(l.extra_data->'cyber')='object'
     AND p.start_date IS NOT NULL
   UNION ALL
   SELECT x.vroegst FROM public.policies p JOIN public.cyber_ingang_uitzonderingen x ON x.onderneming_id=p.onderneming_id
   WHERE p.id=_policy_id AND auth.uid() IS NOT NULL
     AND (public.is_supervisor_or_admin(auth.uid()) OR public.has_role(auth.uid(),'verzekering'))
 ) t;
$function$;