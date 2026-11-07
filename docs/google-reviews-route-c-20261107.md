# Google-reviews route C

Besluit Boy 7-11-2026 10:32, A8/C-aanvulling Google-reviews 2.

- Admin, Website, Google-reviews: toevoegen/bewerken/verbergen met verplichte reden en audit; geen verwijderknop of DELETE-recht. Rollen admin/supervisor/verzekering/marketing, MFA verplicht.
- Drie bestaande reviews met audit gestart. Oorspronkelijke datums ontbreken in de vaste bron, daarom niet verzonnen; Ellen vult ze bij controle in.
- Publieke read-only RPC geeft maximaal tien zichtbare reviews, nieuwste eerst, geen sterfilter. Lege lijst gebruikt bestaande drie reviews. Carrousel en schema delen dezelfde scorecontrole.
- Eén wekelijkse cron maandag 08:00 Europe/Amsterdam, zelfaanpassing naar zomer-/wintertijd voor volgende maandag. Vault beschermt aanroep; unieke weekclaim voorkomt dubbele Google-aanroepen. Places New vraagt uitsluitend rating,userRatingCount (het nieuwe equivalent van user_ratings_total). Geen reviewteksten opgehaald via API.
- Tekort vergelijkt alle beheerde reviews, inclusief bewust verborgen reviews, zodat spamverbergen niet telkens een nieuwe toevoegopdracht geeft. Eén melding per opgeslagen controleweek, transactioneel met score.
- GOOGLE_PLACES_API_KEY ontbreekt. Beveiligde echte aanroep HTTP200 overgeslagen, één logregel; geen Google-aanroep, score of weekclaim. Onbeveiligde aanroep HTTP401.
- 10 gerichte nieuwe tests groen; volledige suite 2620 geslaagd, 1 overgeslagen. Automatische typecheck/build OK, geen afzonderlijke handmatige productiebuild.
- Afzonderlijk werkelijk carrouselscherm gebruikt echte publieke RPC: drie opgeslagen reviews, geen fout. Desktop/390px bekeken, volgende review werkt, geen horizontale overloop. Volledige homepage blijft leeg door bestaand probleem; niet gerepareerd buiten deze opdracht. Admin-eindcontrole via Boy-account blokkeert op bestaande MFA-instelfout, niets omzeild.
- Precies één beheerlijstmelding be20b3a1-f431-4d71-a1bc-d69237516c39, onderdeel admin, voorgeschreven actie exact teruggelezen; gemaild 10:08:20 UTC.
- Functie google-review-controle uitgerold; website niet gepubliceerd. Laatste codecommit vóór dit verslag d073af01, eerdere route-C wijzigingen over meerdere automatische commits.

## Gewijzigde bestanden
AGENTS.md; roadmap.md; src/App.tsx; src/components/admin/AdminSidebar.tsx; src/pages/admin/GoogleReviews.tsx; src/data/googleReviews.ts; src/lib/googleReviews.ts; src/hooks/useGoogleReviews.ts; src/components/social-proof/GoogleReviewsSection.tsx; src/components/social-proof/SiteSchemaMarkup.tsx; src/components/social-proof/TrustSignalsStrip.tsx; src/components/diensten/SnelleStart.tsx; supabase/functions/_shared/googleReviewControle.ts; supabase/functions/google-review-controle/index.ts; src/test/googleReviewsRouteC.test.ts; src/test/googleReviewsSql.test.ts; src/test/interneFunctiesMfa.test.ts; drizzle/migrations/0259_google_reviews_route_c.sql; gegenereerde snapshot/journal/types; dit verslag.