ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_code_bav text NOT NULL DEFAULT '8003';
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_account_id_bav uuid;
ALTER TABLE public.exact_config ADD COLUMN IF NOT EXISTS gl_account_id_bav_code text;
COMMENT ON COLUMN public.exact_config.gl_account_id_bav_code IS 'Code waarvoor gl_account_id_bav gecachet is';

CREATE TABLE public.portal_auto_invite_claim (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  bron text
);
GRANT ALL ON public.portal_auto_invite_claim TO service_role;
ALTER TABLE public.portal_auto_invite_claim ENABLE ROW LEVEL SECURITY;