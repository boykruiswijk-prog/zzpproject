# Mobiele admin volledig herstellen

## Aanpak
1. Maak een geautomatiseerde mobiele audit voor alle adminroutes op 375, 390 en 430 px. De audit meet ieder zichtbaar element buiten het scherm, ook binnen verborgen overloop, en signaleert afgeknotte koppen.
2. Herstel eerst de gedeelde adminindeling zodat pagina’s, grids en kaarten altijd binnen het scherm blijven. Pas daarna alleen de gevonden pagina’s en onderdelen gericht aan.
3. Geef brede gegevens op mobiel een eigen kaartweergave of een begrensde scrollzone. Bouw de Facturatie-agenda als compacte mobiele maandlijst met alle gevraagde aantallen en bedragen; behoud de bestaande desktopweergave.
4. Test alle routes en bereikbare detailpagina’s opnieuw op alle drie breedtes totdat de audit nul overtredingen meldt.
5. Controleer dashboard, klantdetail en facturatieplanning visueel op 390 px, bewaar screenshots en controleer de actuele preview-build.

## Technische details
- De audit gebruikt `getBoundingClientRect()` op zichtbare DOM-elementen en rapporteert selector, positie, breedte en relevante tekst.
- Dynamische detailroutes worden gevuld met bestaande, niet-test records; klantdetailtabbladen worden elk geopend en gemeten.
- Desktopstijlen blijven vanaf de bestaande tablet/desktopbreekpunten ongewijzigd.
- Er worden geen gegevens, rechten, processen of backendfuncties gewijzigd.
