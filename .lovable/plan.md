# Inventarisatie BAV-/certificaatnummers (alleen lezen, niets gewijzigd)

## 1. Waar een nieuw ZPBAV-nummer automatisch wordt aangemaakt

Er is één plek waar het nummer echt wordt gemaakt: de trigger `set_certificate_number` op `policies`, die `generate_certificate_number()` aanroept (database, oorspronkelijk `drizzle/migrations/0030_klant_certificaten.sql` r.103-105, nu nieuwer).
- Bij `certificate_number = 'NIEUW'` wordt meteen een nieuw nummer gemaakt (functie r.58-59, daarna r.75-78: `nextval(policy_cert_seq)`, dan `eerste_vrije_certificaatnummer`, dan `'ZPBAV'||vrij`).
- Bij een leeg nummer zoekt de trigger eerst een bekend nummer via `certificaatnummer_voorstel_intern` (r.60-71). **Vindt die niets, dan maakt de trigger zonder melding een nieuw nummer aan (r.75-78).**

Wie maakt die `policies`-rijen aan (alleen `generate-certificate`):
- **Lead-route, risico:** `supabase/functions/generate-certificate/index.ts` r.245-248 stuurt `certificate_number: ""` als `bevestig_nieuw_nummer` niet true is. Heeft de lead geen bekend nummer, dan maakt de trigger stilletjes een nieuw ZPBAV-nummer. Je ziet het nummer pas daarna in de melding (`src/pages/admin/LeadDetail.tsx` r.93-113, knop Certificaat genereren met body `{lead_id}`). Hier ziet en bevestigt het team het nummer dus niet vooraf. Er zijn wel twee drempels: een open omzetting blokkeert (r.218-222) en een al bestaand geldig certificaat blokkeert (r.223-227).
- **Klant-route, veilig:** r.163-212. Is er geen bekend nummer, dan antwoordt de functie met `geen_nummer` (r.187). Een nieuw nummer komt er pas na de knop "Ja, nieuw nummer uitgeven" (`src/components/admin/KlantCertificaat.tsx` r.73-76, r.161-170). Het voorstel staat vooraf in de dialoog (r.156-160).
- `lead-to-exact-activate` maakt geen nummer aan. Het leest alleen het bestaande nummer (r.691-692, 755-756, 1152-1153) en blokkeert bij een open omzetting.
- `process-bav-wizard`: ik heb daar geen schrijfactie naar `policies` gevonden.
- `eerste_vrije_certificaatnummer` mag alleen door `service_role` worden aangeroepen (0030 r.95-96), dus alleen via de trigger.

## 2. Waar het team een BAV-nummer kan aanpassen of vastleggen

Alle onderstaande functies (RPC's) vragen de rol supervisor, admin of verzekering:
- `bav_nummer_bevestigen`: bevestigt een nummer dat de klant zelf heeft opgegeven. Het scherm is het BAV-nummerblok bij de klant; zie `src/components/admin/crm/AGENTS.md`.
- `bav_nummer_handmatig_bevestigen`: vrij nummer met toelichting van minimaal 3 tekens. Scherm `src/pages/admin/BavNummerNakijken.tsx` r.47.
- `bav_nummer_override_bevestigen`: een nummer dat al bij een andere klant staat toch koppelen, met reden van minimaal 10 tekens. Scherm `src/components/admin/crm/BavBezetMelding.tsx` r.15 en r.36-44 (de knop is alleen zichtbaar voor dezelfde drie rollen).
- `omzetting_vastleggen`: neemt het nummer van de voorganger over. Scherm `src/components/admin/crm/Omzetting.tsx` r.93.
- `policy_nummer_overnemen`: vervangt het nummer op een bestaand certificaat door het overgenomen nummer, met een versieregel en een nieuwe PDF. Dit loopt via `generate-certificate` actie `nummer_overnemen` (index.ts r.115), scherm `Omzetting.tsx` r.79.

Voor de volledigheid: het certificaatnummer op `policies` kan verder niet worden veranderd (guard `guard_policy_nummer_en_status`). "Aanpassen" in `CertificaatBeheer.tsx` wijzigt alleen beroep, certificaathouder, verzekerde en ingangsdatum.

## Mogelijke vervolgstap (alleen na jouw akkoord)
De lead-route laten werken zoals de klant-route: geen bekend nummer betekent eerst een voorstel en een bevestiging ("Ja, nieuw nummer uitgeven"), en de trigger maakt bij een leeg nummer zonder treffer geen nummer meer aan maar weigert.
