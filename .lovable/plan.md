# Onderzoek: oude BetterLinks-bestemmingen live (alleen bevinding, niets gewijzigd)

## Wat live gebeurt (gemeten 19-10 12:27 UTC)

```text
/brochure-ict                  -> 301 /wp-content/uploads/2023/09/beroepsaansprakelijkheid-technology-highlights.pdf
                                  -> 301 storage .../article-images/wp-content/uploads/... (pdf)
/go/cyberverzekeringskaart-zzp -> 301 /wp-content/uploads/2024/01/Verzekeringskaart-CyberClear-by-Hiscox-2022.pdf
/go/sharepeople (en met /)     -> 301 /aov
```

Alle antwoorden komen van `server: cloudflare`, zonder kenmerken van onze hosting.

## Bron

1. **Cloudflare, niet onze code.** Eén regel in onze code, database of functies bevat deze oude bestemmingen niet. `legacyRedirects.ts`, de kopie in de functies, `public/_redirects` en `docs/cloudflare-bulk-redirects.csv` bevatten allemaal de nieuwe 301's (`/documenten#verzekeringsvoorwaarden`, `/voorwaarden`, `/partners`). Cloudflare (Bulk Redirects of Redirect Rules op de zone zpzaken.nl, nog met de oude BetterLinks-lijst) antwoordt vóór onze site, dus onze regels worden nooit bereikt.
2. **De publicatie is actief, maar niet zichtbaar.** Het Lovable-adres stuurt elk pad door naar zpzaken.nl, waar Cloudflare weer eerst antwoordt. De nieuwe regels zijn dus niet live te bewijzen.
3. **Tweede stap naar storage.** `/wp-content/uploads/*` stuurt door naar de opslag; dat staat in onze eigen `public/_redirects` (regel 17). Dat is bedoeld en verklaart alleen de laatste stap.
4. Er zijn geen meldingen in de database (geen tabel met korte links). `wp-import` noemt "sharepeople" alleen als lijst om over te slaan.

## Wat er nodig is (door iemand met toegang tot Cloudflare)

- In Cloudflare, bij zpzaken.nl, bij Rules (Bulk Redirects en Redirect Rules): de oude BetterLinks-regels opzoeken voor deze 37 paden en verwijderen of vervangen. Dat doe je het makkelijkst door de lijst opnieuw te importeren uit `docs/cloudflare-bulk-redirects.csv`.
- Daarna de Cloudflare-cache legen voor deze paden. Opnieuw meten met `curl -I`: verwacht 301 naar de nieuwe bestemmingen.
- Er hoeft niets aan de code te veranderen en er is geen nieuwe publicatie nodig.
