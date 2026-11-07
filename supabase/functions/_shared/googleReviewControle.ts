export function controleWeek(now: Date) {
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(now);
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}
export async function controleerGoogleScore(admin: any, key: string | undefined, now=new Date(), request: typeof fetch=fetch, log: (s:string)=>void=console.log) {
  if(!key) { log('Google-reviewcontrole overgeslagen: GOOGLE_PLACES_API_KEY ontbreekt'); return { overgeslagen:true }; }
  const week=controleWeek(now);
  const claim=await admin.rpc('google_reviews_week_claim',{_week:week});
  if(claim.error) throw new Error(claim.error.message);
  if(claim.data!==true) return { overgeslagen:true, reden:'week al gecontroleerd' };
  const response=await request('https://places.googleapis.com/v1/places/ChIJ5wXTzBPnxUcR5NGNhaq2lJA',{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'rating,userRatingCount'}});
  if(!response.ok) throw new Error(`Google-scorecontrole [${response.status}]: ${await response.text()}`);
  const score=await response.json();
  if(typeof score.rating!=='number'||score.rating<1||score.rating>5||!Number.isInteger(score.userRatingCount)||score.userRatingCount<0) throw new Error('Ongeldige Google-score');
  const saved=await admin.rpc('google_reviews_score_opslaan',{_week:week,_rating:score.rating,_aantal:score.userRatingCount});
  if(saved.error) throw new Error(saved.error.message);
  return { opgeslagen:saved.data===true };
}