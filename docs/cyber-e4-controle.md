# E-aanvulling 4: release nog niet vrijgegeven

## Actuele route 23 oktober 10:47: menselijke MFA, alleen_test

Deze route vervangt de geblokkeerde Vault/service-testbrug. Geen Vault-aanroep of omweg. Echte polissen blijven geblokkeerd, de website blijft ongepubliceerd en CYBER_TOEVOEGEN_PUBLIEK blijft false.

- Precies twee open gemarkeerde verzoeken, nog niet goedgekeurd:
  - TEST E4 jaar: `e4104723-0000-4000-8000-000000000006`, polis `e4104723-0000-4000-8000-000000000003`.
  - TEST E4 maand: `33de661d-d747-4300-a6f8-1c993caac333`, bestaande polis `0f1582c8-8610-45cd-8b0e-cf062865af71`.
- Jaarfixture nieuw toegevoegd omdat bestaande jaar-testpolis gepauzeerd was en geen klantkoppeling had; die bestaande polis niet gewijzigd. Maandfixture hergebruikt, alleen test-BAV-contract toegevoegd. Beide hebben volledig gemarkeerde lead/polis/onderneming/BAV en interne testmailbox. Geen echte gegevens veranderd.
- Vóórsnapshot op `2026-10-23 10:52:35.481897+00` opgeslagen in `public.cyber_e4_testbewijs`: per verzoek exact één BAV-contract, lege bestaande BAV-planning, volledige polis en deelnemerstellingen. Trigger verbiedt wijziging van de voorsnapshot. Geen anon/authenticated lees-/schrijfrechten; service_role en de beheerquery hebben toegang.
- `alleen_test` vereist bestaande menselijke MFA/teamrol en vastgelegde beoordeling; de service-testshortcut wordt in deze modus geweigerd. Server dwingt de droge modus af, ongeacht clientvlaggen. Alleen gemarkeerde E4-verzoeken mét voorsnapshot kunnen worden beoordeeld; de kern bewaakt polis/lead/onderneming/BAV opnieuw.
- Akkoord maakt een echt maar gemarkeerd cybertestcontract. Dezelfde SQL-testkandidaat en factuurpayloadbouwer als de planner leveren de droge uitkomst. Het afzonderlijke certificaatmailtemplate wordt droog gecontroleerd vóór de bijlagevrije bevestiging. Geen PDF-generatie, echte mailclaims, logverzending, Exact-aanroep of factuurplanning-mutatie. Uitkomst wordt apart in testbewijs opgeslagen; herhaald akkoord hergebruikt het contract.
- De testondernemingen hebben geen echte Exact-relatie. De droge kandidaat kan daarom `blokkade_soort=relatie` tonen; bedrag/periode/artikel/grootboek en payload zijn inspecteerbaar, maar dit is geen boekbare factuur of bewijs van echte Exact-verwerking.
- De gekozen cyberingang is 24 oktober. Interne cybercontracttelling neemt na akkoord per testonderneming met één toe; `tel_netto_groei` telt instroom pas vanaf die datum, niet reeds op 23 oktober. Het normale dashboard sluit testrecords uit.

### Goedkeuren in de preview

Open als Boy met MFA en zet bij Cyber toevoegen **Toon testrecords** aan. Vul bij ieder verzoek minimaal tien tekens toelichting in en klik **Akkoord**. Geen dryRun-vlag nodig; de server dwingt droge Exact/mail af.

- Jaar: https://id-preview--2e030441-024b-4841-be4b-93d91e428fb6.lovable.app/admin/klanten/e4104723-0000-4000-8000-000000000001
- Maand: https://id-preview--2e030441-024b-4841-be4b-93d91e428fb6.lovable.app/admin/klanten/5562f1eb-272c-44f8-9388-a9195fb15fd3

### Controle na goedkeuren, uitsluitend SELECT

Voer onderstaande query via de beheerquery uit. Voor akkoord zijn `contract_aantal=0` en `uitkomst=null` normaal. Na akkoord horen bedrag, cyclus, ingangsdatum, eigen jaarlooptijd en BAV/polis/planninggelijkheid groen te zijn. `een_contract` bewijst de opgeslagen cardinaliteit; database-idempotentie bij herhaald akkoord vereist ook werkelijk opnieuw klikken en dezelfde contract-ID teruglezen. Opzegging wordt niet door deze opdracht uitgevoerd: de query rapporteert die toestand, niet een niet-uitgevoerde opzegproef.

