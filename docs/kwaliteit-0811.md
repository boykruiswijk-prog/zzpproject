# Kwaliteitscontrole 8 november 2026

Niet gepubliceerd. Geen prijzen, facturatie, SEPA, Exact, klantmails of /tv gewijzigd. Alleen de aangewezen artikelzin is in de database gewijzigd.

## 1. Productclaims: oud naar nieuw

- `src/i18n/locales/nl.json`: `Unieke producten en diensten` → `Bedenker van de BAV + AVB in één polis`
- `src/i18n/locales/nl.json`: `Unieke BAV+AVB combipolis` → `BAV + AVB in één polis`
- `src/i18n/locales/nl.json`: `Unieke combinatiepolis van ZP Zaken` → `De combinatiepolis, bedacht door ZP Zaken`
- `src/i18n/locales/nl.json`: `, "Exclusief via ZP Zaken"` → `vervallen, geen vervanging`
- `src/i18n/locales/nl.json`: `Exclusief bij ZP Zaken` → `Bedacht door ZP Zaken`
- `src/i18n/locales/en.json`: `Unique combined professional & business liability policy` → `Creator of professional and business liability in one policy`
- `src/i18n/locales/en.json`: `Unique combined liability policy` → `Professional and business liability in one policy`
- `src/i18n/locales/en.json`: `Unique combined policy by ZP Zaken` → `The combined policy, created by ZP Zaken`
- `src/i18n/locales/en.json`: `, "Exclusively via ZP Zaken"` → `vervallen, geen vervanging`
- `src/i18n/locales/en.json`: `Exclusive at ZP Zaken` → `Created by ZP Zaken`
- `src/i18n/locales/de.json`: `Einzigartige kombinierte Berufs- & Betriebshaftpflicht` → `Erfinder von Berufs- und Betriebshaftpflicht in einer Police`
- `src/i18n/locales/de.json`: `Einzigartige kombinierte Haftpflicht` → `Berufs- und Betriebshaftpflicht in einer Police`
- `src/i18n/locales/de.json`: `Einzigartige Kombi-Police von ZP Zaken` → `Die Kombi-Police, entwickelt von ZP Zaken`
- `src/i18n/locales/de.json`: `Einzigartige Kombi-Police` → `Berufs- und Betriebshaftpflicht in einer Police`
- `src/i18n/locales/de.json`: `unserer einzigartigen kombinierten` → `unserer kombinierten`
- `src/i18n/locales/de.json`: `, "Exklusiv über ZP Zaken"` → `vervallen, geen vervanging`
- `src/i18n/locales/de.json`: `Exklusiv bei ZP Zaken` → `Von ZP Zaken entwickelt`
- `src/i18n/locales/fr.json`: `Police combinée unique responsabilité professionnelle & civile` → `Créateur de la responsabilité professionnelle et civile en une seule police`
- `src/i18n/locales/fr.json`: `Police combinée unique de ZP Zaken` → `La police combinée, créée par ZP Zaken`
- `src/i18n/locales/fr.json`: `Police combinée unique` → `Responsabilité professionnelle et civile en une seule police`
- `src/i18n/locales/fr.json`: `notre police combinée unique` → `notre police combinée`
- `src/i18n/locales/fr.json`: `, "Exclusivement via ZP Zaken"` → `vervallen, geen vervanging`
- `src/i18n/locales/fr.json`: `Exclusif chez ZP Zaken` → `Créée par ZP Zaken`
- `src/pages/OverOns.tsx`: `Ruim 13 jaar geleden bedenker van de unieke polis voor zzp'ers in Nederland.` → `Ruim 13 jaar geleden bedenker van de BAV + AVB in één polis voor zzp'ers.`
- `src/pages/OverOns.tsx`: `Bedenker unieke BAV+AVB polis` → `Bedenker BAV + AVB in één polis`
- `src/pages/Diensten.tsx`: `Inclusief onze unieke combinatiepolis` → `Inclusief onze BAV + AVB in één polis`
- `src/pages/Diensten.tsx`: `De unieke BAV + AVB combinatiepolis die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering:  exclusief via ZP Zaken.` → `De combinatiepolis, bedacht door ZP Zaken, die beroeps- én bedrijfsaansprakelijkheid combineert in één verzekering.`
- `src/pages/Diensten.tsx`: `⭐ Unieke BAV + AVB combinatiepolis (exclusief)` → `BAV + AVB in één polis`
- `src/pages/Historie.tsx`: `title: "Uniek", description: "Innovatieve oplossingen die je nergens anders vindt."` → `title: "Innovatief", description: "Oplossingen voor zelfstandig professionals."`
- `src/pages/SocialMedia.tsx`: `onze unieke BAV+AVB combinatiepolis` → `onze BAV + AVB in één polis`
- `src/pages/SocialMedia.tsx`: `een unieke combinatiepolis` → `een combinatiepolis`
- `src/pages/CreditControl.tsx`: `Onze unieke <span` → `Onze <span`
- `src/components/historie/Timeline.tsx`: `en unieke verzekeringsoplossingen.` → `en verzekeringsoplossingen.`
- `src/components/waarom/SavingsCalculator.tsx`: `Uniek in Nederland` → `BAV + AVB dagelijks opzegbaar`
- `src/components/waarom/SavingsCalculator.tsx`: `Alleen ZP Zaken rekent dit zo transparant` → `Inzicht in kosten per gewerkt uur`

