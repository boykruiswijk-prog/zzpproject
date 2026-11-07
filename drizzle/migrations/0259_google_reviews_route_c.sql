CREATE TABLE public.google_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), naam text NOT NULL, sterren integer NOT NULL CHECK(sterren BETWEEN 1 AND 5), tekst text NOT NULL, review_datum date, google_url text NOT NULL, verborgen boolean NOT NULL DEFAULT false, reden text NOT NULL, aangemaakt_op timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.google_reviews TO authenticated; GRANT ALL ON public.google_reviews TO service_role;
ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_reviews ON public.google_reviews FOR SELECT TO authenticated USING (coalesce(auth.jwt()->>'aal','')='aal2' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'marketing')));
CREATE TABLE public.google_reviews_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_id uuid NOT NULL, gebruiker_id uuid, actie text NOT NULL, reden text NOT NULL, voor jsonb, na jsonb, op timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.google_reviews_audit TO authenticated; GRANT ALL ON public.google_reviews_audit TO service_role;
ALTER TABLE public.google_reviews_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_review_audit ON public.google_reviews_audit FOR SELECT TO authenticated USING (coalesce(auth.jwt()->>'aal','')='aal2' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'marketing')));
CREATE TABLE public.google_review_scores (controle_week date PRIMARY KEY, rating numeric NOT NULL CHECK(rating BETWEEN 1 AND 5), aantal integer NOT NULL CHECK(aantal>=0), gecontroleerd_op timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.google_review_scores TO service_role;
ALTER TABLE public.google_review_scores ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.google_review_week_claims (week date PRIMARY KEY, gestart_op timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.google_review_week_claims TO service_role;
ALTER TABLE public.google_review_week_claims ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.google_reviews_bewaren(_id uuid,_naam text,_sterren integer,_tekst text,_datum date,_url text,_verborgen boolean,_reden text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_voor jsonb; v_na jsonb;
BEGIN
 IF coalesce(auth.jwt()->>'aal','') <> 'aal2' OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verzekering') OR public.has_role(auth.uid(),'marketing')) THEN RAISE EXCEPTION 'Geen toegang' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(_reden,''))) NOT BETWEEN 3 AND 500 OR length(trim(coalesce(_naam,''))) NOT BETWEEN 1 AND 200 OR _sterren IS NULL OR _sterren NOT BETWEEN 1 AND 5 OR length(trim(coalesce(_tekst,''))) NOT BETWEEN 1 AND 10000 OR coalesce(_url,'') !~ '^https://(g\.co|([a-z0-9-]+\.)?google\.[a-z.]+|maps\.app\.goo\.gl)/' OR _datum IS NULL THEN RAISE EXCEPTION 'Naam, sterren 1-5, tekst, datum, Google-link en reden (3-500 tekens) verplicht'; END IF;
 IF _id IS NULL THEN
 INSERT INTO public.google_reviews(naam,sterren,tekst,review_datum,google_url,verborgen,reden) VALUES(trim(_naam),_sterren,trim(_tekst),_datum,_url,coalesce(_verborgen,false),trim(_reden)) RETURNING id,to_jsonb(google_reviews.*) INTO v_id,v_na;
 ELSE
 SELECT to_jsonb(r.*) INTO v_voor FROM public.google_reviews r WHERE id=_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Review niet gevonden'; END IF;
 UPDATE public.google_reviews SET naam=trim(_naam),sterren=_sterren,tekst=trim(_tekst),review_datum=_datum,google_url=_url,verborgen=coalesce(_verborgen,false),reden=trim(_reden) WHERE id=_id RETURNING id,to_jsonb(google_reviews.*) INTO v_id,v_na;
 END IF;
 INSERT INTO public.google_reviews_audit(review_id,gebruiker_id,actie,reden,voor,na) VALUES(v_id,auth.uid(),CASE WHEN _id IS NULL THEN 'toevoegen' WHEN _verborgen THEN 'verbergen' ELSE 'bewerken' END,trim(_reden),v_voor,v_na);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.google_reviews_bewaren(uuid,text,integer,text,date,text,boolean,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.google_reviews_bewaren(uuid,text,integer,text,date,text,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.google_reviews_publiek() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('reviews',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT id,naam,sterren,tekst,review_datum,google_url FROM public.google_reviews WHERE NOT verborgen ORDER BY review_datum DESC NULLS LAST,aangemaakt_op DESC,id LIMIT 10) r),'[]'::jsonb),'score',(SELECT to_jsonb(s) FROM public.google_review_scores s ORDER BY gecontroleerd_op DESC LIMIT 1)) $$;
REVOKE ALL ON FUNCTION public.google_reviews_publiek() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.google_reviews_publiek() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.google_reviews_week_claim(_week date) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Geen toegang' USING ERRCODE='42501'; END IF;
 IF _week IS DISTINCT FROM date_trunc('week',now() AT TIME ZONE 'Europe/Amsterdam')::date THEN RAISE EXCEPTION 'Ongeldige controleweek'; END IF;
 INSERT INTO public.google_review_week_claims(week) VALUES(_week) ON CONFLICT DO NOTHING; RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.google_reviews_week_claim(date) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.google_reviews_week_claim(date) TO service_role;
CREATE OR REPLACE FUNCTION public.google_reviews_score_opslaan(_week date,_rating numeric,_aantal integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_n integer; v_tekort integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Geen toegang' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.google_review_week_claims WHERE week=_week) THEN RAISE EXCEPTION 'Geen weekclaim'; END IF;
 INSERT INTO public.google_review_scores(controle_week,rating,aantal) VALUES(_week,_rating,_aantal) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT count(*) INTO v_n FROM public.google_reviews;
 v_tekort:=_aantal-v_n;
 IF v_tekort>0 THEN INSERT INTO public.wijzigingsmeldingen(titel,omschrijving,onderdeel,wat_moet_ellen_doen) VALUES('Google-reviews: wekelijkse controle','Google heeft meer reviews dan de beheerlijst. Controle uitgevoerd voor week '||_week||'.','admin','Er staan '||v_tekort||' nieuwe Google-reviews die nog niet op de site staan. Voeg ze toe in Admin, Google-reviews, ook lage scores.'); END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.google_reviews_score_opslaan(date,numeric,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.google_reviews_score_opslaan(date,numeric,integer) TO service_role;