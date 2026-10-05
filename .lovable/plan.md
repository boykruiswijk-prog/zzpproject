# Homepage: "Kies dit pakket" werkt niet + dubbele pakketten

## Bevindingen (live zpzaken.nl, Playwright 1000x800, 1440x900, 390x844)

```text
Volgorde homepage (src/pages/Index.tsx):
  Hero > HiscoxTrustStrip > #combinatiepolis "BAV + AVB Combinatiepolis" (BAVApplicationModule, r.420/512)
  > #pakketten "Alles onder één dak" (CombiPackageSection) > Ellen Baars > Google-reviews > CTA
Pakketnamen per sectie: #combinatiepolis +Cyber 1 / Jaarlijks 1 / Maandelijks 2 ; #pakketten 1/1/1 ; rest 0
"Kies dit pakket": 0 in #combinatiepolis, 3 in #pakketten (a href=/#combinatiepolis?pakket=<id>)
1000x800 knoppen: x=50/375/701, w=249, h=40; elementFromPoint = de knop zelf (bovenop: ja)
Klik: url / -> /#combinatiepolis?pakket=jaarlijks-cyber ; scrollY 3122 -> 3102 ; formulier-top -2096 ; geen dialoog
Fixed (md+): StickyContactBar "020 - 457 3077"+X  rect 706,740,198,44 z50 (na scrollY>400)
             WhatsAppFloatingButton rect 920,720,64,64 z50 ; ZekerLauncher bottom-92 md:flex z50
             CookieConsent z70 (onderste 294px tot akkoord) ; toaster z100
Fixed (<md): StickyMobileCTA z40 balk onderaan ; CookieConsent
Console: alleen 404-resource-meldingen, geen JS-fouten
```

Conclusie:
- De knop is wel klikbaar, maar er gebeurt zichtbaar niets: ScrollToTop zoekt id `combinatiepolis?pakket=...` (bestaat niet), dus geen scroll. Het formulier staat erboven.
- Het pakket wordt ook niet gekozen: BAVApplicationModule leest `pakket=` alleen bij de eerste keer laden.
- Op 1000 px ligt de telefoonknop (x 706-904) over de rechterknop als die onderaan in beeld staat. Dat is de situatie op de screenshot.
- De "carrousel boven" is de pakketkeuze in het aanvraagformulier (#combinatiepolis). Daardoor staan de pakketten dubbel.

## Voorstel voor de fix (na akkoord)
1. "Kies dit pakket" kiest het pakket in het formulier en scrolt daar soepel naartoe (via scrollNaarAanvraag plus een pakket-event of hashchange-listener).
2. ScrollToTop leest alleen het deel vóór `?` als id.
3. De zwevende telefoonknop verbergen terwijl #pakketten of #combinatiepolis in beeld is, of pas tonen vanaf lg.
4. Keuze voor Boy: sectie "Alles onder één dak" laten staan als vergelijking, of van de homepage halen.
