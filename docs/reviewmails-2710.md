# Reviewteksten, register Reviews 2

Alleen de onderwerpen en body van `review_verzoek` en `review_herinnering` zijn vervangen door de exact goedgekeurde teksten. Voornaam wordt nu ook doorgegeven aan de onderwerphelper.

## Gerenderde onderwerpen

| Mail | Voornaam | Onderwerp |
| --- | --- | --- |
| review_verzoek | Sam | Sam, mag ik je iets vragen? |
| review_verzoek | ontbreekt | Mag ik je iets vragen? |
| review_herinnering | Sam | Nog één keer, daarna laat ik je met rust |
| review_herinnering | ontbreekt | Nog één keer, daarna laat ik je met rust |

Vier fictieve HTML-voorbeelden staan in `docs/reviewmails-preview-2710.html`. Beide varianten zonder voornaam beginnen met `Hoi,`. Alle vier renders zijn visueel gecontroleerd. Geen gedachtestreepjes toegevoegd. Geen klantmail verstuurd en geen reviewverzendrun uitgevoerd.

## Ongewijzigd

- Cron/verzendmomenten, kandidatenregels en eenmalige verzending/herinnering.
- Klikregistratie en knopbestemming via `review-klik` naar de bestaande Google writereview-URL.
- Adresvoettekst en afmeldlink.
- Afzender blijft uit de bestaande afzenderinstelling komen; geen instelling of afzendernaam veranderd.
- `reply_to: info@zpzaken.nl`, dus antwoorden blijven bij het team binnenkomen.

## Controle

- Bestaande mailtests: 9 geslaagd. Automatische websitecontrole: build OK.
- `review-verzoeken` gedeployed, ingezonden source SHA-256: `d7bdb260854284e2472e95cc784f98aafb15a8e5bac6fb2489f44e6737faaaf2`.
- Live ongeautoriseerde proef: HTTP 401, geen verzending of gegevenswijziging. Dit bewijst de beveiligde live functie, niet de exacte actieve tekstversie.
- Ellen-melding: `cca819d3-f14c-4ff5-8e17-21c6b5839e42`.
- Publicatie wordt aangevraagd; exacte website-livecommit moet afzonderlijk worden bevestigd. De website zelf heeft bij deze opdracht geen nieuwe zichtbare tekst of frontendcode, alleen de mailfunctie verandert.

## Bestanden

- `supabase/functions/_shared/reviewMail.ts`
- `supabase/functions/review-verzoeken/index.ts` (alleen voornaam doorgeven voor onderwerp)
- `docs/reviewmails-preview-2710.html`
- Dit rapport, `roadmap.md` en projectgeheugen.