# Cyber toevoegen zonder portaalaccount

Besluit Boy 7-11-2026 20:25, register E-aanvulling Digital Native Consulting.

## Herstel
- Migratie 0260 uitgevoerd en live teruggelezen: `cyber_toevoeg_verzoeken.user_id` nullable; constraint `bron <> 'klant' OR user_id IS NOT NULL`.
- Bestaande aanvraagfunctie bewaart de werkelijke policy-user, eventueel NULL bij team. Geen teamaccount als vervangend klantaccount; klantpad weigert ontbrekend of afwijkend account.
- Bestaande RLS sluit NULL-teamverzoeken uit voor klanten en behoudt teamroltoegang.
- Activatie, beide mailclaims en document-klaar werken op verzoek-ID, niet op klantaccount.
- Edge coordinator, aparte certificaatgenerator, admin-/portalweergave hebben geen onveilige user-ID-afhankelijkheid. Certificaat en bevestiging gebruiken bestaande lead-/ondernemingscontacten; geen nieuwe portaluitnodiging of melding nodig. Geen wijzigingen aan die paden noodzakelijk.

## Bewijs zonder productie-effecten
- Nieuwe lokale PGlite-test reproduceert eerst de oorspronkelijke NOT NULL-fout met de oude schema-eis.
- Dezelfde aanroep slaagt na de echte migratie: teamverzoek, user NULL, ingang 22-10-2026 uit ondernemingsuitzondering, beoordeling met MFA-context, serviceactivatie, cyberdatums 22-10-2026 t/m 21-10-2027.
- BAV-contract blijft ongewijzigd; document-klaar en beide claims werken. Bevestiging pas na certificaatverzonden-status, tweede claim levert niets op.
- Klantpad zonder user, omzetting naar klantbron met NULL en klantlezing van NULL-teamverzoek worden geweigerd. Ingang 21-10 wordt geweigerd.
- Bestaande ondernemingscontactlookup plus echte certificaatmailhelper in dry-run: geen netwerk of verzending.
- Volledige suite: 237 bestanden, 2624 tests geslaagd, 1 overgeslagen.
- Automatische observabilitycontrole: build OK. Afzonderlijke typecheck en productiebuild niet uitgevoerd, omdat de projectomgeving deze controles automatisch beheert; geen afzonderlijke bevestiging beschikbaar.
- Geen echte verzoeken aangemaakt, geen Digital Native-data gewijzigd en geen klantmails verstuurd. Live verzoekenteller Digital Native blijft 0; uitzonderingsdatum 22-10-2026 behouden.
- Gehoste aangemelde aanvraag/activatie bewust niet uitgevoerd wegens verbod echte verzoeken aan te maken; volledige keten lokaal uitgevoerd.
- Precies één Ellen-melding: cfaf1898-6483-4d70-a23e-6e9d4ceefe23, onderdeel admin, opgegeven actietekst letterlijk teruggelezen; gemaild 19:48:32 UTC.
- Niet gepubliceerd; geen Edge-deploy nodig omdat uitsluitend schema werd gewijzigd.

## Gewijzigde bestanden
- `drizzle/migrations/0260_cyber_team_zonder_portaalaccount.sql`
- `drizzle/migrations/meta/0260_snapshot.json`
- `drizzle/migrations/meta/_journal.json`
- `src/integrations/supabase/types.ts` (automatisch)
- `src/test/cyberZonderPortaalaccount.test.ts`
- `AGENTS.md`
- `roadmap.md`
- `docs/cyber-zonder-portaalaccount-20261107.md`