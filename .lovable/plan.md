# Artikelcorrecties en oude WordPress-adressen

- Vervang uitsluitend de twee opgegeven zinnen in de twee bestaande artikelen en zet hun wijzigingsdatum op nu.
- Lees de artikelen terug en controleer alle gepubliceerde artikelen op ondernemersplein-links buiten bronregels.
- Genereer bij iedere build oude artikeladressen met en zonder eindslash uit exact dezelfde gepubliceerde artikellijst als de sitemap.
- Geef alle bestaande routes en doorverwijzingen voorrang; maak nooit een doorverwijzing voor /tv.
- Voeg gerichte tests toe en rapporteer gewijzigde bestanden, testuitslag en beschikbare commitinformatie. Niet publiceren.

## Technische uitvoering
- Deel de artikelredirectgenerator tussen de prerender en tests; toets conflicten tegen zowel App.tsx als seoRoutes.
- Houd de bestaande Cloudflare-CSV-generatie consistent met public/_redirects; wijzig de CSV alleen wanneer nieuwe regels dat vereisen.
- Geen wijzigingen aan andere artikelvelden, klantdata, prijzen, facturatie, SEPA, mails of Exact.
