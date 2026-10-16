# Afspraken _shared
- Interne cyberwaarden staan alleen in cyberIntern.ts (edge functions en admin-modules); build en tests controleren bronimports en publieke chunks. Waarom: nooit interne limieten publiek.

- Exact-tokenrefresh en 401-race-herstel staan in _shared/exactToken.ts. Waarom: één plek voor tokenlogica.
- Live Exact-factuurstatussen worden read-only opgehaald via supabase/functions/_shared/exactInvoiceStatus.ts. Waarom: één veilige bron voor keepalive en polis-lifecycle zonder Exact-wijzigingen.
- Exact-administratietoegang wordt gecontroleerd op de geconfigureerde divisie via _shared/exactDivision.ts; CurrentDivision is alleen informatief. Waarom: de laatst geopende Exact-administratie mag geen vals alarm veroorzaken.
