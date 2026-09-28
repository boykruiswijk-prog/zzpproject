# Technische afspraken

- SEPA-machtigingstekst staat in src/lib/sepaMachtiging.ts en supabase/functions/_shared/sepaMachtiging.ts (byte-gelijk, afgedwongen door src/test/sepaMachtiging.test.ts); bewijs in sepa_machtiging_bewijs (onveranderbaar via trigger). Waarom: de getoonde en de vastgelegde tekst mogen nooit uiteenlopen.
