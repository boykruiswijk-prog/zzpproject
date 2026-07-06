De gebruiker vroeg expliciet alleen om onderzoek, geen fix. De bevindingen staan uitgebreid in de chat hierboven:

1. `seo_title`/`seo_description` worden gerenderd in `<head>` via `react-helmet-async` in `ArtikelDetail.tsx`, met fallbacks (title, excerpt, content-preview).
2. OG-tags per artikel volledig aanwezig (og:type=article, og:title, og:description, og:url, og:image met `image_url`, article:published_time enz.) plus Twitter Card.
3. Canonical per artikel is gezet naar `https://www.zpzaken.nl/kennisbank/{slug}`.
4. `sitemap.xml` en `robots.txt` bestaan; sitemap bevat de 9 artikelen handmatig. **Geen generator-script**, dus nieuwe publicaties worden niet automatisch opgenomen. robots.txt verwijst correct naar de sitemap.
5. Kale Vite SPA — geen SSR of prerendering. JS-crawlers zien alles; niet-JS-crawlers (LinkedIn, Slack, Facebook, veel AI-crawlers) zien alleen de sitewide homepage-shell.
6. Article- en BreadcrumbList JSON-LD worden op elke artikelpagina ingespoten via Helmet.

Zwakke punten: sitemap wordt niet automatisch bijgewerkt, geen prerendering (social previews per artikel werken alleen voor JS-crawlers), canonicals wijzen naar een host die nog niet live is.

Geen wijzigingen voorgesteld. Wachten op groen licht voor een concrete fix-opdracht.