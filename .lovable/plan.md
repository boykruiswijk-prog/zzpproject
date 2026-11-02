# Conversieonderzoek aanvraagformulier (A16) - analyse en voorstel

Alleen analyse. Na akkoord wordt er niets gebouwd; dit is het rapport plus het voorstel waarover Boy beslist.

## 1. Wat de bezoeker per stap moet doen

- **Stap 1 Pakket/start**: pakket en betaalwijze kiezen, ingangsdatum (verplicht, vroegst morgen, max 6 maanden; een te vroege datum wordt automatisch teruggezet), e-mail en telefoon (verplicht, formaatcontrole). Met cyber: cybervragen verplicht.
- **Stap 2 Onderneming**: bedrijfsnaam*, KvK-nummer* (alleen formaatcontrole, 8 cijfers; geen live KvK-opzoeking door A12), sector* (keuzelijst), werkzaamheden* (max 1.000 tekens), functie (optioneel, maar wordt getoetst aan de afwijzingslijst en kan blokkeren), aantal medewerkers* (meer dan 3: oranje melding, blokkeert niet). Uitklapblok startertarief: KvK-startdatum optioneel, en het KvK-uittreksel uploaden is verplicht als het startertarief geldt en de KvK-koppeling niet werkt.
- **Stap 3 Contact**: voornaam*, achternaam*, opdrachtgever (optioneel), ja/nee keuze over aanvragen via een derde, met naam verplicht bij ja.
- **Stap 4 Incasso**: straat*, huisnummer*, postcode* (1234 AB), plaats* (wordt automatisch gevuld via postcode+huisnummer), IBAN* (controlegetal; fout: "Ongeldig IBAN-nummer"), naam rekeninghouder* (voorgevuld), land* (staat onder IBAN, standaard Nederland), daaronder de volledige SEPA-machtigingstekst met verplicht vinkje ("Vink het vakje aan om de SEPA-machtiging te geven").
- **Stap 5 Controle**: samenvatting, slotverklaring* en bij cyber het cyberakkoord*.
- Foutmeldingen verschijnen pas na "Volgende", per veld onder het veld.

**Mobiel (uit de opbouw, nog geen schermafdruk)**: staplabels verdwijnen, alleen icoontjes. Stap 2 is één lange kolom van 7 velden plus een dichtgeklapt starterblok. Stap 4 houdt ook op mobiel drie kolommen: straat/huisnr en postcode/plaats staan krap naast elkaar; daaronder IBAN, rekeninghouder, land en een lange machtigingstekst, zodat het vinkje en de knop ver onder in beeld staan.

## 2. Meting afgelopen 21 dagen (niet-test)

Afhakers per hoogste stap komen overeen met jouw cijfers. Geregistreerde validatiefouten (niet per concept te koppelen, alleen totalen):

```text
Stap 2: kvkNummer 18, functie 5, aantalMedewerkers 2
Stap 4: iban 18, incassoAkkoord 8, adresStraat 7, adresPlaats 7, postcode 3, huisnr 1
```

- Stap 2: de KvK-formaatfout is veruit het grootst (18 keer bij 10 afhakers plus doorstromers). Een falende KvK-opzoeking speelt niet: die bestaat niet in het formulier. Afhakers op stap 2 vertrekken gemiddeld binnen 1 minuut, vooral vanaf de startpagina.
- Stap 4: IBAN-fout 18 keer; straat/plaats-fouten (7) wijzen erop dat het automatisch invullen van het adres niet altijd lukt; 8 keer het machtigingsvinkje vergeten. Afhakers op stap 4 blijven 3 tot 14 minuten: ze proberen het, dus het is wrijving, geen desinteresse.
- Laadtijd: geen meting beschikbaar. Mijn activiteiten/logs bevatten geen formulierfouten; niet verder te onderbouwen.

## 3. Voorstel: drie kleinste wijzigingen met de grootste verwachte winst

1. **KvK-veld stap 2 vergevingsgezind maken**: spaties, punten en "KvK" tijdens het typen al wegfilteren en direct onder het veld tonen "8 cijfers, staat op je KvK-uittreksel"; foutmelding tonen zodra het veld verlaten wordt in plaats van pas na Volgende. Geen opzoeking, geen KvK-kosten.
2. **IBAN-veld stap 4**: tijdens typen automatisch in groepjes van 4 zetten en hoofdletters, direct bij verlaten van het veld controleren, en bij een fout zeggen wat er mis is ("Dit IBAN klopt niet, controleer de cijfers" of "Een Nederlands IBAN heeft 18 tekens"). IBAN-veld en machtigingsvinkje blijven verplicht; SEPA-tekst byte-gelijk.
3. **Stap 4 mobiel en adres**: op mobiel adresvelden onder elkaar; postcode en huisnummer bovenaan zodat het adres automatisch invult, straat/plaats daarna; bij een fout scrollen naar het eerste foutveld (inclusief het machtigingsvinkje).

Verwachte winst: de 7 afhakers op stap 4 zijn de waardevolste groep (alles al ingevuld); 2 en 3 richten zich daar op. Exacte winst valt niet te voorspellen bij deze aantallen.

Grenzen: geen prijzen, tracking-id's, SEPA-tekst, aanvraaglogica, mails of AFM-teksten wijzigen.

## Technische details

- Bronnen: `BAVApplicationModule.tsx` (validateStep, stap 2/4), `aanvraag_concepten.max_stap/pagina`, `aanvraag_validatiefouten` (formulier, stap, veld; geen concept-id).
- Niet gecontroleerd: echte mobiele schermafdrukken, laadtijd, foutverdeling per afhaker, de precieze KvK-melding die verscheen.
- Aanbevolen extra meting (optioneel): concept-id meesturen bij validatiefouten om fouten aan afhakers te koppelen.
