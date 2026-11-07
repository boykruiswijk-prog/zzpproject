import { describe,it,expect,vi } from 'vitest';
import { selecteerReviews,reviewStand } from '@/lib/googleReviews';
import { googleReviewsData } from '@/data/googleReviews';
import { controleerGoogleScore,controleWeek } from '../../supabase/functions/_shared/googleReviewControle';

const row=(id:string,sterren:number,date:string,verborgen=false)=>({id,naam:id,sterren,tekst:'Review',review_datum:date,google_url:'https://g.co/test',verborgen});
describe('Google-reviews route C',()=>{
 it('toont ook één en twee sterren, zonder sterfilter',()=>{expect(selecteerReviews([row('a',1,'2026-11-06'),row('b',2,'2026-11-07')]).map(r=>r.rating)).toEqual([2,1]);});
 it('nieuwste eerst met maximaal 10 en geen verborgen review',()=>{
 const rows=Array.from({length:12},(_,i)=>row(String(i),i%5+1,`2026-11-${String(i+1).padStart(2,'0')}`));
 expect(selecteerReviews([...rows,row('hidden',5,'2026-11-30',true)]).map(r=>r.name)).toEqual(['11','10','9','8','7','6','5','4','3','2']);
 });
 it('valt terug op de huidige drie reviews en vaste score',()=>{expect(selecteerReviews([])).toEqual(googleReviewsData.reviews);expect(reviewStand()).toEqual({averageRating:5,totalReviews:4});});
 it('gebruikt de laatste gecontroleerde score en aantal',()=>{expect(reviewStand({rating:3.7,aantal:21,gecontroleerd_op:'2026-11-09'})).toEqual({averageRating:3.7,totalReviews:21});});
 it('zonder sleutel geen Google-aanroep of opslag, één logregel',async()=>{
 const admin={rpc:vi.fn()},fetcher=vi.fn(),log=vi.fn();expect(await controleerGoogleScore(admin,undefined,new Date(),fetcher,log)).toEqual({overgeslagen:true});expect(admin.rpc).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(log).toHaveBeenCalledTimes(1);
 });
 it('maximaal één aanroep per geclaimde week; alleen scorevelden',async()=>{
 let claimed=false;const admin={rpc:vi.fn(async(name:string)=>name==='google_reviews_week_claim'?{data:claimed?false:(claimed=true)}:{data:true})};
 const fetcher=vi.fn(async(_url:RequestInfo | URL,_init?:RequestInit)=>new Response(JSON.stringify({rating:4.2,userRatingCount:8,reviews:[{text:'nooit opslaan'}]})));
 await controleerGoogleScore(admin,'test-key',new Date('2026-11-09T07:00:00Z'),fetcher);await controleerGoogleScore(admin,'test-key',new Date('2026-11-09T07:00:00Z'),fetcher);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({'X-Goog-Api-Key':'test-key','X-Goog-FieldMask':'rating,userRatingCount'});expect(admin.rpc).toHaveBeenCalledWith('google_reviews_score_opslaan',{_week:'2026-11-09',_rating:4.2,_aantal:8});
 });
 it('controleweek is Nederlandse week, ook UTC zondagavond',()=>{expect(controleWeek(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09');expect(controleWeek(new Date('2026-07-05T22:30:00Z'))).toBe('2026-07-06');});
});