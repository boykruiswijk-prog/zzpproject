De gebruiker vroeg expliciet alleen om onderzoek, geen fix. Bevindingen zijn hierboven in de chat gerapporteerd:

1. `articles.status` bestaat niet — publicatiestatus staat in `is_published` (boolean). De filter `.eq("status","published")` levert een PostgREST-fout (`42703 / PGRST100`), geen lege lijst.
2. Er is geen FK van `articles` naar `article_categories`. `articles.category` is een los tekstveld. De embed `article_categories(slug, name)` wordt door PostgREST afgewezen met `PGRST200`.
3. Werkelijke uitvoering: beide tools falen met een 400-fout vóór data-uitvoering. Er staan wel 9 gepubliceerde artikelen (van 10 totaal) in de tabel.
4. `article_categories` heeft `slug` wél, maar het label heet **`label`**, niet `name`.

Geen wijzigingen voorgesteld. Wachten op groen licht voor een fix-plan.