```sql
WITH bewijs AS (
 SELECT b.*, r.policy_id, r.onderneming_id, r.lead_id, r.status,
        r.gewenste_ingangsdatum, r.geactiveerd_op, r.beoordeeld_door,
        r.beoordeeld_op, r.mail_status, r.mail_claim_op, r.mail_poging,
        r.certificaat_mail_status, r.certificaat_mail_poging, r.certificaat_pad,
        r.contract_id
 FROM public.cyber_e4_testbewijs b
 JOIN public.cyber_toevoeg_verzoeken r ON r.id=b.verzoek_id
 WHERE b.is_test AND r.is_test
   AND b.verzoek_id IN ('33de661d-d747-4300-a6f8-1c993caac333',
                        'e4104723-0000-4000-8000-000000000006')
), na AS (
 SELECT b.*,
   coalesce((SELECT jsonb_agg(to_jsonb(k) ORDER BY k.id)
             FROM public.klant_contracten k
             WHERE k.onderneming_id=b.onderneming_id AND k.product='bav_avb'),'[]'::jsonb) bav_na,
   coalesce((SELECT jsonb_agg(to_jsonb(fp) ORDER BY fp.id)
             FROM public.factuur_planning fp JOIN public.klant_contracten k ON k.id=fp.klant_contract_id
             WHERE k.onderneming_id=b.onderneming_id AND k.product='bav_avb'),'[]'::jsonb) planning_na,
   (SELECT to_jsonb(p) FROM public.policies p WHERE p.id=b.policy_id) polis_na,
   (SELECT count(*) FROM public.klant_contracten k
    WHERE k.cyber_toevoeg_verzoek_id=b.verzoek_id) contract_aantal,
   (SELECT count(*) FROM public.klant_contracten k
    WHERE k.onderneming_id=b.onderneming_id AND k.product='cyber_clear' AND k.status<>'vervangen') cyber_na
 FROM bewijs b
)
SELECT n.label,n.verzoek_id,n.contract_id,n.status,n.geactiveerd_op,n.beoordeeld_door,
 n.vastgelegd_op<n.beoordeeld_op AS snapshot_voor_akkoord,
 n.contract_aantal,n.contract_aantal=1 AS een_contract,
 c.is_test AS contract_test,c.cyclus,c.bedrag_per_periode,c.begin_datum,
 c.cyber_ingangsdatum,c.cyber_einddatum,c.itemcode,c.volgende_factuurdatum,
 c.cyclus=CASE WHEN n.label='TEST E4 jaar' THEN 'jaar' ELSE 'maand' END AS betaalwijze_correct,
 c.bedrag_per_periode=CASE WHEN n.label='TEST E4 jaar' THEN 250 ELSE 27.50 END AS bedrag_correct,
 c.begin_datum=n.gewenste_ingangsdatum AND c.cyber_ingangsdatum=n.gewenste_ingangsdatum AS ingang_correct,
 c.cyber_einddatum=(n.gewenste_ingangsdatum+interval '12 months'-interval '1 day')::date AS twaalf_maanden,
 n.bav_voor=n.bav_na AS bav_byte_gelijk,
 n.planning_voor=n.planning_na AS bav_planning_byte_gelijk,
 n.polis_voor=n.polis_na AS bav_polis_byte_gelijk,
 n.cyber_na-(n.telling_voor->>'cyber_onderneming')::bigint AS interne_cyber_delta,
 (SELECT count(*) FROM public.klant_contracten k JOIN public.ondernemingen o ON o.id=k.onderneming_id
  WHERE k.cyber_toevoeg_verzoek_id=n.verzoek_id AND NOT k.is_test AND NOT o.is_test) AS dashboard_testbijdrage,
 current_date>=n.gewenste_ingangsdatum AS ingangsdag_bereikt_voor_groeitel,
 n.uitkomst->'planning' AS droge_planner,n.uitkomst->'mail' AS droge_mailvolgorde,
 n.uitkomst->>'exact_writes' AS exact_writes,n.uitkomst->>'mails_verstuurd' AS mails_verstuurd,
 n.mail_status,n.mail_claim_op,n.mail_poging,n.certificaat_mail_status,n.certificaat_mail_poging,
 n.certificaat_pad IS NULL AND n.mail_claim_op IS NULL AND n.mail_poging=0
  AND n.certificaat_mail_poging=0 AS geen_document_of_verzendclaim,
 (SELECT count(*) FROM public.factuur_planning fp WHERE fp.klant_contract_id=c.id) AS cyber_facturen_echt_gepland,
 (SELECT count(*) FROM public.klantmail_log ml WHERE ml.lead_id=n.lead_id AND ml.created_at>=n.vastgelegd_op) AS klantmail_log_na_snapshot,
 (SELECT count(*) FROM public.activiteiten_log a WHERE a.lead_id=n.lead_id AND a.actie_type='cyber_toevoegen_beoordeeld' AND a.created_at>=n.vastgelegd_op) AS beoordeling_auditregels
FROM na n LEFT JOIN public.klant_contracten c ON c.id=n.contract_id
ORDER BY n.label;
```

