# Plan: AI-assistent "Zeker"

## Wat Boy krijgt
- Een chatknop in de cluster rechtsonder op desktop (naast telefoon en WhatsApp, met vaste tussenruimte) en een "Chat"-optie in de onderbalk op mobiel. De chat opent op mobiel schermvullend. De knop verschijnt pas nadat de cookiebanner is gesloten.
- Zeker antwoordt kort en warm in je-vorm, in de taal van de bezoeker. Hij gebruikt alleen onze eigen bronnen en de kennisbank.
- In de chat kan de bezoeker een terugbelverzoek doen, direct afsluiten, een offerte aanvragen, bellen of WhatsAppen.
- Er komt een beheerpagina "Chatgesprekken" en een kleine KPI op het dashboard.
- De privacypagina krijgt een korte paragraaf over de chat.

## Onderdelen
1. **Bronnen en systeemprompt (server).** Er komt een gedeelde kopie van `bavPakketten` in `_shared`, plus een test die controleert dat beide gelijk zijn. De prompt wordt bij elk verzoek opgebouwd uit `company.ts`, USP's, FAQ, diensten/seoRoutes, documenten, verzekeringskaarten per sector en collectiefinfo (zonder aantallen). Daarbij komen per vraag de top-3 kennisbankartikelen (FTS, Dutch). De compliance-regels uit punt 3 staan hard in de prompt.
2. **Database (migratie).**
   - Tabellen `chat_sessions`, `chat_messages` en `chat_rate_limit` met is_test, IP-hash, UA-hash, lead_id en feedback.
   - Alleen team mag lezen (`TO authenticated` + is_team_member). anon krijgt niets. Schrijven gaat alleen via de service role.
   - pg_cron ruimt elke dag gegevens ouder dan 90 dagen op. Daarbij worden alleen chatrijen verwijderd, conform Boy's opdracht.
3. **Edge function `zeker-chat`.**
   - Anthropic Messages API met `ANTHROPIC_API_KEY`. Het model is vast via de constante `ZEKER_MODEL` (standaard `claude-sonnet-5`), zonder fallback. Instellingen: SSE, max_tokens 600, lage temperature.
   - De server bewaart de geschiedenis: de client stuurt alleen de sessie-id en het nieuwe bericht. Grenzen: 30 beurten per sessie en 2.000 tekens per bericht.
   - Misbruik: Origin-allowlist en een rate limit van 20 berichten per 10 minuten en 200 per dag per IP-hash. Een dagplafond voor gesprekken (`ZEKER_MAX_GESPREKKEN_PER_DAG`) toont de contactopties zodra het bereikt is.
   - Een tool `toon_terugbelformulier` laat het formulier verschijnen. BSN/IBAN-patronen worden server-side gemaskeerd vóór opslag en vóór het model.
   - Acties: history, feedback, nieuw gesprek.
   - Foutmeldingen zijn altijd vriendelijk, zonder technische details.
4. **Terugbelverzoek.** Dit loopt via `submit-public-form` met het bestaande contact-/terugbeltype, bron `chat-zeker` en een gesprekssamenvatting. De bestaande teammail gaat mee, met dezelfde preview-omleiding. Het lead_id wordt aan de sessie gekoppeld.
5. **Widget (lazy-loaded).**
   - Venster van ±400×600 met typindicator, streaming en markdown-lite (alleen links en lijsten). Actieknoppen, duim omhoog/omlaag en "Nieuw gesprek".
   - De vaste disclaimerregel bevat een privacylink. Toegankelijk: focus-trap, Esc sluit, aria-labels.
   - De sessie-id staat in sessionStorage; de geschiedenis komt van de server.
   - Verborgen op /admin, /portal, /mijn-zp en de screenshot-helper.
6. **Beheer.** `/admin/chatgesprekken` toont een lijst met filters, een detailweergave en standaard geen testgesprekken. Het dashboard krijgt een KPI: gesprekken vandaag/week en terugbelverzoeken uit de chat.
7. **Testen.**
   - Unit-tests: prompt/prijzen, rate limit, origin-check, geschiedenis en anon-RLS.
   - Een eval-script (`scripts/eval-zeker.mjs`) met 25+ vragen tegen de preview-functie, beoordeeld met regels plus een tweede modelcall. De prompt wordt aangescherpt tot alles slaagt.
   - Een eindtest van het terugbelverzoek, met de lead als test gemarkeerd.
   - Screenshots op 390, 1280 en 1440 px. Daarnaast build, vitest, tsgo, deno check en de security-scan, plus een vergelijking van de grootte van de hoofdchunk.

## Aannames
- Het leadtype wordt het bestaande contact-/terugbeltype in `submit-public-form`. Bestaat "terugbelverzoek" nog niet als type, dan voeg ik het toe aan de enum.
- Openingstijden noemt Zeker alleen als ze in `company.ts` staan.
- Gesprekken vanaf de preview of localhost krijgen `is_test=true`.
- Er wordt niets gepubliceerd, er gaan geen echte mails buiten de preview-omleiding en Exact blijft buiten beeld.

## Technische details
- Ook mogelijk: dezelfde Claude-modellen via de ingebouwde AI-route van Lovable, gefactureerd uit workspacetegoed, met logboek en limieten in het AI-tabblad. Wisselen is later alleen een kwestie van een sleutel en een URL. Standaard bouw ik op de eigen Anthropic-sleutel, zoals gevraagd.
