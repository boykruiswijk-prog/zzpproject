# Beheerpunten Ellen (6 onderdelen)

Volgorde van uitvoering: 4, 1, 3, 2, 5, 6. Testen gebeurt als Ellen in de database. Daarna volgt publicatie. Er wordt niets verwijderd en alles krijgt een auditregel.

## 1. Factuur wacht op Roxy (Santosh, Logineering)
- Een lead met status actief en exact_invoice_status 20 zonder factuurnummer krijgt het label "Factuur staat klaar in Exact, wacht op verwerking door Roxy".
- In Vandaag te doen komt de nieuwe categorie "Facturen te verwerken". Die is alleen zichtbaar voor de facturatierol (Roxy) en admin, en verschijnt niet bij Ellen.
- De bestaande lees-sync voor de factuurstatus draait één keer handmatig. Bij status 50 met een nummer toont de lead het nummer en verdwijnt de actie. De sync leest alleen en wijzigt niets.
- Ik tel en meld hoeveel leads hierop wachten.

## 2. Aanvragen en Leads apart
- Er komen twee menu-items met elk een eigen pagina, op basis van de bestaande leadlijst:
  - **Aanvragen:** verzekering_aanvraag en andere afsluitingen.
  - **Leads:** offerte-aanvraag, contact, terugbelverzoek en overige.
- Filters, zoeken (ook op BAV-nummer), de status Afgerond en het testfilter blijven op beide pagina's gelijk.

## 3. Offerte Kristina Lisniak
- Eerst zoek ik uit of er een automatische offertemail of een verstuurknop bestaat, en waarom die niet verstuurde. De oorzaak meld ik.
- Ik bouw de knop "Offerte versturen" met een voorbeeld vooraf. Die verstuurt via de bestaande mailroute vanaf info@zpzaken.nl en legt de mail vast in het maillog. Pas na een geslaagde verzending wordt de status offerte_verstuurd en komt er een notitie in de tijdlijn.
- De offerte aan Kristina:
  - bovenaan de opgegeven Engelse alinea, daarna de Nederlandse offerte;
  - BAV en AVB in één polis via Hiscox: BAV 5.000.000, AVB 2.500.000 per gebeurtenis, geen eigen risico;
  - 55 euro per maand of 600 euro per jaar, inclusief kosten en assurantiebelasting, dagelijks opzegbaar;
  - een link om direct af te sluiten, met sector ICT vooringevuld;
  - geen tekst over het Verenigd Koninkrijk of het buitenland.
- Dit is één echte klantmail, verstuurd met akkoord van Boy.

## 4. Peschier: één opzegregel
- Nieuwe kolom gekoppeld_aan op klant_service_aanvragen. Regel 362d6d18 wordt gekoppeld aan 719f3202; er wordt niets verwijderd.
- Overzichten en de tijdlijn verbergen gekoppelde regels. Er blijft één regel over: "Opzegging klant 02-10-2026, verwerkt door Ellen op 06-10-2026 per 08-07-2026".
- crm_beeindig werkt voortaan een bestaand open of recent opzegverzoek van dezelfde onderneming bij (laatste 60 dagen) en maakt dan geen nieuwe regel.

## 5. Gegevens wijzigen
- Op de klantkaart van persoon en onderneming komt de knop "Gegevens wijzigen". Die werkt via een nieuwe beveiligde functie, crm_gegevens_wijzigen, en is er voor de rollen verzekering, supervisor en admin.
- Te wijzigen: naam, e-mail, telefoon, bedrijfsnaam, KvK, rechtsvorm en adres (met de bestaande PDOK-postcodecheck).
- IBAN kan alleen een supervisor of admin wijzigen, en het IBAN wordt gemaskeerd getoond.
- Elke wijziging komt in de audit met de oude en nieuwe waarde, plus een regel in de tijdlijn.
- Bij een wijziging van naam, adres of IBAN komt er een taak "Ook in Exact aanpassen" bij Roxy in Vandaag te doen. Exact zelf wordt niet aangepast.

## 6. Tellers in het menu
- Nieuwe functie menu_tellers() telt per menu-item de openstaande items op basis van status en rol, zonder testdata.
- Het gaat om Aanvragen, Leads, Service-aanvragen, Screening, Afgehaakt, Chatgesprekken, Klanten en Facturatie.
- In de zijbalk en het mobiele menu staat een rood bolletje met het aantal. Het ververst elke minuut.
- De tellers kijken alleen naar status. Wat Boy aanklikt, verandert niets aan de tellers van Ellen.

## Aannames, graag corrigeren
- "Roxy" is herkenbaar aan een eigen rol of e-mailadres. Bestaat er geen facturatierol, dan toon ik haar taken aan de rol verzekering met het label "Facturatie (Roxy)".
- Een "recent" opzegverzoek betekent: van de laatste 60 dagen.
- Als de bestaande offertetemplate de gevraagde bedragen niet kan tonen, maak ik een aparte template met dezelfde opmaak.