De ongebruikte isUnique-vlag op de BAV+AVB-kaart in src/pages/Verzekeringen.tsx is verwijderd. Diensten-schema en SocialMedia-FAQ gebruiken dezelfde gecorrigeerde brongegevens. FAQItems en overige JSON-LD-bronnen hadden geen verboden claim; niet gewijzigd.

### Artikel
public.articles, slug zorgverzekering-2025-voor-zzpers-zorgeloos-zzpen:
- Oud: Unieke en hoge verzekerde bedragen met uitgebreide dekking, tegen een scherpe prijs. Zonder eigen risico en zeer flexibel.
- Nieuw: BAV € 5.000.000 en AVB € 2.500.000 per aanspraak in één polis, voor € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting. Geen eigen risico op de BAV + AVB en dagelijks opzegbaar.
- Gerichte vervanging van exact één voorkomen. SQL bevestigt uitsluitend exacte zin en overige velden ongewijzigd, behalve automatische updated_at. Afbeelding en published_at behouden. Vijf niet-productgebonden artikelzinnen over bedrijfsnaam, expertise en situatie behouden.

## 2. Metadata

- `src/config/seoRoutes.ts`: `title: `BAV & AVB Verzekering ZZP'ers | Vanaf €${laagstePakket.prijs}/maand`` → `title: "BAV & AVB verzekering voor zzp'ers in één polis | ZP Zaken"`
- `src/config/seoRoutes.ts`: `"Aansprakelijkheidsverzekering voor ICT-zzp'ers: BAV € 5 mln en AVB € 2,5 mln per aanspraak in één polis, geen eigen risico, binnen 24 uur geregeld."` → ``Aansprakelijkheidsverzekering voor ICT-zzp'ers: BAV € 5 mln en AVB € 2,5 mln per aanspraak in één polis, € ${LANDING_MAAND} per maand of € ${LANDING_JAAR} per jaar, inclusief kosten en assurantiebelasting. Geen eigen risico, binnen 24 uur geregeld.``
- index.html: dezelfde nieuwe homepage title en og:title; twitter:title toegevoegd. Index.tsx gebruikt exactTitle; prerender bewaart die volledige titel ook voor taal-homepages en schrijft twitter:title per pagina.
- Zeker-kennis opnieuw gegenereerd uit bronnen; uitsluitend homepage title gewijzigd.
- public/llms.txt: ICT-regel aangevuld met € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting.
- public/llms-full.txt en beide generatorfuncties gecontroleerd: geen verboden claims; geen onnodige inhoudswijziging.

## 3. Controles
- kwaliteit0811.test.ts eerst rood: 33 claimregels en twee metadataregels. Eerste probe had daarnaast een foutieve generatorpadverwijzing; die testfout is hersteld voordat de reproduceerbare rode controle werd gebruikt.
- Gerichte eindcontrole: 79 geslaagd, 0 gefaald (7 testbestanden).
- Volledige suite tweemaal groen: 2646 geslaagd, 0 gefaald, 1 overgeslagen (239 bestanden).
- Prerender-test: 51 volledig gerenderde pagina’s, 0 fallback, 668 redirects; sitemap 48 URL’s allemaal 200, self-canonical en zonder noindex. Dit is de testfixture, niet een volledige productiebuild.
- Automatische preview-build: laatste melding build OK. Afzonderlijke typecheck en volledige productiebuild niet uitgevoerd of afzonderlijk bevestigd; de omgeving voert die automatisch uit en verbiedt handmatig starten.
- Browser: homepage title, og:title en twitter:title exact correct. De bestaande lege preview blijft op alle drie pagina’s; zichtbare teksten daarom niet bevestigd. Geen runtimefouten. Geen herstel buiten opdracht.
- Ellen: precies één website-melding 34aaf2d1-217c-4ace-9687-ed8d3471fd8b, actie null, teruggelezen, gemaild_op 2026-11-08 06:38:36.445+00. Geen klantmail.

## Grenzen
Initialen en bestaande bemiddelaarsteksten zijn buiten deze opdracht gelaten. Geen functies uitgerold of website gepubliceerd.

## Bestanden
AGENTS.md, roadmap.md, dit rapport, index.html, scripts/prerender.ts, public/llms.txt, src/config/seoRoutes.ts, src/i18n/locales/nl.json, en.json, de.json, fr.json, src/pages/Index.tsx, Verzekeringen.tsx, OverOns.tsx, Diensten.tsx, Historie.tsx, SocialMedia.tsx, CreditControl.tsx, src/components/historie/Timeline.tsx, src/components/waarom/SavingsCalculator.tsx, src/test/kwaliteit0811.test.ts, supabase/functions/_shared/zekerKennis.generated.ts.
