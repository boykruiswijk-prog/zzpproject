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
