-- Create storage bucket for article images
INSERT INTO storage.buckets (id, name, public) VALUES ('article-images', 'article-images', true);

-- Create policy for public read access
CREATE POLICY "Article images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'article-images');

-- Allow team members to upload article images
CREATE POLICY "Team members can upload article images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'article-images' AND public.is_team_member(auth.uid()));

-- Allow team members to update article images
CREATE POLICY "Team members can update article images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'article-images' AND public.is_team_member(auth.uid()));

-- Allow team members to delete article images
CREATE POLICY "Team members can delete article images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'article-images' AND public.is_team_member(auth.uid()));