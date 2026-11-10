# CYBERBLAD vervolg 10 november 2026

## Uitkomst
- Bedragen in beide PDF-types komen uit `_shared/cyber.ts`. De klantakkoordtekst is niet gewijzigd.
- Premie volgt het cybercontract (maand/jaar), bij nieuwe aanvragen het gekozen pakket.
- Lokale Faasen-controle met ZPCYB0001 en jaarpremie EUR 250 gemaakt. Datums/KvK in dit lokale voorbeeld zijn fictief, niet opgeslagen bij de klant.
- Digital Native lokaal gerenderd met bestaande naam, BAV-nummer ZPBAV0901 en cyberdatums 22-10-2026 tot en met 21-10-2027. Dit is geen vervanging van de echte controle-PDF.
- Echte hermaak via eigen Boy-sessie geweigerd met HTTP 403 `mfa_required`. Bestaand pad, status, mailstatus en controle blijven onveranderd. Geen beveiliging omzeild.
- Hermaakoptie `opnieuw: true` bewaart het oude bestand en koppelt uitsluitend een nog ongecontroleerd/onverstuurd nieuw document met vergelijk-en-wisselcontrole, zonder statusverandering.

## Opzegtekst exact
Apart cybercertificaat, oud en nieuw identiek behalve bronhergebruik:
`22-10-2026 tot en met 21-10-2027. Daarna stilzwijgend verlengd met 12 maanden. Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar.`

BAV + cyber oud:
`BAV + AVB doorlopend, zonder minimale looptijd, dagelijks opzegbaar. Cyber: dagelijks opzegbaar.`

BAV + cyber nieuw:
`BAV + AVB doorlopend, zonder minimale looptijd, dagelijks opzegbaar. Cyber: Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar.`

## Controles
- Eerst vier bedragtests rood, daarna 22 gerichte tests groen.
- Volledige suite 2.684 geslaagd, 1 overgeslagen. Twee oude bronasserties aangepast; eerste parallelle run had vier timeouts die afzonderlijk groen werden. Laatste volledige run met twee workers groen.
- Tien PDF-tests groen: maand/jaar en beide PDF-types, bedragen/nummer/opzegtekst uit daadwerkelijke PDF-tekst, één pagina, AFM-link en ondermarge.
- Gedeelde Deno-generatormodules typecheck groen. Automatische appbuild laatst 07:17:49 UTC OK. Afzonderlijke app-typecheck en productiebuild niet bevestigd; niet handmatig uitgevoerd volgens projectuitvoeringsregels.
- Lokale PDF-afbeeldingen visueel gecontroleerd: geen overlap bij normale Faasen/combipolis of het langste realistische geval.
- Alleen twee certificaatfuncties gedeployed. Geen sitepublicatie, Exact, facturatie, SEPA of klantverzending.
- Eén Ellen-adminmelding d14099fc-2bb0-4b08-a034-b30dc3a853b9. Gevraagde tekst niet letterlijk gebruikt: deze zou onjuist stellen dat de echte hermaak al voltooid is. Melding benoemt de MFA-blokkade.

## Bestanden
- supabase/functions/_shared/cyberCertificaatTeksten.ts
- supabase/functions/generate-certificate/index.ts
- supabase/functions/generate-cyber-certificate/index.ts
- scripts/certificaatPreview.ts
- scripts/cyberbladPdf_test.ts
- src/test/cyberblad1011.test.ts
- src/test/cyberCertificaat.test.ts
- src/test/certificaatTeksten2310.test.ts
- src/test/opzegCyberTekst.test.ts
- roadmap.md
- docs/cyberblad-vervolg-20261110.md

Geheugen verduidelijkt met CYBERBLAD-bedragen en certificaatuitzondering; geen registerblad gelezen.

## Open
Echte Digital Native-PDF hergenereren en teruglezen vereist een geldige menselijke MFA-sessie. Daarna pas de definitieve Ellen-actietekst gebruiken. Geen tweede melding tijdens deze beurt.