import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selecteerReviews, reviewStand, type BeheerReview, type ReviewScore } from '@/lib/googleReviews';

export function useGoogleReviews() {
  const { data } = useQuery({ queryKey:['google-reviews-publiek'], staleTime:300000, queryFn: async () => {
    const { data,error } = await supabase.rpc('google_reviews_publiek');
    if(error) throw error;
    return data as unknown as { reviews:BeheerReview[]; score:ReviewScore | null };
  }, retry:false });
  return { reviews:selecteerReviews(data?.reviews ?? []), ...reviewStand(data?.score) };
}