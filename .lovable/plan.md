# Inventarisatie opzeggingen (alleen lezen, geen wijzigingen)

Dit is een rapport, geen bouwplan. Er wordt niets gewijzigd.

## 1. Bestanden

- `src/components/admin/OpzeggingenKlant.tsx`
  - `OpzeggingenKlant` (r. 54-187): kaart "Opzeggingen" op de klantpagina, met koppelen en verwerken. Laadt r. 66: `.eq("type", "opzeggen").eq("onderneming_id", ondernemingId).is("gekoppeld_aan", null)`.
  - `OpzeggingenTeKoppelen` (r. 190-230): lijst "Opzeggingen te koppelen" op /admin/klanten#opzeggingen. r. 197-198: alleen niet verwerkt, `gekoppeld_aan IS NULL`, en `koppeling_status !== "zeker"`.
- `src/pages/admin/KlantDetail.tsx` r. 11 en 104: toont `OpzeggingenKlant`.
- `src/components/admin/ServiceAanvraagDetail.tsx` r. 107 (koppelingslabel), r. 111-114: `KoppelZoeker` als de opzegging nog niet verwerkt is.
- `src/components/admin/KoppelZoeker.tsx` r. 58: `supabase.rpc("koppel_opzegging", ...)`.
- `src/components/admin/ServiceAanvraagOog.tsx`: de oog-knop die de melding opent (met koppelen).
- `src/components/admin/DashboardStats.tsx` r. 71: de dashboardtegel "Opzeggingen te koppelen" (tellers komen uit een databasefunctie).
- Databasefuncties: `koppel_opzegging`, `verwerk_opzegging`, `plan_opzeg_credit`.

## 2. Wat "Opzegging verwerken" doet

Front-end, `OpzeggingenKlant.tsx` r. 96:
`supabase.rpc("verwerk_opzegging", { _aanvraag_id: a.id, _contract_ids: Array.from(gekozen) })`.
Er wordt geen serverfunctie (edge function) aangeroepen.

Databasefunctie `verwerk_opzegging`:
- Controles: teamlid; aanvraag bestaat en heeft type 'opzeggen'; nog niet verwerkt; gekoppeld en `koppeling_status = 'zeker'`; minstens één contractregel; geldige opzegdatum van ontvangstdatum tot 180 dagen later.
- Per gekozen contractregel (moet bij dezelfde klant horen en status actief/loopt_af/einddatum_controle hebben):
  - `klant_contracten`: `eind_datum = opzegdatum`, `status = 'loopt_af'`, en `afwijkingen` krijgt "opgezegd per DD-MM-YYYY".
  - `sensitive_audit_log`: een regel met actie 'opzegging_verwerken'.
  - `plan_opzeg_credit(...)`: maakt of werkt een regel in `factuur_credit_planning` bij en logt een statuswijziging. De status wordt standaard `wacht_op_akkoord` (eerst akkoord van Ellen). Andere mogelijke statussen: `concept_niet_verwerkt`, `geblokkeerd`, `niet_nodig`. Cyber Clear 2026-10-08 wordt nooit tussentijds gecrediteerd.
- Daarna, in `klant_service_aanvragen`: `opzegging_verwerkt_op = now()`, `opzegging_verwerkt_door = auth.uid()`, en `status` wordt 'afgerond' als die nieuw of in_behandeling was.

Exact en mail:
- Exact: deze functies schrijven niet naar Exact. Er wordt alleen een creditnota gepland in `factuur_credit_planning`. Een echte creditnota in Exact komt pas na goedkeuring, via de bestaande creditflow.
- Mail: in deze functies en in de knop zit geen mail naar de klant. Of triggers op `klant_contracten` of `klant_service_aanvragen` mail versturen, heb ik in deze ronde niet gecontroleerd. Dat kan ik als volgende stap nakijken.

## 3. Als koppeling_status 'niet_gekoppeld' is

Verwerken is dan geblokkeerd, op twee plekken:
- Scherm, `OpzeggingenKlant.tsx` r. 161-163: als `a.koppeling_status !== "zeker"` verschijnt alleen de knop "Koppeling met deze klant bevestigen" (roept `koppel_opzegging` aan, r. 88). De knop "Opzegging verwerken" is dan niet te zien.
- Server, `verwerk_opzegging`: `IF a.onderneming_id IS NULL OR a.koppeling_status <> 'zeker' THEN RAISE EXCEPTION 'bevestig eerst de koppeling met de klant'`. Ook een directe aanroep van de functie wordt dus geweigerd.

`koppel_opzegging` zet `onderneming_id`, `koppeling_status = 'zeker'`, `koppeling_methode = 'handmatig'` en `koppeling_details.handmatig_door/vorige`, en schrijft een regel 'opzegging_koppelen' in `sensitive_audit_log`. Een opzegging die al verwerkt is, wordt geweigerd.
