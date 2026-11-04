# De Directietafel: besluit Boy 4 november 2026

## Uitgevoerd, zonder Exact-mutaties of klantmail

- Cyber `17b3e297-c26c-44e1-8c28-d05e370ccb18`: einddatum en cyber-einddatum **3-11-2026**, premie **0**. Bestaande opzeg-audit blijft behouden. Exacte reden in audit: `coulance Boy 4-11, opgezegd binnen enkele uren na aanvraag`.
- BAV+AVB `f0663015-436b-4ea7-971c-bf58513c1ddd`: **maand, €55**, artikel `100M`, vanaf **3-11-2026**. `gefactureerd_tm = 2026-11-02`, `volgende_factuurdatum = 2026-11-03`. Eerste maandperiode **3-11 t/m 2-12-2026**.
- Prijsbron: `_shared/starterTarief.ts`, `STARTER.naMaandprijs = 55`, inclusief kosten en assurantiebelasting. Geen KvK-startdatum in lead, aanmelding, onderneming of opgeslagen KvK-profiel. Geen recht op startertarief aangetoond; geen betaalde KvK-opvraag uitgevoerd.
- Beide `facturatie_status`-waarden blijven **planner**. Geen algemene pauzeknop of cyberregel gewijzigd.
- Oud Exact-concept `c7903349-10cf-4a97-92bb-451c7720d194`, **€850**, datum **3-11-2026**, cache-status **20**, nummer **NULL**, blijft in Exact onaangeroerd. Lokaal bewust vervallen om **06:18:45 UTC**, niet als verwijderd of verwerkt voorgesteld. ID en bedrag blijven voor historie behouden.
- Geen planningrijen voor het oude activatieconcept. Geen tweede actieve planning per periode; geen creditnota aangemaakt.

## Roxy en Ellen

**Roxy: verwijder concept De Directietafel €850 van 3-11; daarna komt een maandfactuur van €55.** De planner maakt die maandfactuur bij een volgende normale run; in deze opdracht is geen factuur gemaakt en geen Exact-write uitgevoerd. Roxy mag het oude concept niet verwerken.

Geen automatische individuele cyberaanmeld-/intrekroute of bewijs van verzending aan de verzekeraar gevonden in de onderzochte code en registraties. Dat bewijst niet dat er geen externe aanmelding bestaat. **Ellen moet controleren of de verzekeraar de aanmelding al heeft ontvangen en of intrekken per 3-11 nodig is.** Niets bij de verzekeraar uitgevoerd.

## SQL-bewijs: daadwerkelijk teruggelezen

```sql
SELECT id, product, cyclus, bedrag_per_periode, eind_datum,
       cyber_einddatum, gefactureerd_tm, volgende_factuurdatum,
       facturatie_status
FROM public.klant_contracten
WHERE onderneming_id = '0c04440f-2ffc-45ee-8865-297cbc1d6360';
```

| Contract | Cyclus | Premie | Einddatum | Gefactureerd t/m | Volgende datum | Facturatiestatus |
|---|---|---:|---|---|---|---|
| f0663015 | maand | 55 | NULL | 2026-11-02 | 2026-11-03 | planner |
| 17b3e297 | jaar | 0 | 2026-11-03 | 2027-11-02 | 2027-11-03 | planner |

Cyber heeft nog de oude historische factuurstand; er komt geen vervolgfactuur doordat een bewezen opzegging vóór de volgende periode ligt en de premie nul is. Die stand is niet als werkelijk verwerkt verklaard of verder gewijzigd.

```sql
SELECT exact_invoice_id, exact_invoice_status, exact_invoice_number,
       exact_invoice_vervallen_op, exact_invoice_verwijderd_op
FROM public.leads WHERE id='7b647360-831d-4a50-8be3-4417ee47cf47';
-- c7903349-10cf-4a97-92bb-451c7720d194 | 20 | NULL
-- vervallen_op 2026-11-04T06:18:45.601216Z | verwijderd_op NULL

SELECT count(*) AS open_controles
FROM public.leads
WHERE id='7b647360-831d-4a50-8be3-4417ee47cf47'
  AND exact_invoice_id IS NOT NULL AND exact_invoice_number IS NULL
  AND coalesce(exact_invoice_status,0) <> 50
  AND exact_invoice_vervallen_op IS NULL;
-- 0; dezelfde vervallenfilter is aanwezig in menu_tellers en mijn_acties_vandaag_basis

SELECT klant_contract_id, periode_start, count(*)
FROM public.factuur_planning
WHERE klant_contract_id IN ('f0663015-436b-4ea7-971c-bf58513c1ddd',
                           '17b3e297-c26c-44e1-8c28-d05e370ccb18')
  AND status NOT IN ('vervangen','tijdelijk')
GROUP BY 1,2 HAVING count(*) > 1;
-- 0 rijen

SELECT actie, details->>'reden' AS reden FROM public.sensitive_audit_log
WHERE actie IN ('coulance_boy_20261104','betaalcyclus_boy_20261104',
                'concept_bewust_vervallen_boy_20261104');
-- 3 auditregels, alle met de exacte coulancereden
```

De eerste maand is SQL-readonly gecontroleerd: bedrag 55, periode 3-11 t/m 2-12, bestaande periode 0, mapping bevestigd, Exact-item `7061187b-4aaf-4e74-b347-4b5a1464c97b`, geen ondernemingsblokkade. De bestaande planner heeft een unieke actieve contract/perioderegistratie. Geen dagrun aangeroepen omdat Boy Exact-writes in deze beurt uitsluit.

## Technische controle

- 18 gerichte tests geslaagd; volledige suite na herhaling met 2 workers: **2054 geslaagd, 1 bestaande overgeslagen**. Eerste brede run had uitsluitend drie belasting-timeouts.
- Nieuwe SQL-trigger-test gebruikt een echte generated maandwaarde en bewaakt de exacte contract-/ondernemings-/auditbegrenzing. De eerdere guard las maandwaarde vóór berekening; dit is specifiek hersteld.
- Automatische build: **OK**. Geen aparte handmatige build/typecheck gestart.
- `exact-concept-controle` uitgerold; startcontrole zonder bevoegdheid **401 geen_toegang**, geen mail of Exact-effecten.
- Eén wijzigingsmelding aan Ellen, onderdeel admin, met het expliciete Roxy-blok. Geen publicatie.

## Gewijzigde bestanden

- `drizzle/migrations/0237_directietafel_coulance_concept_vervallen.sql`
- `drizzle/migrations/0238_directietafel_coulance_generated_guard.sql`
- `supabase/functions/_shared/conceptControle.ts`
- `supabase/functions/exact-concept-controle/index.ts`
- `src/pages/admin/LeadDetail.tsx`
- `src/lib/veiligeKolommen.ts`
- `src/test/directietafelCoulance.test.ts`
- `supabase/functions/AGENTS.md`, `roadmap.md`, dit rapport
- Automatisch: `src/integrations/supabase/types.ts` en migratiemetadata