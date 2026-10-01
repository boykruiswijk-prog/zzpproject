# Plan: lopende AFAS-contracten inlezen in het CRM (alleen inlezen en tonen)

## Vooraf gecontroleerd (alleen gelezen)
- De brontabel heeft 1.355 regels. Met de selectie (type V/L, geen TESTAB01, "gefactureerd t/m" gevuld) blijven er 1.105 regels van 848 relaties over. MRR is 42.222,47; dat klopt met jouw cijfers.
- 290 relaties staan in de mandaatimport en 18 regels hebben een einddatum.
- Voorkomende itemcodes: 100-OUD, 100-OUDJ540/600/660, 100-OUDM50/55/60, 100HDI, 100J, 100J495, 100M, 102-OUD, 102J, 400, 425, 450 en Nimble. Ze zijn allemaal te koppelen, dus nu staat er geen onbekende code in.
- Er staan nu 16 ondernemingen, allemaal testrecords. De bestaande policies: team mag lezen, supervisor/admin mag schrijven, allemaal `TO authenticated`.

## 1. Datamodel (één migratie)
- **`ondernemingen`** krijgt de kolommen `exact_relatie_code` (uniek), `afas_contactpersoon` en `bron`. De bestaande 16 testrecords blijven staan.
- **`personen` / `persoon_onderneming`** worden hergebruikt:
  - dedupe op `genormaliseerd_email`;
  - mail werk en mail werk 2 worden allebei een persoon, alleen als er een adres is;
  - de unieke koppeling (persoon_id, onderneming_id) bestaat al.
- **Nieuwe tabel `klant_contracten`** met de velden uit jouw voorstel:
  - uniek op (bron, bron_rij);
  - `type` (verzekering/lidmaatschap), `product` en `cyclus` (maand/jaar), elk afgedwongen met een eigen enum;
  - `volgende_factuurdatum` = gefactureerd_tm + 1 dag;
  - `maandwaarde` als berekende kolom: waarde × aantal, gedeeld door 12 bij jaar;
  - `status`: actief / loopt_af / vervangen;
  - `facturatie_status`: standaard 'wacht_op_akkoord';
  - `afwijkingen text[]`, `is_test` en tijdstempels.
- **Mandaat**: een view `klant_mandaat_v` die alleen leest uit `exact_mandaat_import` op relatiecode. Er komt geen kolom bij en er wordt niets gewijzigd.
- **RLS en rechten** op `klant_contracten`:
  - GRANT alleen aan authenticated en service_role, anon krijgt niets;
  - lezen: `is_team_member`; schrijven: `is_supervisor_or_admin`; allebei `TO authenticated`;
  - de view draait met `security_invoker`.

## 2. Triggercheck (bewijs dat er niets uitgaat)
Op deze tabellen bestaan nu alleen de triggers `trg_ondernemingen_updated` en `trg_personen_updated`. Beide roepen `update_updated_at_column()` aan, die alleen een tijdstempel zet. `persoon_onderneming` en `exact_mandaat_import` hebben geen triggers. Er zit dus geen mail, functie-aanroep of Exact-call aan vast.
- De nieuwe tabel krijgt alleen een updated_at-trigger.
- De import raakt `leads`, `policies`, `invoices`, `persoon_bron_koppeling` en `activiteiten_log` niet aan. Daardoor gaan de triggers voor leads/persoonskoppeling, uitnodigingen en Exact niet af.
- Na de import controleer ik dat er geen nieuwe rijen zijn bijgekomen in `email_send_log`, `lead_notification_log`, `exact_sync_log`, `leads`, `policies` en `portal_invitations` (tellingen vóór en na).

## 3. Importlogica
Eén functie `public.importeer_afas_20261001()`:
- SECURITY DEFINER met vaste search_path;
- EXECUTE alleen voor service_role, dus niet voor anon of authenticated;
- ik draai hem eenmalig.

Stappen:
1. **Selectie**: dezelfde selectie als boven. De 3 nooit gefactureerde regels, het type P en TESTAB01 vallen er vanzelf buiten.
2. **Mapping**:
   - itemcode → product via een CASE: 100*/100-OUD* = BAV-AVB, 102* = Cyber Clear, 450/400/425 = lidmaatschap All-in/Start-up/Light, Nimble = Nimble BAV;
   - een andere code wordt `onbekend` en krijgt de afwijking "onbekende itemcode";
   - datums YYYYMMDD → date, leeg wordt NULL; bedragen met komma worden numeric.