De query bevat geen geheime gegevens, inserts, updates, activatie of opzegging. Na de twee menselijke goedkeuringen stoppen en de resultaten controleren; geen automatische echte vrijgave.

## Vervolg 23 oktober 10:43: Vault-brug door platform geweigerd
- Bestaande `email_queue_wake` gebruikt pg_net met de Vault-vermelding `email_queue_service_role_key`; alleen de naam en functiedefinitie bekeken, geen geheime waarde opgevraagd of getoond.
- Aanmaak van `public.cyber_e4_testactivatie(uuid)` via migratietool geprobeerd: SECURITY DEFINER, eigenaar postgres, uitsluitend postgres/service_role, volledige is_test-polis/lead/ondernemingkoppeling en interne e-mailcontrole, expliciete droge mail/Exact-modus. De migratietool weigert dit met `Agent access to secrets is not allowed`. Dit is geen `approval_required`-antwoord; er is geen beschikbare goedkeuringskaart voor deze weigering. Geen alternatieve route geprobeerd om de beperking te omzeilen.
- Readback: `{testfunctie_bestaat:false, cyber_testcontracten:0, geactiveerde_testverzoeken:0, actieve_gates:0}`. De functie is niet aangemaakt; geen pg_net-aanroep of resultaat. Jaar/maand-, idempotentie-, BAV-snapshot-, teller-, planner-, opzeg- en echte-polisweigeringbewijs blijven ontbreken.
- Geen vrijgave, functie-deploy, websitepublicatie, klantmail, Exact-mutatie, datawijziging of Ellen-melding in deze vervolgopdracht. Blokker: het platform moet de beveiligde migratie met interne Vault-referentie toestaan; bestaande team-MFA en geheime waarden blijven beschermd.

## Actuele vervolguitkomst 23 oktober 10:22-opdracht
Deze sectie vervangt de eerdere status hieronder waar die afwijkt.

### A. Beperkte deploy en echte databaseproef
- Alleen `cyber-toevoegen-activeren` en `factuur-planner` gedeployed, na groene lokale boots, droge mailtests en Deno-typecheck. Service-only `testActivate=true` + `dryRun=true` activeert uitsluitend gekoppelde gemarkeerde testrecords via de bestaande service-kern. Testplanner vereist afzonderlijk service-identiteit; geen MFA-/internal-secret-uitzondering voor mensen.
- De beschikbare `supabase--curl_edge_functions` accepteert geen service-role-selectie: schema heeft uitsluitend path/method/body/headers/query_params; zonder eigen credential injecteert het hoogstens gebruikersauth. Tweemaal aangeroepen op gemarkeerd verzoek `33de661d-d747-4300-a6f8-1c993caac333`: beide HTTP 401 `unauthorized`. Geen service-secret opgehaald, opgeslagen, blootgesteld of vervangen door een onveilig testgeheim. Geen privilegeverruiming.
- Query-resultaat na deploy: `{cyber_contracten:0, gate_actief:0, geactiveerde_testverzoeken:0, testverzoeken:1}`. Het ene gemarkeerde verzoek blijft `wacht_op_beoordeling`, contract_id null. Er zijn nog geen twee jaar/maand-fixtures geactiveerd. Contract-idempotentie, BAV-snapshots, instroomdelta, plannerpayload en opzeg/readback blijven **ONBEWEZEN**, niet afgevinkt.
- Service-only certificaatclaimrechten readback: anon=false, authenticated=false, service=true. Testrecords blijven uitgesloten van normale planner/dashboardcode. Echte-polisweigering door releasegate is bronmatig aanwezig maar niet door een geautoriseerde runtime-aanroep bewezen.

