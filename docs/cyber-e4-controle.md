# E-aanvulling 4: release nog niet vrijgegeven

## Gebouwd
- Aparte cybercontractroute met eigen ingangsdatum en twaalfmaandstermijn; jaar EUR 250, maand EUR 27,50. Geen gecombineerde maandfactuur: een aparte regel/contract via de bestaande planner vermijdt BAV-periodemutaties.
- Akkoord heeft een vergrendeld verzoek en één uniek gekoppeld contract. Mensen hebben MFA nodig.
- Nieuwe coordinator met test-only droge Exact/mailmodus, goedgekeurde mailtekst en persistente mailclaim.
- Certificaatpad met afzonderlijke versie en immutable leasepad; latere gewone renderingen herkennen toegevoegde cyber ook.
- Mijn ZP kan de aparte registratie tonen; teambeoordeling gebruikt de coordinator.

## Bestandsgroepen
- `supabase/functions/cyber-toevoegen-activeren/index.ts` en `index.test.ts`.
- `supabase/functions/_shared/cyberToevoegenActivatie.ts`, `klantmailSchakelaar.ts`, `klantmailTekst.ts`; frontendmirror `src/lib/klantmailTekst.ts`.
- `supabase/functions/generate-certificate/index.ts`.
- `src/components/portal/CyberToevoegen.tsx`, `CyberPolis.tsx`, `src/pages/portal/PortalPolicy.tsx`.
- `src/test/cyberActivatieE4.test.ts`, `cyberToevoegenFlow.test.tsx`, `certificaatRegels.test.ts`, `opzegCyberTekst.test.ts`.
- Migraties `0159` tot en met `0162`; root `AGENTS.md` en roadmap.

## Gecontroleerd
- Lokale boot van beide gewijzigde handlers: OPTIONS 200, POST zonder sessie 401. Netwerk uitsluitend lokaal, geen Exact/mail.
- Drie Deno cyberregels en vier lokale PDF-tests groen.
- Droge mailtest met mocks: zou verzenden, geen netwerkverzoek en geen logmutatie.
- Beheertoegang getest met eigen geminte sessie: redirect naar MFA-instellen. Geen MFA-goedkeurtest uitgevoerd.
- Geen actieve nieuwe cyberverzoeken in de database. Backend gate standaard uit bij ontbrekende rij; frontendvlag blijft false.

## Releaseblokkades en nog niet bewezen
- Geen echte akkoord/contract/planner/telling/idempotentie-test op gemarkeerde testpolis. Een herhaalde payload-unit-test bewijst geen database-idempotentie.
- Geen controle dat de aparte regel daadwerkelijk door de planner factureerbaar is; testcontracten worden door de bestaande planner uitgesloten.
- Nog geen specifieke deelnemerstelling aangesloten/gecontroleerd.
- Definitief niet-verstuurde mailfouten en onzekere claims vereisen onderscheid en expliciet herstel; nooit onbeperkt opnieuw verzenden.
- Goedgekeurde mailtekst staat in broncode, niet als actieve klantmailinstelling. Certificaatmailkeuze voor deze flow nog niet bevestigd.
- Bestaande maandcyberplanner blokkeert een nog niet gefactureerde periode die over de opzegdatum loopt; E4-opzegscenario nog niet bewezen. Geen facturatieregel buiten deze opdracht stil aangepast.
- Volledige suite niet groen: redirectinventaris/rootredirects en beeldtests falen; sommige beeldtests hebben een omgevingsprobleem (`__dirname`).
- Geen gezamenlijke deploy/publicatie, geen livecontrole of Ellen-publicatiemelding uitgevoerd.

## Foutenlog: releasevolgorde
Symptoom: verplichte releasecontroles onvolledig. Oorzaak: echte beoordeling wacht op MFA; volledige regressies hebben fouten. Maatregel: geen deploy of publicatie, beide gates blijven uit. Volgende controle: geldige eigen aal2-sessie, gemarkeerde E2E-flow en alle open controles, dan pas gezamenlijk vrijgeven en live verifiëren.