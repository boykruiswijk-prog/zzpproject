# Status MFA op interne serverfuncties (besluit Boy 19 okt 2026)

## Afgerond
- MFA-controle toegevoegd aan 24 interne team- en adminfuncties (Exact, gebruikers aanmaken, export, activeren, polis/CRM, verzending, artikelen). Bestaande rolrechten zijn gebleven.
- 28 bewust publieke of afzonderlijk beveiligde functies (formulieren met spamcontrole, cron-, internal-secret-, webhook-, OAuth-callback- en schermtoegang) staan als uitzondering in de nieuwe inventaristest.
- Tests: 115/115 gericht groen. Volledige set: 5 oudere fouten bij Exact en redirects, die niets met deze wijziging te maken hebben. Bouwcontrole groen.

## Open
- De nieuwe controles zijn nog niet live: de functies zijn niet gedeployed en er is niets gepubliceerd.
- De browsercontrole van het admin-dashboard als supervisor met MFA kon niet worden gedaan. De beschikbare sessie heeft geen tweestapsverificatie (aal2).

## Voorstel volgende stap (alleen na uw akkoord)
1. De 24 aangepaste functies deployen. Er wordt niets publiek gezet en er worden geen functies aangeroepen.
2. U logt in de preview in met tweestapsverificatie. Daarna controleer ik het dashboard, de export en de Exact-koppelknop in de browser.
3. Eén gewone wijzigingsmelding voor Ellen, pas bij publicatie.

Geen wijzigingen aan data, prijzen, facturatie, SEPA of klantmails.
