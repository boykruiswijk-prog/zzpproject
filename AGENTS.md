# Technische afspraken

- SEPA-machtigingstekst staat in src/lib/sepaMachtiging.ts en supabase/functions/_shared/sepaMachtiging.ts (byte-gelijk, afgedwongen door src/test/sepaMachtiging.test.ts); bewijs in sepa_machtiging_bewijs (onveranderbaar via trigger). Waarom: de getoonde en de vastgelegde tekst mogen nooit uiteenlopen.
- Exact-tokenrefresh (incl. 401-race-herstel) hoort in supabase/functions/_shared/exactToken.ts; gebruikt door exact-email-bulk, exact-keepalive en monthly-invoices-cron, overige functies volgen bij M4. Waarom: één plek voor tokenlogica.
- Mijn ZP-toegang (gebruiker aanmaken, polissen koppelen, magic link, mail+log) staat in supabase/functions/_shared/portalAccess.ts; klanten lezen leadvelden alleen via RPC get_mijn_polissen. Waarom: één toegangsroute en geen klant-SELECT op leads.
