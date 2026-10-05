# Roadmap

- [x] Audit alle adminroutes en klantdetailtabbladen op 375/390/430 px per zichtbaar element.
- [x] Herstel gedeelde mobiele adminindeling zonder desktopwijzigingen.
- [x] Bouw Facturatie-agenda als mobiele maandlijst met alle waarden.
- [x] Herstel alle overige gevonden mobiele overtredingen.
- [x] Herhaal audit tot 0 overtreders en maak drie 390 px screenshots.
- [x] Controleer build en rapporteer per pagina voor/na.

## Beveiligingscheck 4 oktober 2026

- [x] Sluit SECURITY DEFINER-functies, herstel expliciete rechten en standaardprivileges, test e-mailwachtrij.
- [x] Beveilig process-klant-service met anti-spam, verificatiestatus en portal-eigendomscontrole.
- [x] Dwing MFA server-side af en stuur aal1-teamleden direct naar MFA-inschrijving/verificatie zonder service-role- of klantportaalstromen te breken.
- [x] Verwijder Exact-geheimen uit frontendtoegang en test Exact-status/keepalive.
- [x] Herstel login-lockout zodat publieke requests geen accounts kunnen blokkeren.
- [x] Beperk export-excel tot admin, supervisor en verzekering; vervang kwetsbare XLSX-library en test export.
- [x] Upgrade Vite 7.3.x en verwijder package-lock.json.
- [x] Herstel anonieme 404-logging inclusief onbekende hostingpaden.
- [x] Voeg auditlogging toe voor wijzigingen aan user_roles.
- [x] Verwijder vier ongebruikte Edge Functions en twee ongebruikte tabellen na referentiecontrole; neutraliseer wachtwoordmigratie.
- [x] Herstel escaping en veilige Exact-queryopbouw in drie Edge Functions.
- [x] Onderzoek twee pending e-maillogs en corrigeer hun status zonder opnieuw te verzenden.
- [x] Voeg security.txt toe en controleer dat het statisch wordt bediend.
- [x] Controleer uitsluitend de aanwezigheid van OTENTICA_WEBHOOK_SECRET.
- [x] Draai gerichte tests, securityscan, linter en build; rapporteer per punt en resterende acties voor Boy.

## Opdracht 5 okt 2026 (niet publiceren)
- [x] /bav-zzp-vergelijken pagina + data + SEO/prerender/sitemap/llms + interne links
- [x] aanvraag_concepten: tabel, edge-actie, formulier, privacy, cron anonimiseren, admin-blok, dagmail
- [x] Cloudflare bulk-redirects CSV bij build

## SEO-update 5 oktober 2026 (niet publiceren)
- [x] Back-up vijf artikelen in afgeschermde back-uptabel
- [x] Kostenartikel samenvoegen, oude variant depubliceren en interne links corrigeren
- [x] FAQ-schema uit markdownsectie ondersteunen
- [x] Kosten- en AOV-redirects aanpassen en Cloudflare-CSV regenereren
- [x] Interpunctie in drie gepubliceerde artikelen corrigeren met voor/na-rapport
- [x] Database, redirects, grep, tests en build controleren
