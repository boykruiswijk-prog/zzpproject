# Publieke collectiefteller verwijderen

## Aanpak
- Verwijder de openbare database-opvraag, deelnemeraantallen, doelen en voortgangsbalken van de collectiefkaarten.
- Vervang deze onderdelen door korte, eerlijke teksten en de CTA “Reserveer je plek”, vertaald in Nederlands, Engels, Duits en Frans.
- Verwijder ook vaste aantallen en minimumclaims uit publieke stappen, FAQ’s en pilotteksten; controleer menu, homepage, ledenorganisaties, zoektekst en SEO/prerenderinhoud.
- Houd de bestaande aanmeldgegevens en telling intact en toon de aantallen per pilot alleen in het afgeschermde beheer voor admin/supervisor.
- Voeg gerichte tests toe die voorkomen dat openbare collectieftellers of vaste deelnemersdoelen terugkomen.
- Controleer de collectiefpagina en het menu visueel op 1280 en 390 px en draai build, tests en typecontrole.

## Technische details
- Bestaande formulieren en opslag blijven ongewijzigd.
- De openbare RPC-aanroep verdwijnt uit de pagina; de beheerweergave leest de telling alleen binnen de bestaande rolbeveiliging.
- Er wordt niets gepubliceerd en er worden geen mails of Exact-acties uitgevoerd.
