-- Batch tracking table for bulk DBA checks
CREATE TABLE public.dba_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  zip_file_url TEXT,
  zip_filename TEXT,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  certified_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link dba_checks to a batch (optional)
ALTER TABLE public.dba_checks ADD COLUMN batch_id UUID REFERENCES public.dba_batches(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.dba_batches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team members can view batches"
  ON public.dba_batches FOR SELECT
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can insert batches"
  ON public.dba_batches FOR INSERT
  WITH CHECK (public.is_team_member(auth.uid()));

CREATE POLICY "Team members can update batches"
  ON public.dba_batches FOR UPDATE
  USING (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can delete batches"
  ON public.dba_batches FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_dba_batches_updated_at
  BEFORE UPDATE ON public.dba_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster batch lookups
CREATE INDEX idx_dba_checks_batch_id ON public.dba_checks(batch_id);