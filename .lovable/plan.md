# Mobiele admin voor iPhone en tablet

## Doel
De bestaande admin blijft inhoudelijk en functioneel gelijk, maar wordt onder 1024 px volledig bruikbaar zonder afgesneden tekst of horizontale paginascroll. Desktop vanaf 1280 px behoudt de huidige navigatie en indeling.

## Uitvoering
1. **Mobiele navigatie**
   - Verberg het vaste zijmenu onder `lg` en voeg een vaste compacte bovenbalk toe.
   - Gebruik een toegankelijk uitklappaneel met dezelfde menu-items en rolfilters als het zijmenu.
   - Sluit via menukeuze, Escape en tik buiten het paneel; markeer de actieve pagina en houd focus binnen het geopende menu.
   - Geef de pagina onder de vaste balk 16 px mobiele binnenruimte.

2. **Gedeelde mobiele basis**
   - Voorkom horizontale scroll op het admin-paginaniveau en laat lange titels, ondertitels en bediening afbreken.
   - Maak relevante tikdoelen minimaal 40 px hoog.
   - Maak admin-dialogen op mobiel vrijwel schermbreed, met begrensde hoogte en scrollbare inhoud.

3. **Dashboard en filters**
   - Dashboardkaarten: één kolom mobiel, twee vanaf `sm`, vier vanaf `lg`.
   - Bedragen blijven volledig zichtbaar met een kleinere mobiele tekstgrootte en zonder truncatie.
   - Laat kopacties, “Toon test” en filters op smalle schermen onder elkaar of over meerdere regels lopen.

4. **Lijsten en details**
   - Klanten en leads krijgen onder `md` compacte kaarten met 3–4 kernvelden; de bestaande tabellen blijven vanaf `md` zichtbaar.
   - Brede tabellen voor contracten, planning, opzeggingen en reconciliatie scrollen alleen binnen hun eigen begrenzing.
   - Klant- en lead-detailkoppen, acties en certificaat-/opzegdialogen worden passend gemaakt voor 390 px.
   - Service-aanvragen krijgt mobiel passende filters, lijstweergave en detaildialoog.

5. **Controle**
   - Controleer op 390 × 844 en 768 px: dashboard, klanten, een klantdetail met certificaat/opzegging, facturatieplanning, leads, service-aanvragen en een lead-detail.
   - Controleer per pagina expliciet op horizontale paginascroll en zichtbare afkapping.
   - Controleer daarnaast op 1280 px dat de vaste zijbalk en desktopindeling ongewijzigd zijn.
   - Controleer de actuele buildstatus en relevante tests; niet publiceren.

## Technische details
- Hergebruik de bestaande shadcn Sheet/Dialog/Button-onderdelen voor focusbeheer, Escape en buitenklik.
- Deel de navigatieconfig tussen desktopzijbalk en mobiel menu, zodat rolfilters identiek blijven.
- Gebruik responsive Tailwind-klassen; geen wijzigingen aan data-opvragingen, mutaties, mail of Exact.
