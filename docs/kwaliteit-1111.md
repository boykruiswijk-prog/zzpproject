# Loep 11 november 2026

## Sitemap
- `sitemap.txt` toegevoegd naast `sitemap.aspx` in de clientlijst en identieke serverkopie.
- Acht directe 301-regels naar `/sitemap.xml`: Nederlands, en/de/fr, elk met en zonder afsluitende slash, in `_redirects` en Cloudflare-CSV.
- Bestaande routes, `/tv` en de bewust afgekeurde groepsfoto blijven ongemoeid.
- Lovable verwerkt `_redirects` niet. De CSV moet extern in Cloudflare worden toegepast voor een echte HTTP 301; niets gepubliceerd of extern ingesteld.

## Gemiste controle
De bestaande build controleerde routeconflicten, foto's en bundellekken, maar las `not_found_log` niet. Er was dus geen automatische controle op drie logtreffers.

Nieuw: `scripts/notFoundGate.ts`, na prerender aangeroepen door Vite. Alleen-lezen via de beheerde CLI, geen publieke tabelrechten, sleutels of logbestand in de uitvoer. Bij onleesbare log of niet-200/301 faalt de controle. Geen filtering op afgehandeld en geen uitsluiting van bestandsextensies. Alleen de specifieke A9-foto is uitgezonderd.

De tabel bewaart een cumulatief aantal plus eerste/laatste tijdstip, niet de tijdstippen van individuele treffers. Exact drie treffers binnen dertig dagen is daarom niet te reconstrueren zonder datawijziging. De controle is conservatief: cumulatief aantal minimaal drie en laatste treffer binnen dertig dagen. Dit vangt `/sitemap.txt` (3, laatste 11-11 05:37:38 UTC).

## Resultaat en beperkingen
- Eerst 1 gerichte test rood wegens ontbrekende sitemapregel, vervolgens 516 tests groen in zeven bestanden.
- Automatische controle meldt build OK. Afzonderlijke volledige productiebuild en typecheck zijn niet handmatig uitgevoerd, conform de verplichte automatische controle.
- De nieuwe gate is afzonderlijk met de echte log uitgevoerd. Zonder lokale `dist` vindt hij twee bestaande live 404's: `/src/assets/ellen-baars-portrait.webp` en `/src/assets/logo-zp.webp`. Die bestaande bronnen krijgen bij productiebuild al bestandsstubs via `srcAssetsRedirectPlugin`; er is hier geen volledige productie-uitvoer beschikbaar om die opnieuw te bevestigen. Geen andere redirects toegevoegd en geen foto's aangepast.
- Geen gegevens, mails, migraties, tarieven of facturatie gewijzigd. Geen Ellen-melding ingevoegd omdat Boy deze beurt expliciet data en mails uitsluit.

## Bestanden
`src/config/legacyRedirects.ts`, `supabase/functions/_shared/legacyRedirects.ts`, `public/_redirects`, `docs/cloudflare-bulk-redirects.csv`, `scripts/notFoundGate.ts`, `scripts/AGENTS.md`, `vite.config.ts`, `src/test/kwaliteit1111.test.ts`, `roadmap.md`, dit rapport.