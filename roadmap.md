# Roadmap

- [x] Audit alle adminroutes en klantdetailtabbladen op 375/390/430 px per zichtbaar element.
- [x] Herstel gedeelde mobiele adminindeling zonder desktopwijzigingen.
- [x] Bouw Facturatie-agenda als mobiele maandlijst met alle waarden.
- [x] Herstel alle overige gevonden mobiele overtredingen.
- [x] Herhaal audit tot 0 overtreders en maak drie 390 px screenshots.
- [x] Controleer build en rapporteer per pagina voor/na.

## Beveiligingscheck 4 oktober 2026

- [ ] Sluit SECURITY DEFINER-functies, herstel expliciete rechten en standaardprivileges, test e-mailwachtrij.
- [ ] Beveilig process-klant-service met anti-spam, verificatiestatus en portal-eigendomscontrole.
- [ ] Dwing MFA server-side af zonder service-role- of klantportaalstromen te breken.
- [ ] Verwijder Exact-geheimen uit frontendtoegang en test Exact-status/keepalive.
- [ ] Herstel login-lockout zodat publieke requests geen accounts kunnen blokkeren.
- [ ] Beperk export-excel tot admin, supervisor en verzekering; vervang kwetsbare XLSX-library en test export.
- [ ] Upgrade Vite 7.3.x en verwijder package-lock.json.
- [ ] Herstel anonieme 404-logging inclusief onbekende hostingpaden.
- [ ] Voeg auditlogging toe voor wijzigingen aan user_roles.
- [ ] Verwijder vier ongebruikte Edge Functions en twee ongebruikte tabellen na referentiecontrole; neutraliseer wachtwoordmigratie.
- [ ] Herstel escaping en veilige Exact-queryopbouw in drie Edge Functions.
- [ ] Onderzoek twee pending e-maillogs en corrigeer hun status zonder opnieuw te verzenden.
- [ ] Voeg security.txt toe en controleer dat het statisch wordt bediend.
- [ ] Controleer uitsluitend de aanwezigheid van OTENTICA_WEBHOOK_SECRET.
- [ ] Draai gerichte tests, securityscan, linter en build; rapporteer per punt en resterende acties voor Boy.
