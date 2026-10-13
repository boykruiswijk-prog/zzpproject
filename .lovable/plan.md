# Inventarisatie korting en acceptatie (alleen lezen, niets gewijzigd)

## A) Korting

- **Prijs aanpassen in beheer: dat kan nu niet.** Ik vond geen scherm en geen functie die `bedrag_per_periode`, `afw_prijs` of `org_prijs` van een `klant_contracten`-regel wijzigt.
  - De enige update vanuit de code is `supabase/functions/factuur-planner/index.ts` r. 274. Die zet alleen `gefactureerd_tm`, `volgende_factuurdatum` en `gefactureerd_tm_bron`.
  - `src/pages/admin/KlantenContracten.tsx` r. 66 leest `bedrag_per_periode` alleen.
  - Een prijswijziging wordt dus nergens gelogd, want die kan niet.
- **Herkomst van de lage prijzen: de AFAS-import van 1 oktober.** Alle 23 lopende regels met een `afw_prijs` lager dan `org_prijs` hebben bron `afas_20261001`. Het zijn er 22 met status actief en 1 met status loopt_af. Ze zijn allemaal op 2026-10-01 aangemaakt.
  - Vindplaats: `drizzle/migrations/0022_klant_contracten_afas_import.sql`, r. 123-136 (insert) en r. 160 (bij opnieuw importeren).
  - `bedrag_per_periode` komt uit AFAS-kolom 15, `org_prijs` uit kolom 13 en `afw_prijs` uit kolom 14.
  - De korting is dus overgenomen uit AFAS, niet in beheer gemaakt.

## B) Acceptatie

- **Een apart scherm "acceptatie" bestaat niet.** De route en het menu-item met die naam vond ik niet. Het meest voor de hand liggende scherm is "Aanvragen":
  - Route: `src/App.tsx` r. 234, `/admin/aanvragen`, getoond met `AdminLeads soort="aanvragen"` (`src/pages/admin/Leads.tsx`).
  - Tabel: `src/components/admin/LeadTable.tsx`. De gegevens komen uit `src/hooks/useLeads.ts` r. 43: tabel `leads`, met `type = 'verzekering_aanvraag'`.
  - Menu: `src/components/admin/AdminSidebar.tsx` r. 21.
  - Detailpagina: `src/pages/admin/LeadDetail.tsx`, via de oog-knop.
  - Klopt dit met wat Ellen bedoelt? Zo niet, noem dan het scherm.
- **Statussen:** het hele `lead_status`-overzicht is te kiezen in de statuskeuze (LeadTable r. 302-325, labels uit `src/lib/statusLabels.ts`):
  - nieuw, in_behandeling, afspraak_gepland, offerte_verstuurd, klant, afgewezen, nieuw_te_beoordelen ("Te beoordelen"), actief, gepauzeerd, opgezegd, afgerond.
  - "Afgerond" verschijnt alleen als `magAfronden`; "offerte_verstuurd" alleen als de lead die status al heeft.
- **Kolommen per persoon** (LeadTable r. 239-246):
  - Naam (met bedrijfsnaam, BAV-nummer en onderwerp), Type (badge), Contact (mail- en bellink), Verzekering, Pakket, Status, Datum.
  - Bij Acties: oog naar de detailpagina, de testschakelaar, en verwijderen (alleen Boy).
- **Bestaande vlag, notitie, herinnering of wachtstatus:**
  - `leads.vereist_handmatige_beoordeling` bestaat. Hij wordt gezet in `src/components/home/BAVApplicationModule.tsx` r. 420 (meer dan 3 medewerkers) en in `src/pages/OffertePage.tsx` r. 188. Hij wordt nergens in beheer getoond, en de vlag staat nu bij 0 leads aan.
  - Status `nieuw_te_beoordelen` ("Te beoordelen") bestaat. Hij wordt alleen meegeteld als "Nieuw" in `src/components/admin/SupervisorKpiPanel.tsx` r. 176.
  - Notities: `lead_notes` via `src/components/admin/LeadNotes.tsx`, op LeadDetail r. 20 en 381. In de lijst is er geen icoon voor.
  - `crm_taken` bestaat, maar alleen met de soorten afas_factuur_opvragen, exact_aanpassen en nieuwe_aanvraag_nodig. Een acceptatietaak bestaat niet.
  - Een herinneringskolom of wachtstatus voor acceptatie bestaat niet.
