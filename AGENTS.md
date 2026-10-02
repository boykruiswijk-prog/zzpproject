# Technische afspraken

- SEPA-tekst staat byte-gelijk in frontend en _shared/sepaMachtiging.ts; bewijs is onveranderbaar. Waarom: tekst en bewijs blijven gelijk.
- Mijn ZP-toegang (gebruiker aanmaken, polissen koppelen, magic link, mail+log) staat in supabase/functions/_shared/portalAccess.ts; klanten lezen leadvelden alleen via RPC get_mijn_polissen. Waarom: één toegangsroute en geen klant-SELECT op leads.
- Alle BAV-AVB-factuurteksten en YourRef-keuze lopen via supabase/functions/_shared/factuurTekst.ts; periode staat vooraan en Exact-teksten blijven maximaal 60 tekens. Waarom: consistente, testbare factuurregels zonder UUID-referenties.
- BAV-sector → adminbranche loopt via _shared/sectorBranche.ts; het sectorlabel blijft in extra_data. Waarom: vaste waarden zonder informatieverlies.
- Intakeadres via _shared/adresNormalisatie.ts vóór legBewijsVast. Waarom: overal hetzelfde adres.

## Beveiligingsarchitectuur

- Openbare formulieren schrijven uitsluitend via gevalideerde Edge Functions; anon krijgt geen directe tabelrechten. Waarom: formulieren blijven bruikbaar zonder persoonsgegevens publiek leesbaar te maken.
- Exact-verwerking voor screening wordt nooit vanuit de openbare formulierfunctie uitgevoerd. Waarom: boekhoudmutaties vereisen een afzonderlijke beveiligde teamactie.
- Security-definerfuncties krijgen minimale EXECUTE-rechten; alleen expliciete publieke leesfuncties blijven voor anon beschikbaar. Waarom: privilege-escalatie via RPC voorkomen.
- Policies die rolfuncties (is_team_member, has_role, is_supervisor_or_admin) aanroepen gelden alleen `TO authenticated`; publieke leespolicies `TO anon, authenticated` zonder rolfunctie. Controle: scripts/check-anon-kennisbank.mjs. Waarom: anon heeft geen EXECUTE op rolfuncties, anders faalt elke anonieme query.
- Prerender rendert elke publieke route volledig via src/entry-server.tsx (AppRoutes + vooraf gevulde querydata); oude URL's uit src/config/legacyRedirects.ts (gespiegeld in _shared) en artikel-slugs krijgen noindex-doorverwijspagina's. Waarom: hosting kent geen SSR, 301 of 404.
- 404's worden alleen via RPC log_not_found vastgelegd (alleen optellen, begrensd). Waarom: monitoring zonder anonieme tabelrechten.
- Testdata wordt gemarkeerd met kolom is_test (nooit verwijderd); beheeroverzichten filteren is_test standaard weg, alleen admin/supervisor kan via useToonTestrecords tonen. Leadstatuslabels komen uit src/lib/statusLabels.ts. Waarom: herleidbare historie en één bron voor labels.
- Collectieve aanmeldtellingen worden alleen in afgeschermd beheer opgevraagd; publieke pagina's tonen geen aantallen, doelen of voortgang. Waarom: eerlijke communicatie zonder gevoelige of misleidende sociale bewijslast.
- Opzegregels (toelichting bij "Anders" 3-500 tekens, datum vandaag tot 180 dagen, NL-tijd) staan in src/lib/opzegValidatie.ts, byte-gelijk in _shared/opzegValidatie.ts. Waarom: formulier en server hanteren exact dezelfde regels.

- Lopende klantcontracten staan in klant_contracten (per onderneming via exact_relatie_code), gevuld door de idempotente database-importfunctie importeer_afas_20261001 (alleen service_role); facturatie vanuit het CRM staat uit tot akkoord. Waarom: bestaande klanten blijven buiten leads/pipeline en import is herhaalbaar zonder bijwerkingen.
- Vervolgfacturen lopen uitsluitend via factuur-planner + factuur_planning (uniek per contractregel/periode, sleutel ZPF-xxxxxxxx in Remarks); hoofdschakelaar facturatie_config.facturatie_actief. Waarom: één factuurroute zonder dubbele facturen.
- Mijn ZP-facturen: accounts via _shared/klantAccounts.ts, PDF via _shared/exactFactuurPdf.ts (Documents → bijlage). Waarom: XMLDownload werkt niet in deze administratie.
- Dashboardtellers komen uitsluitend uit RPC dashboard_tellers (klanten/contracten uit klant_contracten, leads uit leads). Waarom: één definitie zonder dubbele bronnen.
- Opzeggingen worden bij insert gekoppeld door bepaal_opzegging_koppeling (e-mail → contractnummer → KvK/bedrijfsnaam als voorstel); contracten wijzigen alleen via RPC verwerk_opzegging. Waarom: nooit automatisch een contract beëindigen.
- Creditnota's bij opzegging: verwerk_opzegging plant per contractregel/opzegging één rij in factuur_credit_planning (sleutel ZPC-…, in YourRef/Remarks); zonder planner-factuur reconstrueert _shared/creditOpzegging.ts de oud-systeemperiodes (bron='oud_systeem'); verzenden alleen met facturatie_config.opzeg_credits_actief (los van facturatie_actief), dry-run via factuur-planner actie credit_dryrun. Waarom: één naar-rato-regel, nooit dubbel crediteren.
- Certificaten per klant staan in klant_certificaten, uniek op onderneming+nummer+aanvraagdatum; import via importeer_certificaten_20261001 (idempotent, service_role), voorstellen via RPC beoordeel_klant_certificaat; generate_certificate_number slaat bezette nummers over. Waarom: nummer alleen is geen sleutel.
- Certificaatnummer onveranderbaar; nieuw/aanpassen/intrekken/mailen via generate-certificate (supervisor/admin), versies in policy_versies, ingetrokken telt niet mee; klant zonder lead via policies.onderneming_id met eigen klant_certificaten-nummer (regels in _shared/certificaatRegels.ts). Waarom: altijd spoor, nooit andermans nummer.
