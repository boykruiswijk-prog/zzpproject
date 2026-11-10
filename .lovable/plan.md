Nachtelijke scan 10-11-2026, alleen rapport. Er is niets gewijzigd. Deze stap hoeft niet uitgevoerd te worden.

1. Productie (76 pakketten): 0 critical, 1 high, 2 moderate, 0 low. Gelijk aan 9-11.
   - zod 3.25.76, high, opgelost in 4.6.6, alleen major
   - react-router-dom 6.30.6, 2x moderate, opgelost in 7.18.0, alleen major
2. Verouderd: 7 patch, 37 minor, 37 major. Belangrijke major-versies: react/react-dom 19.3, react-router-dom 7.18.5, vite 8.3.7, typescript 7.0.2, tailwindcss 4.3.5, vitest 5.1.0, zod 4.6.7, pdfjs-dist 6.5.
3. Serverfuncties: alleen zod 3.x (3.23.8 / 3 / 3.25.76) valt onder dezelfde high-melding. Er zijn geen critical-meldingen gevonden. Dit is geen volledige scan van alle import-versies.
4. Databaseadviseur: 0 ERROR, 192 WARN (+5), 35 INFO (+3).
   - Nieuw: 3 tabellen met RLS aan maar zonder policy (INFO, op slot, dus geen datalek)
   - Nieuw: 5 extra SECURITY DEFINER-functies die ingelogde gebruikers kunnen aanroepen (WARN, verwacht door migraties 0263/0264, met eigen rolcontrole)
