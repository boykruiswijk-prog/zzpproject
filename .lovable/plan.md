# Nachtelijke scan 7-11-2026 (alleen rapport, niets gewijzigd)

1. **npm audit productie (bun.lock, 76 pakketten):** critical 0, high 1, moderate 2, low 0.
   - zod 3.25.76, high, "Zod can exhaust memory while validating oversized constrained collections", veilig 4.6.6, **major**.
   - (moderate) react-router-dom 6.30.6 via react-router: 2 advisories (deserializeErrors constructor injection; open redirect via backslash, CVE-2025-68470 bypass), veilig react-router 7.18.0, major.
2. **Verschil met 6-11:** geen nieuwe kwetsbaarheid, en geen nieuwe patch/minor in 3.x of 6.x die een bestaande oplost. Stand gelijk.
3. **Edge functions:** high in `npm:zod@3.25.76` (2x), `npm:zod@3.23.8` (4x) en `npm:zod@3` (4x), dezelfde zod-advisory, fix alleen 4.x. `esm.sh/fflate@0.8.2` (1x) staat nog op de kwetsbare versie (ernst niet opnieuw bepaald; fix 0.8.3). Verder geen bekende high/critical gevonden (oude supabase-js 2.39/2.45 zonder bekende high).
4. **Database-linter:** ERROR 0, WARN 184 (173 signed-in security definer, 7 anon security definer, 3 zonder vast search_path, 1 extensie in public), INFO 30. Nieuw sinds gisteren: 1 extra INFO "RLS aan zonder policy" (29 -> 30). Geen nieuwe ERROR of WARN.

Samenvatting: stand ongewijzigd; enige open high is zod (alleen via major 4), plus fflate 0.8.2 in een edge function en 1 nieuwe tabel zonder policy om te controleren.

Er hoeft niets gebouwd te worden; bij goedkeuren voer ik niets uit.
