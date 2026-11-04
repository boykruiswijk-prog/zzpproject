# Kwaliteitscontrole 4 november 2026

Niet gepubliceerd. Alleen prijswoorden en doorverwijzingen aangepast, geen prijzen, bedragen, facturatie, SEPA, Exact, klantmails of verwijderingen.

## Wijzigingen en bestanden

- `src/components/diensten/BeroepspaginaTekst.tsx:20`: uitsluitend `incl.` vervangen door `inclusief` in de gedeelde snelle-startprijsregel. Bedragen, dekking en opmaak behouden.
- `src/data/bavVergelijking.ts:44`: uitsluitend `premie incl.` vervangen door `premie inclusief`. Dezelfde bron voedt tabel en mobiele ZP Zaken-kaart.
- `src/test/beroepspaginaTeksten.test.tsx:20,25`: prijscontrole accepteert alleen de voluit geschreven formulering; verwachte bestaande prijsregel bijgewerkt.
- `src/test/kwaliteit0411.test.ts` nieuw: recursieve controle van publieke bronbestanden in src, eventuele root-i18n, scripts, gegenereerde Zeker-kennis en beide public/llms-bestanden. Hoofdletterongevoelig, beide richtingen, maximaal 40 tussenliggende tekens, inclusief regeleinden. Admin, crm en testbestanden uitgesloten. Grensgevallen 40/41 tekens getest. Daarnaast acht expliciete nieuwsvarianten, vier vangregels, voorrang bestaande regels en /tv-vrijwaring.
- `src/config/legacyRedirects.ts`: introregel naar `/over-ons`, `nieuws/*` naar `/kennisbank`, nieuws-vangnet toegestaan in de bestaande taalprefixgenerator.
- `vite.config.ts`: CSV ondersteunt nieuws-vangregels met subpadmatching zonder suffixbehoud. Gegenereerde vangregels komen na alle expliciete regels, ook taalvarianten.
- `public/_redirects`: acht introregels met status 301, vier nieuwe nieuws-vangregels en verplaatsing bestaande vangregels na de expliciete taalregels.
- `docs/cloudflare-bulk-redirects.csv`: acht introvarianten en vier prefix-vangregels; nieuws-slash-prefix krijgt subpadmatching, bestaande specifieke bestemmingen behouden.
- `src/test/kwaliteit2310.test.ts`: bestaande expliciete wildcardallowlist uitgebreid met drie nieuwe taalprefix-nieuwsvangregels.
- `AGENTS.md`: bestaande redirectarchitectuurregel verduidelijkt.
- `roadmap.md`: taak afgerond.

Geen andere relevante `incl.`-voorkomens aangetroffen in publieke prijsbronnen, i18n/locales, SEO, schema, FAQ, Zeker of llms. Daarom die teksten en gegenereerde llms-bestanden niet herschreven. De bestaande SEPA-comment `incl. land` staat los van kosten/assurantiebelasting en blijft ongemoeid.

## Bewijs tests

Voor correctie: nieuwe test faalt op exact:

```text
src/components/diensten/BeroepspaginaTekst.tsx:20: incl. kosten en assurantiebelasting
src/data/bavVergelijking.ts:44: incl. kosten en assurantiebelasting
```

Ook ontbrekende introredirects en vangnet afgekeurd: 6 rood, 1 groen.

Na correctie: 16 testbestanden, 201 tests geslaagd. Dit omvat alle bestaande kwaliteit*-tests en beroepspagina-/redirectcontroles. De oudere kwaliteit2310-test moest de nieuw gevraagde wildcardallowlist erbij krijgen.

Automatische bouwcontrole: `build OK` op 4 november 06:43:01 UTC. Geen handmatige build gestart, overeenkomstig de verplichte automatische bouwcontrole.

Browser: snelle start op beide opgegeven pagina’s gecontroleerd, vergelijking desktop 1280 en mobiel 390 voluit, alle acht introvarianten eindigen op `/over-ons`, onbekend nieuws eindigt op `/kennisbank`, bestaande `nieuws/categories/bav` eindigt nog op `/verzekeringen`.

## Hosting

De status 301 staat in de redirectregels en Cloudflare-CSV. Lovable hosting verwerkt `_redirects` niet. De previewcontrole bewijst de juiste browserbestemming, niet een HTTP-301 van de productiehost. Echte HTTP-301 vereist toepassing van de regels bij de externe doorverwijzingslaag; niet uitgevoerd of gepubliceerd in deze opdracht.

## Revisies en melding

Automatisch vastgelegde revisies: `fde770d8` nieuwe test/taak, `19131e4e` tekst en generator, `e55028ad` gegenereerde redirects/CSV, `a0a83bdd` bestaande wildcardtest. Geen handmatige Git-commit uitgevoerd.

Eén website-melding aan Ellen: `09301c77-78a9-4bc1-854c-3184c8e9dd3c`, met expliciet vermelding dat Boy nog controleert en publiceert.