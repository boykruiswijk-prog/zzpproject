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

## Vervolgcontrole 23 oktober: bewijs per punt 1 tot en met 7
1. Service-only kern `cyberActivatieKern.ts` en script `scripts/cyber-e4-integratie.ts` gebouwd. Script bewaakt gekoppelde testpolis/testlead/testonderneming/test-BAV, twee frequenties, twaalfmaandstermijn, contract-ID bij herhaling en BAV/planning-bytevergelijking. **Niet uitgevoerd tegen database:** de lokale runtime en functietestruntime hebben geen managed service-identiteit. Script stopt vóór alle mutaties met `BLOCKED: managed service identity unavailable; no database evidence generated`. Geen claim van database-idempotentiebewijs. Drie kern-unit-tests groen. Migraties 0163-0167 toegepast: service-only kern, testscope, mailclaim en behoud van menselijke beoordelaar; service-herhaling na activatie hersteld. Read-only rechtencheck: anon/authenticated kunnen kern en testplanner niet uitvoeren; service_role wel.
2. `factuur-planner` heeft actie `testcontract_dryrun`, die alleen één gemarkeerd later-cybercontract leest via `facturatie_testcontract`, de bestaande payloadbouwer gebruikt en vóór machinewerk/credits/Exact terugkeert. GET/POST naar Exact en databasemutaties zijn afwezig op die tak. **Echte kandidaat/payload nog niet bewezen:** dezelfde service-identiteit ontbreekt. De scriptcontrole gebruikt 250/27.50, 102J/102M, 8003 en eigen periode. Dit is geen uitgevoerde plannerproef.
3. Read-only definitie `tel_netto_groei` telt al alle `bav_avb` en `cyber_clear`-contracten; latere contracten vallen zonder uitzondering in dezelfde telling. `dashboard_tellers` gebruikt dit als `netto_groei`; bestaande contracttotalen tellen cyber eveneens. Script bevat vóór/na instroomcontrole op een intern gedateerde testfixture. **Nog geen echte instroomdelta gemeten.** Geen nieuwe afwijkende teller toegevoegd.
4. Read-only opzegpad `verwerk_opzegging` sluit de geselecteerde contract-ID af en roept bestaand `plan_opzeg_credit` aan; cyber blijft zonder credit. `guard_cyber_contract` verbiedt `vervangen` (pauze) bij latere cyber. Productie-/testkandidaatcode blokkeert pas `periode_start > opzegdatum`, niet een periode die de opzegdatum overspant. Bestaande jaar/maand/opzegtests groen. **Jaar-/maand-database-opzegscenario, readback en plannerherhaling nog niet uitgevoerd.** Geen opzeggingen van echte klanten gemuteerd.
5. `cyber_toegevoegd` is toegevoegd aan `klantmail_instellingen` met `actief=true`, `status=goedgekeurd_boy`; readback bevestigd. Geen mail verzonden. Definitieve providerfout -> `mail_mislukt`, onzekere 5xx/408 -> `mail_onzeker`; handmatige knop met unieke databaseclaim per poging, audit en geen automatische retry gebouwd en unit-getest. Certificaat wordt gelezen als PDF-bijlage. **Resterende certificaatroute:** bestaande nieuwe-aanvraagroute mailt certificaat afzonderlijk; de huidige E4-coordinator voegt het aan de bevestiging toe. Deze keuze is nog niet gelijkgetrokken met de gevraagde bestaande aparte verzending. Ook opslag/download en echte verzendclaim zijn niet end-to-end bewezen.
6. Volledige suite: **1453 geslaagd, 2 bestaande fouten, 1 overgeslagen**, 127/128 bestanden groen. Satori CJS-loader herstelt beeldtests zonder `__dirname`-fout; rootredirecttest controleert de gegenereerde output, niet een ontbrekend blok in de bron. DOM-tests gebruiken happy-dom om ontbrekende native canvas niet als ongerelateerde fout te laten crashen. Twee fouten in `wpInventory.test.ts` zijn ook in uitgepakte baseline **c78c302c, 22 oktober 17:12:25 +00:00** gereproduceerd: `fr/portal/login`-doel en frontend/serverlijstverschil. Baseline-uitkomst: 445 geslaagd / 3 fouten; derde was de herstelde rootredirecttest. Deno cyberpayloadtests 3/3, lokale PDF-tests 4/4, kern/coordinatorscript typecheck groen. Planner-brede Deno-check heeft vijf geërfde typefouten in `interneMelding.ts`, `machineWerk.ts` en preflight-GET; niet als groen gerapporteerd.
7. **Niet vrijgegeven.** `CYBER_TOEVOEGEN_PUBLIEK=false`, backend-releasegate uit. Drie lokale bootproeven zonder service-toegang of uitgaand netwerk: `cyber-toevoegen-activeren`, `generate-certificate`, `factuur-planner` alle OPTIONS 200 / sessieloze POST 401. Geen functies gedeployed, site niet gepubliceerd, live na-release-check niet uitgevoerd. Testgegevens behouden, geen echte certificaten/mail/Exact-mutaties, geen wijzigingsmelding aan Ellen.

## Nog nodig vóór vrijgave
- Managed server-testomgeving die de bestaande service-only kern veilig kan uitvoeren zonder credentials te tonen; daarna jaar/maand-fixtures, planner/telling/idempotentie/BAV-reads en opzegscenario uitvoeren.
- Certificaat apart verzenden conform nieuwe-aanvraagroute, met afzonderlijke duurzame claim/herstel en droge test van beide mails. Geen nieuwe release zolang dat bewijs ontbreekt.
- Menselijke MFA-klik is volgens Boy geen blokkade meer: Ellen doet eerste echte verzoek met monitoring. Dit vervangt niet het ontbrekende service-databasebewijs.

## Foutenlog: releasevolgorde
Symptoom: verplichte database-/planner-/mailketencontroles onvolledig. Oorzaak: lokale testomgeving mist managed service-identiteit; afzonderlijke certificaatverzending nog niet voltooid. Maatregel: geen deploy of publicatie, beide gates blijven uit; gewone klantmailinstelling staat klaar maar geen coordinator is live vrijgegeven. Volgende controle: veilig service-runtimebewijs en afzonderlijke document/mailclaims, dan gezamenlijk vrijgeven en live verifiëren. Menselijke MFA wordt door Ellen live uitgevoerd, niet vooraf omzeild.