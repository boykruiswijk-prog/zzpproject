# Testherstel redirects 31 oktober 2026

## Wijzigingen
- `supabase/functions/_shared/legacyRedirects.ts`: de drie toegestane nieuwe regels van 31 oktober toegevoegd. Het volledige redirectblok is byte-gelijk aan de frontendbron; geen bestaande serverregel verwijderd.
- `src/config/legacyRedirects.ts`: uitsluitend de doorverwijzing voor de eerder afgekeurde groepsfoto verwijderd. Een breed afbeeldingspatroon zou ook andere bestanden treffen en is daarom niet toegevoegd. Een 404 voor dit oude foto-adres is volgens Boy acceptabel.
- `public/_redirects` en `docs/cloudflare-bulk-redirects.csv`: de acht afgeleide varianten van uitsluitend die fotoregel verdwenen; overige regels behouden.
- `src/test/kwaliteit3110.test.ts`: de vervallen fotodoorverwijzing vervangen door een strikte afwezigheidscontrole op frontend, server, uitvoer, CSV, taalprefixen en slashvarianten. De vier overige doelen worden nog volledig gecontroleerd.
- `wpInventory.test.ts` en `geenOudMedewerker.test.ts` ongewijzigd. Geen uitschakeling of versoepeling van tests.

## Controles
- Gerichte run: 449 tests geslaagd.
- Volledige run: 177 testbestanden geslaagd, 1885 tests geslaagd, één reeds bestaande overgeslagen test, nul fouten.
- Automatische projectcontrole: laatste beschikbare resultaat `build OK`. Geen afzonderlijke handmatige tsgo-run uitgevoerd, conform de verplichte automatische projectcontrole.
- Redirectspiegel: volledige blok byte-gelijk gecontroleerd.

## Uitrol en veilige opstart
Dezelfde vijftien functies als op 30 oktober opnieuw uitgerold:

zeker-chat, submit-public-form, wp-import, send-lead-notification, send-notification, afgehaakt-samenvatting, aanvraag-nabellen, exact-concept-controle, process-screening-aanvraag, process-klant-service, wijziging-mailen, test-interne-meldingen, bav-override-melding, polis-lifecycle, klant-document-versturen.

Alle vijftien geven HTTP 200 op OPTIONS. De bestaande wrappers en handlers stoppen bij dit verzoek vóór werkzaamheden of verzending. Lege POST zonder aangemelde identiteit: zeker-chat HTTP 400 (`leeg`), submit-public-form HTTP 400 (`Onbekend formulier`), wp-import HTTP 401 (`unauthorized`). Deze verzoeken stoppen vóór opslag, import of mail.

Geen echte aanvraag, mail, wijzigingsmelding of websitepublicatie uitgevoerd. Toestemming, prijzen, facturatie, Exact, SEPA, mailteksten en /tv niet gewijzigd.