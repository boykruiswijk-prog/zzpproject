# SEPA-incasso en polis-pauze (B1-flow)

## Context

Bij **pauze** of **opzegging** van een polis maakt `polis-lifecycle` automatisch een **creditnota
Type 21** aan in Exact Online (status 20 = Concept). Dat regelt de boekhouding, maar het stopt
**niet** automatisch een eventuele lopende SEPA-incasso.

De Exact REST API biedt geen endpoint om regels uit een SEPA-batch te verwijderen of een batch
te annuleren. Dat moet handmatig door de administratie.

## Wanneer is actie nodig?

| Originele factuur-status | Actie SEPA |
| --- | --- |
| **20** (Concept / Open) | Geen actie — er is nog geen incassobatch |
| **50** (Definitief / verwerkt) | **Handmatig stoppen** (zie hieronder) |

`lead.exact_invoice_status` houdt deze waarde bij. De admin-pagina **Lead-detail → Polis-lifecycle**
toont een amber-banner zodra een polis in `gepauzeerd` staat met `exact_invoice_status = 50`.
De klant-modal toont in dat geval de zin: *“Onze administratie zet de SEPA-incasso stop. Mocht je
een eerstvolgende incasso binnenkort verwachten, neem dan contact op via 020-4573077.”*

## Procedure voor Sandra

1. Open Exact Online → administratie **ZP Zaken B.V.** (4401707)
2. Ga naar **Cashflow → Incasso → Batches** (Direct Debit Batches)
3. Filter op status **Open** of **Te verwerken**
4. Open de eerstvolgende batch
5. Zoek de regel met **Uw referentie** = `lead.id` (eerste 30 tekens, getrunceerd door Exact)
6. Klik **regel verwijderen** of selecteer en kies **Uit batch halen**
7. Sla op

> Tip: in het amber-bannerblok op de admin-pagina staat de `lead.id` voluit; vergelijk de eerste
> 30 tekens met het YourRef-veld in Exact.

## Volledige flow-diagram (pauze)

```
Klant klikt "Pauzeren"
      │
      ▼
calculate-pauze-preview  ──► toont bedrag in modal
      │ (klant vinkt akkoord)
      ▼
polis-lifecycle (action=pauzeren)
      │
      ├─► Exact: POST SalesInvoices Type 21 (creditnota, status 20)
      │        YourRef = lead.id
      │        ↳ lead.exact_credit_invoice_id_pauze opgeslagen
      │
      ├─► leads.status = 'gepauzeerd'
      ├─► polis_audit_log: 'creditnota_aangemaakt' + 'pauzeren'
      ├─► mail klant + info@zpzaken.nl  (+ info@onefellow.nl bij geen_opdrachten)
      │
      ▼
[Indien originele factuur status 50]
Sandra controleert Exact → Cashflow → Incasso →
verwijdert regel uit eerstvolgende batch
      │
      ▼
Klaar — netto effect: klant betaalt alleen verbruikte dagen
```

## Hervatten

`polis-lifecycle` (action=hervatten) maakt een **nieuwe factuur Type 20** (Concept) voor de
resterende dagen tot `polis_einddatum`. Sandra verwerkt deze normaal: status 50 → batch.
Geen handmatige SEPA-actie nodig — er zat nog niets in een batch.
