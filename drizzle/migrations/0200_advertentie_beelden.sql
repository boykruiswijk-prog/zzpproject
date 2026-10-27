CREATE TABLE public.advertentie_beelden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bron_url text NOT NULL,
  breedte integer NOT NULL CHECK (breedte BETWEEN 100 AND 4000),
  hoogte integer NOT NULL CHECK (hoogte BETWEEN 100 AND 4000),
  status text NOT NULL DEFAULT 'nieuw' CHECK (status IN ('nieuw','klaar','geweigerd')),
  resultaat_url text,
  fout text,
  lease uuid,
  lease_tot timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertentie_beelden TO authenticated;
GRANT ALL ON public.advertentie_beelden TO service_role;
ALTER TABLE public.advertentie_beelden ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lezen advertentiebeelden" ON public.advertentie_beelden FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND (auth.jwt()->>'aal')='aal2');

CREATE OR REPLACE FUNCTION public.advertentie_beeld_claim(p_lease uuid)
RETURNS SETOF public.advertentie_beelden LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.advertentie_beelden SET lease=p_lease, lease_tot=now()+interval '2 minutes'
  WHERE id=(SELECT id FROM public.advertentie_beelden WHERE status='nieuw' AND (lease_tot IS NULL OR lease_tot<now())
            ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.advertentie_beeld_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advertentie_beeld_claim(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.advertentie_beeld_wekken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='nieuw' THEN
    PERFORM net.http_post(url:='https://eugkavokktjwpqaqlwsj.supabase.co/functions/v1/advertentie-beeld',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.advertentie_beeld_wekken() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER advertentie_beeld_wekken AFTER INSERT ON public.advertentie_beelden FOR EACH ROW EXECUTE FUNCTION public.advertentie_beeld_wekken();