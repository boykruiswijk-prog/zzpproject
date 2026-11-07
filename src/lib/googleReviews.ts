import { googleReviewsData, type GoogleReview } from '@/data/googleReviews';

export interface BeheerReview { id: string; naam: string; sterren: number; tekst: string; review_datum: string | null; google_url: string; verborgen?: boolean }
export interface ReviewScore { rating: number; aantal: number; gecontroleerd_op: string }
export function selecteerReviews(rows: BeheerReview[]): GoogleReview[] {
  const visible = rows.filter(r => !r.verborgen).sort((a,b) => (b.review_datum ?? '').localeCompare(a.review_datum ?? '') || a.id.localeCompare(b.id)).slice(0,10);
  return visible.length ? visible.map(r => ({ name:r.naam, rating:r.sterren, text:r.tekst, sourceUrl:r.google_url, date:r.review_datum })) : googleReviewsData.reviews;
}
export function reviewStand(score?: ReviewScore | null) {
  return { averageRating: score?.rating ?? googleReviewsData.averageRating, totalReviews: score?.aantal ?? googleReviewsData.totalReviews };
}