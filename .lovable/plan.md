# Interne meldingen, beheerrechten en nieuw adminmenu

## Doel
Boy ontvangt en controleert alle interne meldingen en gevoelige beheeracties. Alleen admin kan rechten, facturatieschakelaars, koppelingen en interne ontvangers wijzigen. Het mobiele en desktopmenu krijgt één rustige, gegroepeerde structuur zonder verlies van bestaande functies of URL’s.

## Uitvoering
1. **Centrale interne meldingen**
   - Voeg een afgeschermde ontvangerslijst toe met standaard `info@zpzaken.nl` en Boy.
   - Maak één gedeelde serverfunctie die interne mails per ontvanger verstuurt en iedere poging apart vastlegt met status en mail-ID.
   - Gebruik deze functie in alle geïnventariseerde routes voor aanvragen, contact, terugbellen, certificaatverzoeken, pauzeren, heractiveren en opzeggen.
   - Laat klantbevestigingen ongewijzigd en stuur bij een mislukte interne melding één apart alarm naar Boy, met bescherming tegen alarmlussen.
   - Voeg onder Instellingen een admin-only scherm toe om ontvangers te beheren.

2. **Adminrechten afdwingen**
   - Geef Boy naast zijn bestaande supervisorrol de adminrol, zodat terugval mogelijk blijft zonder rechtenverlies.
   - Maak team- en rollenbeheer uitsluitend admin in scherm, serverfunctie en databasebeleid; voorkom zelfpromotie.
   - Maak beide facturatieschakelaars, Exact-/integratiewijzigingen en ontvangersbeheer uitsluitend admin.
   - Controleer alle bestaande supervisor/admin-controles en behoud voor Ellen en Roxy exact hun huidige verzekeringsfuncties.

3. **Toezicht en onveranderbare historie**
   - Bouw een admin-only Activiteitenlog uit gevoelige acties, certificaatversies en interne mailhistorie, met filters op medewerker, actie en datum.
   - Sluit wijzigen en verwijderen van auditregels voor alle gebruikers uit; alleen serverprocessen mogen toevoegen.
   - Log klantlijstexports en downloads met medewerker, tijd en context; rapporteer welke grote exports niet-admins nu kunnen uitvoeren.

4. **Gegroepeerde navigatie**
   - Herbouw de bestaande gedeelde desktop-/mobiele navigatie met de groepen Dashboard, Klanten, Facturatie, Wet DBA, Website en Instellingen.
   - Maak Klanten en Facturatie tabpagina’s die de bestaande schermen hergebruiken; voeg Aanvragen & opzeggingen en de screenings toe.
   - Voeg het profielmenu met Wachtwoord wijzigen toe en combineer Integraties met Exact-koppeling.
   - Behoud alle bestaande beheer-URL’s via interne doorverwijzingen naar de juiste nieuwe tab, zodat bookmarks blijven werken.

5. **Controle en veilige testmails**
   - Test rechten voor admin, supervisor, verzekering en marketing op scherm én server/database.
   - Stuur per interne route één `[TEST]`-melding uitsluitend naar de twee interne ontvangers en controleer twee afzonderlijke geslaagde logregels; stuur geen klantmail.
   - Controleer mobiel en desktopmenu, oude URL’s, filters en activiteitenlog; voer tests en opbouwcontrole uit.
   - Niet publiceren.

## Technische details
- Nieuwe publieke tabel krijgt expliciete grants, RLS en admin-only wijzigbeleid; serverprocessen gebruiken service-role.
- Nieuwe beveiligde functies krijgen een vaste `search_path`, minimale uitvoerrechten en expliciete admincontrole.
- De gedeelde interne mailhelper blijft binnen `supabase/functions/_shared/`; CORS en invoervalidatie blijven per publieke functie gehandhaafd.
- Tests gebruiken alleen `@zpzaken.nl`-adressen en herkenbare `[TEST]`-onderwerpen; logregels worden niet verwijderd.
- Het verslag bevat de volledige mailroute-inventaris, vóór/na-rechtenmatrix, menuboom, exportbevindingen en risico’s.