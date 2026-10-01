# Technische afspraken

- SEPA-tekst staat byte-gelijk in frontend en _shared/sepaMachtiging.ts; bewijs is onveranderbaar. Waarom: tekst en bewijs blijven gelijk.
- Exact-tokenrefresh en 401-race-herstel staan in _shared/exactToken.ts. Waarom: één plek voor tokenlogica.
- Mijn ZP-toegang (gebruiker aanmaken, polissen koppelen, magic link, mail+log) staat in supabase/functions/_shared/portalAccess.ts; klanten lezen leadvelden alleen via RPC get_mijn_polissen. Waarom: één toegangsroute en geen klant-SELECT op leads.
- Alle BAV-AVB-factuurteksten en YourRef-keuze lopen via supabase/functions/_shared/factuurTekst.ts; periode staat vooraan en Exact-teksten blijven maximaal 60 tekens. Waarom: consistente, testbare factuurregels zonder UUID-referenties.
- Live Exact-factuurstatussen worden read-only opgehaald via supabase/functions/_shared/exactInvoiceStatus.ts. Waarom: één veilige bron voor keepalive en polis-lifecycle zonder Exact-wijzigingen.
- Exact-administratietoegang wordt gecontroleerd op de geconfigureerde divisie via _shared/exactDivision.ts; CurrentDivision is alleen informatief. Waarom: de laatst geopende Exact-administratie mag geen vals alarm veroorzaken.
- BAV-sector → adminbranche loopt via _shared/sectorBranche.ts; het sectorlabel blijft in extra_data. Waarom: vaste waarden zonder informatieverlies.
- Intakeadres via _shared/adresNormalisatie.ts vóór legBewijsVast. Waarom: overal hetzelfde adres.

## Beveiligingsarchitectuur

- Openbare formulieren schrijven uitsluitend via gevalideerde Edge Functions; anon krijgt geen directe tabelrechten. Waarom: formulieren blijven bruikbaar zonder persoonsgegevens publiek leesbaar te maken.
- Exact-verwerking voor screening wordt nooit vanuit de openbare formulierfunctie uitgevoerd. Waarom: boekhoudmutaties vereisen een afzonderlijke beveiligde teamactie.
- Security-definerfuncties krijgen minimale EXECUTE-rechten; alleen expliciete publieke leesfuncties blijven voor anon beschikbaar. Waarom: privilege-escalatie via RPC voorkomen.
- Policies die rolfuncties (is_team_member, has_role, is_supervisor_or_admin) aanroepen gelden alleen `TO authenticated`; publieke leespolicies `TO anon, authenticated` zonder rolfunctie. Controle: scripts/check-anon-kennisbank.mjs. Waarom: anon heeft geen EXECUTE op rolfuncties, anders faalt elke anonieme query.
- Oude WordPress-URL's staan alleen in src/config/legacyRedirects.ts (byte-gelijk gespiegeld in _shared); de prerender schrijft per regel een statische doorverwijspagina, behalve voor bestaande routes. Waarom: de hosting kent geen serverredirects, dus elke oude URL heeft een eigen pagina nodig.
- 404's worden alleen via RPC log_not_found vastgelegd (alleen optellen, begrensd). Waarom: monitoring zonder anonieme tabelrechten.
- Testdata wordt gemarkeerd met kolom is_test (nooit verwijderd); beheeroverzichten filteren is_test standaard weg, alleen admin/supervisor kan via useToonTestrecords tonen. Leadstatuslabels komen uit src/lib/statusLabels.ts. Waarom: herleidbare historie en één bron voor labels.
- Collectieve aanmeldtellingen worden alleen in afgeschermd beheer opgevraagd; publieke pagina's tonen geen aantallen, doelen of voortgang. Waarom: eerlijke communicatie zonder gevoelige of misleidende sociale bewijslast.
- Opzegregels (toelichting bij "Anders" 3-500 tekens, datum vandaag tot 180 dagen, NL-tijd) staan in src/lib/opzegValidatie.ts, byte-gelijk in _shared/opzegValidatie.ts. Waarom: formulier en server hanteren exact dezelfde regels.

- Lopende klantcontracten staan in klant_contracten (per onderneming via exact_relatie_code), gevuld door de idempotente database-importfunctie importeer_afas_20261001 (alleen service_role); facturatie vanuit het CRM staat uit tot akkoord. Waarom: bestaande klanten blijven buiten leads/pipeline en import is herhaalbaar zonder bijwerkingen.
- Vervolgfacturen lopen uitsluitend via factuur-planner + factuur_planning (uniek per contractregel/periode, sleutel ZPF-xxxxxxxx in Remarks); hoofdschakelaar facturatie_config.facturatie_actief. Waarom: één factuurroute zonder dubbele facturen.
- Mijn ZP-facturen: accounts via _shared/klantAccounts.ts, PDF via _shared/exactFactuurPdf.ts (Documents → bijlage). Waarom: XMLDownload werkt niet in deze administratie.
- Dashboardtellers komen uitsluitend uit RPC dashboard_tellers (klanten/contracten uit klant_contracten, leads uit leads). Waarom: één definitie zonder dubbele bronnen.
- Opzeggingen worden bij insert gekoppeld door bepaal_opzegging_koppeling (e-mail → contractnummer → KvK/bedrijfsnaam als voorstel); contracten wijzigen alleen via RPC verwerk_opzegging. Waarom: nooit automatisch een contract beëindigen.
- Creditnota's bij opzegging: verwerk_opzegging plant per contractregel/opzegging één rij in factuur_credit_planning (sleutel ZPC-…); bedrag via _shared/creditOpzegging.ts (hergebruikt calculatePauzeCredit); factuur-planner maakt alleen met facturatie_actief een concept (Type 8021). Waarom: één naar-rato-regel en één factuurroute.
