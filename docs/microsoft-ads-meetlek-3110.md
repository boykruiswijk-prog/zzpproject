# Microsoft Ads-meetlek, 31 oktober 2026

## Conclusie
De huidige code ondersteunt Microsoft-klikherkomst. Er is geen aangetoonde algemene fout die iedere msclkid of Bing-verwijzer weggooit. Wel zijn gerichte fouten gevonden en hersteld in een latere betaalde binnenkomst binnen dezelfde sessie en in de Microsoft-meetfunctie. Die fouten bewijzen niet waarom alle 49 leads Microsoft-herkomst missen. De circa 511 advertentieklikken zijn door Boy opgegeven, niet onafhankelijk uit Microsoft Ads opgehaald.

## 1. msclkid bij aanvraag, offerte en contact
- `src/main.tsx` legt de binnenkomst vast. `src/lib/attributie.ts` leest msclkid uit de URL en bewaart die met marketingakkoord 90 dagen in `zp_klikids`.
- De BAV-aanvraag en het concept gebruiken `leesAttributie()`. Offerte/contact gebruiken dezelfde functie via `submitPublicForm` in `src/lib/antiSpam.ts`. De bestaande serverfuncties verwerken deze via de gedeelde validator naar `extra_data.attributie`.
- Unit/integratietest met exact `?msclkid=test123`: klik-ID opgeslagen, behouden na navigatie naar contact en behouden door de gedeelde servervalidator. Geen echte aanvraag of formulierinzending.
- Hersteld: een nieuwe betaalde binnenkomst in dezelfde sessie vervangt nu de oude campagne, verwijzer en landingspagina. Voorheen werd alleen de advertentiemarkering bijgewerkt. Test met eerst Google, daarna Microsoft/Bing slaagt.

## 2. Toestemming en cijfers
De bestaande keuze en banner zijn niet veranderd. Zonder marketingakkoord wordt msclkid niet opgeslagen of meegestuurd door de huidige browsercode. De gewone Bing-verwijzer en de bestaande niet-identificerende markering `advertentieklik: microsoft` kunnen wel aanwezig zijn. Het ontbreken van msclkid alleen bewijst dus geen meetfout, maar toestemming alleen verklaart niet waarom ook alle Microsoft-markeringen en Bing-verwijzers ontbreken.

Read-only telling vanaf 6 oktober 2026 00:00 Europe/Amsterdam tot de onderzoeksquery op 31 oktober, met `is_test IS NOT TRUE`:

| Meting | Leads |
|---|---:|
| Totaal niet-test | 49 |
| gclid | 7 |
| Verwijzer google.com, inclusief subdomeinen | 12 |
| Zowel gclid als Google-verwijzer | 5 |
| msclkid | 0 |
| Bing-verwijzer | 0 |
| utm_source met bing of microsoft | 0 |
| advertentieklik microsoft | 0 |
| advertentieklik google | 11 |
| Marketingakkoord true | 17 |
| Marketingakkoord false | 19 |
| Marketingkeuze ontbreekt | 13 |

Onder de 12 Google-verwijzers: 5 met marketingakkoord, 5 met weigering en 2 zonder opgeslagen keuze. De 7 gclids en 12 verwijzers zijn geen twee gescheiden groepen. Een Google-verwijzer kan organisch zijn; hiermee is geen betrouwbaar toestemmingsverliespercentage voor advertenties te berekenen.

| Leadtype | Leads | gclid | Google-verwijzer |
|---|---:|---:|---:|
| Verzekeringaanvraag | 29 | 4 | 7 |
| Offerteaanvraag | 4 | 1 | 0 |
| Contact | 15 | 2 | 5 |
| Handmatig | 1 | 0 | 0 |

## 3. UET
- Live `https://zpzaken.nl/contact`: nul Microsoft-verzoeken vóór akkoord. Na Alles accepteren: bat.js HTTP 200, accountconfig `/p/action/187280316.js` HTTP 200 en meetverzoeken HTTP 204. Eén basisinstallatie; het tweede Microsoft-script is de door Microsoft geladen tagconfiguratie, geen tweede basisinstallatie. Geen browserruntimefouten.
- De aanvraag roept `trackPurchase` pas na een succesvolle serverrespons aan. Deze stuurt `event, aanvraag_afgerond, { event_category: aanvraag }` naar UET, niet bij testaanvragen.
- Hersteld: UET start alsnog wanneer een bezoeker met akkoord vanuit een uitgesloten pad naar een publiek pad gaat; herstel na een mislukte scriptdownload; geen dubbele eerste pagina door effect-herhaling.
- De bestaande marketingkeuze wordt nu ook bij elk applicatie-event opnieuw gecontroleerd en de UET-toestemmingsupdate volgt wijzigingen uit een ander tabblad. Dit wijzigt de toestemmingsregels/banner niet; het voorkomt dat applicatie-events na intrekking doorgaan.
- Browserproef met echte Microsoft-runtime: `ea=aanvraag_afgerond`, `ec=aanvraag`, `ti=187280316` vastgesteld. Alle Microsoft-meetverzoeken in die proef zijn vóór verzending onderschept en lokaal met 204 beantwoord. Geen aanvraag, klantmail of testconversie naar Microsoft ingestuurd. De losse testmodule moest expliciet worden geïnstalleerd omdat een dynamische ontwikkelimport een andere module-instantie gebruikte; dit was een beperking van de proef, geen bewezen productiefout.
- Niet geverifieerd: of de Microsoft Ads-accountconversie hetzelfde event/doel gebruikt en voor optimalisatie actief is. HTTP 204 voor gewone live meting bewijst geen advertentietoeschrijving of geldige conversiedoelconfiguratie.

## 4. Bing-verwijzer
De bestaande code leest externe `document.referrer`, bewaart origin/pad en verwijdert query/fragment. Test `https://www.bing.com/search?q=zzp` levert `https://www.bing.com/search`, ook zonder marketingakkoord. Een browser, app of tussenliggende redirect kan de verwijzer weglaten. Zonder de daadwerkelijke advertentiebestemming en redirectketen is niet bewezen of Bing die bij deze 511 bezoeken aanleverde.

## Verificatie en grenzen
- 34 gerichte tests geslaagd in zes bestanden.
- Volledige suite: 1883 geslaagd, 1 overgeslagen, 2 fouten buiten deze wijziging: `geenOudMedewerker.test.ts` vindt de oude foto-URL in de bestaande 31-10-redirect/test; `wpInventory.test.ts` vindt de bestaande afwijking tussen frontend- en serverredirectlijst. Niet aangepast binnen deze opdracht.
- Automatische buildcontrole: build OK. Geen afzonderlijke handmatige typecheck uitgevoerd.
- Productiecode gewijzigd: uitsluitend `src/lib/attributie.ts` en `src/lib/tracking.ts`.
- Tests: `src/test/microsoftAttributie.test.ts`, `src/test/microsoftUetInstall.test.ts`, `src/test/uetAanvraagAfgerond.test.ts`.
- Geen publicatie, functie-deployment, databasewijziging, wijzigingsmelding, echte aanvraag of mail. Toestemming/banner, prijzen, facturatie, Exact en /tv-weergave ongemoeid.

## Resterende verklaring onderzoeken
Controleer in Microsoft Ads of automatisch toevoegen van msclkid aanstaat, welke uiteindelijke advertentie-URL en redirects de bezoeker krijgt en of het doel exact `aanvraag_afgerond`/categorie `aanvraag` gebruikt. Dit zijn ongeverifieerde mogelijkheden, geen vastgestelde oorzaken. De historische 49 leads worden niet aangevuld of gewijzigd.