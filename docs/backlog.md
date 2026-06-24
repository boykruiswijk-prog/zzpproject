# Backlog

## Portal v1.1 — Facturen
- **PaymentStatus enrichment via Exact ReceivablesList**: aanvullende call om "Betaald" status te tonen op /portal/facturen. Nu wordt status afgeleid uit DueDate (open/vervallen). Endpoint: `read/financial/ReceivablesList` of `crm/AccountsInvoicesList`. Match op `InvoiceID` of `InvoiceNumber`.
