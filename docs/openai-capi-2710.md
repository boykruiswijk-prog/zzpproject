# OpenAI Ads serverconversies, 27 oktober 2026

- Gecontroleerde secretnaam: `OPENAI_ADS_CAPI_KEY`. Geen waarde gelezen of getoond.
- Endpoint: `POST https://bzr.openai.com/v1/events?pid=SxHpKs2V6EgSyfvtYJwquQ`.
- Authenticatie: `Authorization: Bearer` met uitsluitend de runtime-secret.
- Serverevent: `id: bav_lead_{aanvraag-id}`, `type: lead_created`, `timestamp_ms` uit opgeslagen aanvraagtijd, `action_source: web`, `source_url: https://zpzaken.nl/bav-zzp`, optioneel oorspronkelijke `oppref`, `data: {type: customer_action}`. De bron-URL is bewust de vaste publieke aanvraagpagina, zonder parameters of vrije klantpaden.
- Browser: `oaiq("measure", "lead_created", {type:"customer_action"}, {event_id:"bav_lead_{aanvraag-id}"})`.
- Alleen nieuwe duurzaam opgeslagen BAV + AVB-leads met `is_test === false` en opgeslagen `marketing_toestemming === true`. Geen historische verzending, persoonsgegevens, advanced matching, Exact-aanroepen of wijzigingen aan SEPA/klantmails.
- Log: `openai_ads_conversie_log`; aanvraag-ID, unieke event-ID, status, HTTP-code, veilige foutcode. Alleen service-toegang, RLS zonder publieke policies, anon/authenticated-grants expliciet ingetrokken en teruggelezen. Unieke insert claimt vóór verzending. Onzekere uitkomsten worden niet automatisch herhaald.

## Controles

- 38 gerichte tests geslaagd, automatische build OK.
- Gedeployde functie: `validate_only:true` met fictief event, OpenAI **HTTP 200**, veilig antwoord **`{"accepted_events":1}`**, logstatus `gevalideerd`. Geen conversie opgeslagen bij OpenAI.
- Zonder geldige interne toegang: HTTP 401.
- Bestaande gemarkeerde testaanvraag: HTTP 200 `{"status":"overgeslagen"}`; nul bijbehorende dispatchlogs.
- Echte browser-SDK: vóór scriptlaad gestart event werd verwerkt met gedeelde ID `bav_lead_browser-validation`. Alleen de synthetische conversion-upload onderschept, niet als echte conversie aan OpenAI gestuurd.
- Geen echte niet-testaanvraag aangemaakt. Daarom is de volledige productieaanvraag met server- en browserontvangst niet end-to-end bewezen.
- Beide functies gedeployed: `openai-conversions`, `process-bav-wizard`.
- Websitepublicatie aangevraagd. Eenmalige livecontrole `/bav-zzp`: HTTP 200, maar opgehaalde productie-assets bevatten nog niet de nieuwe `bav_lead_`-code. Nieuwe frontendversie dus **nog niet bevestigd**.
- Eén Ellen-melding `71ca6719-221f-4a80-beb1-eb86a760c98d`, gemaild op 12:28:18 UTC.
- Verse databasescan: twee informatieve bestaande publieke artikel/opslagmeldingen. Eerdere vijf kritieke Exact-codebevindingen niet gewijzigd; verse databasescan beoordeelt die codebevindingen niet opnieuw.

## Gewijzigde bestanden

- `supabase/functions/_shared/openaiAdsEvent.ts`
- `supabase/functions/openai-conversions/index.ts`
- `supabase/functions/process-bav-wizard/index.ts`
- `src/lib/tracking.ts`
- `src/test/openaiCapi.test.ts`
- `src/test/openAiPixel.test.ts`
- `src/test/openAiPageView.test.ts`
- `drizzle/migrations/0201_openai_ads_conversion_log.sql`
- `drizzle/migrations/0202_openai_ads_log_private_grants.sql`
- Automatisch bijgewerkte databasetypes en migratieadministratie
- `AGENTS.md`, `roadmap.md`, dit rapport en projectgeheugen