3. **Upserts**: onderneming op relatiecode, persoon op e-mail, koppeling met ON CONFLICT DO NOTHING, contract op (bron, bron_rij) met DO UPDATE. Opnieuw draaien geeft dezelfde set.
4. **Afwijkingen**:
   - 609 → status `vervangen` ("verouderde periode, vervangen door rij 610");
   - 610 → "facturatie loopt achter";
   - 1092 → "correctieregel";
   - 960 en 1978 → "cyclus wijkt af van product";
   - einddatum gevuld → `loopt_af` ("loopt af op dd-mm-jjjj");
   - GG Tech 2007261/2009368 → "relatiewissel", op beide klanten;
   - relatie zonder enig e-mailadres → afwijking "geen e-mail" op het klantrecord.
5. De functie geeft een samenvatting als JSON terug: aantallen per stap.

## 4. Reconciliatie
De view `klant_contracten_reconciliatie` toont:
- bron: 1.105 regels / 848 relaties / MRR 42.222,47 / ARR 506.669,68, rechtstreeks berekend uit de ruwe tabel;
- CRM-totaal: dezelfde cijfers uit `klant_contracten`;
- actief (zonder `vervangen`): 1.104 regels / MRR 42.167,47 / ARR 506.009,68;
- een vlag "klopt ja/nee" per regel.

De beheerpagina leest die view via een RPC alleen voor het team, omdat de ruwe schema-tabel niet direct leesbaar is.

## 5. Schermen
- Nieuwe pagina **/admin/klanten** ("Klanten & contracten"), in dezelfde stijl als het CRM (tabel met afkapping en tooltip, statuslabels uit `statusLabels.ts`, dd-mm-jjjj, `useToonTestrecords`):
  - kolommen en filters zoals jij ze beschreef;
  - een rode banner: "Facturatie vanuit het CRM staat nog uit — wacht op akkoord.";
  - het blok "Reconciliatie" en de kaart "Facturatie-agenda": de komende 12 maanden, maand en jaar apart, berekend in de browser uit volgende_factuurdatum plus de cyclus.
- **/admin/klanten/:id**: klantgegevens, gekoppelde personen, mandaat ja/nee (alleen lezen, met gemaskeerde IBAN) en contractregels met hun planning.
- In het bestaande **CRM** krijgt een persoon die aan zo'n onderneming hangt de badge "Klant (AFAS)" met een link naar de klantdetailpagina. De sales-pipeline en leadtellers veranderen niet.
- Er komt een menu-item bij in het beheer.

## 6. Testen zonder bijwerkingen
- Eerst een droge run: de selectie- en mappingquery als SELECT, met vergelijking van de tellingen.
- Daarna de import één keer en dan een tweede keer: de tellingen moeten gelijk blijven (idempotent).
- Tellingen vóór en na van de mail-, Exact-, lead-, polis- en uitnodigingstabellen (zie 2). Ik controleer ook dat de cron voor maandfacturen uit blijft.
- Unit-tests voor de productmapping, de afwijkingsregels en de agenda-berekening, plus een anon-test dat `klant_contracten` niet leesbaar is.
- Screenshots op 1280 en 1440 px; daarna build, tests, typecontrole en security-scan. Niet publiceren.

## Vragen
1. **Contactpersoon**: AFAS heeft één naam en twee mailadressen. Moet de naam aan beide adressen gekoppeld worden? Of moet mail werk 2 een aparte persoon zonder naam worden?
2. **Lidmaatschap**: tellen lidmaatschappen (400/425/450) mee in MRR/ARR? In jouw controlecijfers zitten ze nu mee.
3. **Mail werk 2**: mag een tweede adres dat al bij een andere relatie hoort aan beide klanten gekoppeld worden? Mijn voorstel is ja, met de afwijking "e-mail gedeeld".
4. **Klant uit AFAS die al een lead is**: moet ik zo'n klant automatisch koppelen, of alleen tonen als "mogelijke match"? Mijn voorstel is alleen tonen, zonder iets te wijzigen.
