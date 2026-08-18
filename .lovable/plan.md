# Diagnose: BAV-testaanvraag, geen mail aangekomen

Read-only onderzoek. Niets gewijzigd, niets gedeployed.

## 1. Welke functie roept het BAV-formulier aan

Er is **geen route `/bav`** in `src/App.tsx`. `/bav-avb` staat in de redirectlijst (regel 128) en gaat naar `/verzekeringen`. Het aanmeldformulier (`BAVApplicationModule`) staat op `/` (`src/pages/Index.tsx`) en `/verzekeringen` (`src/pages/Verzekeringen.tsx`). Dat is het enige BAV-formulier; er zijn geen andere formulieren op die pagina's.

Aanroepen vanuit `src/components/home/BAVApplicationModule.tsx`:

| Regel | Functie | Payload |
|---|---|---|
| 168 | `check-existing-customer` | `{ email, kvk }` — dubbelcheck na stap 3 |
| 198 | `process-bav-wizard` | `gekozen_pakket, betaalwijze, ingangsdatum, voornaam, achternaam, email, telefoon, bedrijfsnaam, kvk_nummer, beroep, adres_straat, adres_huisnummer, adres_postcode, adres_plaats, iban, sepa_akkoord, rekeninghouder, vereist_handmatige_beoordeling, opmerkingen` |
| 312 | `send-portal-magiclink` | alleen bij "bestaande klant"-melding |

`process-bav-wizard` roept vervolgens zelf `send-lead-notification` aan (regel 204–226) en bij fout `send-notification` (regel 347).

## 2. lead_notification_log, laatste 60 minuten

**Geen enkele rij.** Ook niet in de laatste 120 minuten. De tabel bevat 40 rijen in totaal; de meest recente is van **2026-07-02 13:34:38 UTC**. Er is dus sinds begin juli geen mailpoging gelogd.

## 3. leads, laatste 60 minuten

**Geen enkele nieuwe rij** (ook niet over 120 minuten). De testaanvraag is niet in de database opgeslagen. Het spoor loopt dus dood vóór de mail: er is geen lead aangemaakt.

## 4. Edge function logs laatste 60 minuten

Niet verifieerbaar. De log-tools geven voor `send-lead-notification`, `send-notification` en `process-bav-wizard` "No logs found", en een directe query op `function_edge_logs` levert over 24 uur én over 7 dagen nul rijen. Er zijn dus geen HTTP-statuscodes en geen `[mail]`-regels op te halen. Ik kan niet vaststellen of de functie is aangeroepen — de loginfrastructuur geeft in deze omgeving niets terug.

## 5. Resend-fout

Niet aanwezig in wat wel op te halen is: geen `lead_notification_log`-rij met status `failed`, geen logregel. Niet verifieerbaar.

## 6. Module-/importfout

Niet verifieerbaar uit logs (zie punt 4). Wel gevonden in de code: `supabase/functions/_shared/mail.ts` en `_shared/environment.ts` bestaan, en `send-lead-notification` importeert alleen `resolveEnvironment` en `getFromAddress` — die exports bestaan beide.

**Wel een harde codefout in `send-lead-notification/index.ts`:** op regel 176 wordt in de `[mail]`-logregel `recipient` en `bccList` gebruikt, terwijl die pas op regel 177 en 178 met `const` worden gedeclareerd. Dat is een temporal-dead-zone-fout: bij elke aanroep gooit de functie direct `ReferenceError: Cannot access 'recipient' before initialization`, vóórdat er een mail wordt verstuurd of iets in `lead_notification_log` wordt geschreven. Dit verklaart exact het beeld "geen mail, geen logrij" — mits de functie überhaupt is aangeroepen.

## 7. Deploy-timestamps per mailfunctie

Niet verifieerbaar. Er is in deze omgeving geen tool die de deploy-timestamp of het actieve versienummer van een Edge Function teruggeeft, en `function_edge_logs` (waar `deployment_id`/`version` in zou staan) geeft geen rijen terug.

## Conclusie

Twee onafhankelijke breukpunten:

1. **Er is geen lead opgeslagen.** De aanvraag heeft `process-bav-wizard` niet succesvol doorlopen (of het formulier is niet tot submit gekomen). Daarom kon er ook nooit een mail volgen.
2. **`send-lead-notification` is in de huidige code kapot** door de TDZ-fout op regel 176. Zelfs met een geslaagde lead zou er geen mail en geen logrij komen.

## Voorstel voor de fix (nog niet uitgevoerd)

- Verplaats in `send-lead-notification/index.ts` de `[mail]`-logregel naar ná de declaraties van `recipient` en `bccList`.
- Daarna een gecontroleerde testaanroep doen en de uitkomst in `lead_notification_log` verifiëren, zodat het resultaat aantoonbaar is zonder afhankelijk te zijn van de edge-logs.
- Los daarvan uitzoeken waarom de submit geen lead opleverde: dat vraagt een test-submit op de gepubliceerde site met de browserconsole en netwerkrespons erbij, want de serverlogs geven hier niets.
