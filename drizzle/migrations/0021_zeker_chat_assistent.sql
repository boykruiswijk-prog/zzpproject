CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taal text NOT NULL DEFAULT 'nl',
  startpagina text,
  ua_hash text,
  ip_hash text NOT NULL,
  aantal_berichten integer NOT NULL DEFAULT 0,
  lead_id uuid,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  laatste_bericht_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest chatsessies" ON public.chat_sessions FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE INDEX chat_sessions_created_idx ON public.chat_sessions (created_at DESC);
CREATE INDEX chat_sessions_ip_idx ON public.chat_sessions (ip_hash, created_at DESC);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessie_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  rol text NOT NULL,
  tekst text NOT NULL,
  acties jsonb,
  feedback smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_rol_chk CHECK (rol IN ('user','assistant')),
  CONSTRAINT chat_messages_feedback_chk CHECK (feedback IS NULL OR feedback IN (-1, 1))
);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team leest chatberichten" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE INDEX chat_messages_sessie_idx ON public.chat_messages (sessie_id, created_at);

CREATE TABLE public.chat_rate_limit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_rate_limit TO service_role;
ALTER TABLE public.chat_rate_limit ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_rate_limit_ip_idx ON public.chat_rate_limit (ip_hash, created_at DESC);

REVOKE ALL ON public.chat_sessions, public.chat_messages, public.chat_rate_limit FROM anon;

-- Kennisbankzoeker voor Zeker: alleen service_role.
CREATE OR REPLACE FUNCTION public.zeker_zoek_artikelen(_q text)
RETURNS TABLE(slug text, title text, excerpt text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('dutch', coalesce(_q, '')) AS fts,
           string_to_array(lower(regexp_replace(coalesce(_q,''), '[^[:alnum:] ]', ' ', 'g')), ' ') AS woorden
  )
  SELECT a.slug, a.title, left(coalesce(a.excerpt, ''), 300)
  FROM public.articles a, q
  WHERE a.is_published = true
    AND (
      to_tsvector('dutch', coalesce(a.title,'') || ' ' || coalesce(a.excerpt,'') || ' ' || coalesce(a.category,'')) @@ q.fts
      OR EXISTS (SELECT 1 FROM unnest(q.woorden) w WHERE length(w) >= 4 AND lower(a.title) LIKE '%' || w || '%')
    )
  ORDER BY ts_rank(to_tsvector('dutch', coalesce(a.title,'') || ' ' || coalesce(a.excerpt,'')), q.fts) DESC, a.published_at DESC NULLS LAST
  LIMIT 3
$$;
REVOKE ALL ON FUNCTION public.zeker_zoek_artikelen(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zeker_zoek_artikelen(text) TO service_role;

-- Bewaartermijn 90 dagen (uitsluitend chatgegevens).
CREATE OR REPLACE FUNCTION public.zeker_opschonen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $$
  DELETE FROM public.chat_sessions WHERE created_at < now() - interval '90 days';
  DELETE FROM public.chat_rate_limit WHERE created_at < now() - interval '2 days';
$$;
REVOKE ALL ON FUNCTION public.zeker_opschonen() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('zeker-chat-opschonen', '17 3 * * *', $c$ SELECT public.zeker_opschonen(); $c$);