### B. Certificaat als aparte mail
- Bestaande `mailCertificaat` uit `generate-certificate` verplaatst naar `_shared/certificaatMail.ts`; zowel bestaande aanvraag als E4 gebruiken dezelfde template/afzender/ontvanger/PDF-bijlage/logroute. E4 stuurt eerst afzonderlijk certificaat, daarna cyberbevestiging zonder bijlage.
- Migratie `0168_cyber_separate_certificate_mail_claim.sql` toegepast: onafhankelijke certificaatstatus/poging en service-only atomaire claim; bevestigingsclaim vereist certificaatstatus `verzonden`. Definitieve fouten handmatig herhaalbaar, onzekere verzending niet.
- Droge test voert beide echte helpers in volgorde uit: certificaat=`zou_verzenden`, bevestiging=`zou_verzenden`; nul fetch/download/log. Certificaatfout stopt bevestiging. Mock-providerproef controleert één PDF-bijlage en idempotency-key; aparte bevestigingspayload heeft geen bijlage.
- Geen echte mail of documentgeneratie. Gewijzigde `generate-certificate` nog NIET gedeployed: opdracht A stond alleen twee functies toe; gezamenlijke release wacht op A-bewijs.

### C. Planner typecheck
- Deno-check `factuur-planner/index.ts` en `cyber-toevoegen-activeren/index.ts` volledig groen; vijf oude typefouten opgelost met uitsluitend typeannotaties in plannerpreflight, interne ontvangers en machine-clienttype. Geen prijzen of runtimefacturatieregels gewijzigd.
- Volledige suite: 1461 geslaagd, 2 eerdere wpInventory-fouten, 1 overgeslagen; nieuwe tests groen. De twee eerdere fouten zijn al bewezen op baseline c78c302c. PDF/cyber-Deno 7/7 groen; automatische previewbuild OK.

### D. Nog geen gezamenlijke release
- Backend-releasegate uit en `CYBER_TOEVOEGEN_PUBLIEK=false`. Site niet gepubliceerd; `generate-certificate` niet opnieuw gedeployed.
- Live sessieloze controles na beperkte herdeploy: alle drie functies OPTIONS=200/POST=401. OPTIONS via shell omdat de functietool OPTIONS weigert met `invalid_http_method`.
- Blokker is concrete service-runtime-uitvoering voor A, niet de menselijke MFA-klik. Ellen doet die later met monitoring. Geen data verwijderd, echte mails/Exact-boeking of Ellen-melding.

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
- Certificaat aparte route/claims en droge tests zijn nu gebouwd en groen; gezamenlijke deploy blijft afhankelijk van het service-databasebewijs uit A.
- Menselijke MFA-klik is volgens Boy geen blokkade meer: Ellen doet eerste echte verzoek met monitoring. Dit vervangt niet het ontbrekende service-databasebewijs.

## Foutenlog: releasevolgorde
Symptoom: verplichte database-/planner-/mailketencontroles onvolledig. Oorzaak: lokale testomgeving mist managed service-identiteit; afzonderlijke certificaatverzending nog niet voltooid. Maatregel: geen deploy of publicatie, beide gates blijven uit; gewone klantmailinstelling staat klaar maar geen coordinator is live vrijgegeven. Volgende controle: veilig service-runtimebewijs en afzonderlijke document/mailclaims, dan gezamenlijk vrijgeven en live verifiëren. Menselijke MFA wordt door Ellen live uitgevoerd, niet vooraf omzeild.