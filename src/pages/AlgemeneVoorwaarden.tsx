import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { PageHero } from "@/components/layout/PageHero";
import { FileText } from "lucide-react";

const tocItems = [
  { id: "artikel-1", label: "1. Definities" },
  { id: "artikel-2", label: "2. Toepasselijkheid algemene voorwaarden" },
  { id: "artikel-3", label: "3. Profiel en gebruik diensten" },
  { id: "artikel-4", label: "4. Rechten en verplichtingen van gebruiker" },
  { id: "artikel-5", label: "5. Gedragsregels" },
  { id: "artikel-6", label: "6. Naleving, opschorting en beëindiging van de Dienst" },
  { id: "artikel-7", label: "7. Intellectuele Eigendomsrechten" },
  { id: "artikel-8", label: "8. Geen garantie, beperking aansprakelijkheid" },
  { id: "artikel-9", label: "9. Beleid voor linken" },
  { id: "artikel-10", label: "10. Geheimhouding" },
  { id: "artikel-11", label: "11. Overdracht rechten en verplichtingen" },
  { id: "artikel-12", label: "12. Werking van de Algemene Voorwaarden" },
  { id: "artikel-13", label: "13. Geschillenregeling" },
  { id: "artikel-14", label: "14. Betaling" },
  { id: "artikel-15", label: "15. Cookiebeleid" },
  { id: "artikel-16", label: "16. Informatie" },
];

const definitions: Array<{ term: string; description: string }> = [
  { term: "Bedenktijd", description: "de termijn waarbinnen de consument gebruik kan maken van zijn herroepingsrecht." },
  { term: "Database", description: "de database van ZP Zaken waarin de gegevens zijn opgenomen." },
  { term: "Dienst", description: "de door ZP Zaken verrichte dienst." },
  { term: "Gebruiker", description: "de rechtspersoon of werknemer van een rechtspersoon die door middel van Registratie een dienst afneemt van ZP Zaken en akkoord is gegaan met deze Algemene Voorwaarden." },
  { term: "Gegevens", description: "de gegevens die Gebruiker op de Website invult of op andere door ZP Zaken aangegeven wijze aan ZP Zaken worden verstrekt." },
  { term: "Herroepingsrecht", description: "de mogelijkheid van de consument om binnen de bedenktijd af te zien van de overeenkomst op afstand." },
  { term: "Overeenkomst", description: "de overeenkomst tussen ZP Zaken en Gebruiker waarin de voorwaarden zijn opgenomen die van toepassing zijn op de dienst die Gebruiker van ZP Zaken afneemt." },
  { term: "Privacy Statement", description: "de privacyverklaring zoals opgenomen op de Website." },
  { term: "Profiel", description: "het profiel van Gebruiker zoals opgenomen in de Database, bestaande uit de aan ZP Zaken verstrekte Gegevens bij Registratie." },
  { term: "Registratie", description: "het door de Gebruiker aan ZP Zaken verstrekken van zijn gegevens opdat deze als Profiel in de Database worden opgenomen en de Dienst kan worden verricht." },
  { term: "Website", description: "de website www.zpzaken.nl die wordt beheerd door ZP Zaken." },
];

const Article = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-2xl md:text-3xl font-bold mb-6">{title}</h2>
    <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

const Clause = ({ nr, children }: { nr: string; children: React.ReactNode }) => (
  <p>
    <span className="font-semibold text-foreground">{nr}.</span> {children}
  </p>
);

export default function AlgemeneVoorwaarden() {
  return (
    <Layout>
      <SEOHead
        title="Algemene Voorwaarden | ZP Zaken"
        description="Algemene Voorwaarden van ZP Zaken B.V. Van toepassing op alle diensten van ZP Zaken."
      />
      <PageHero
        title="Algemene Voorwaarden ZP Zaken B.V."
        subtitle="Van toepassing op alle diensten van ZP Zaken B.V., Tupolevlaan 41, 1119 NW Schiphol-Rijk"
        badge={{
          icon: <FileText className="h-4 w-4" />,
          text: "Versie: april 2026",
        }}
      />

      {/* Table of contents */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <div className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 shadow-card">
              <h2 className="text-xl font-bold mb-4">Inhoudsopgave</h2>
              <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto space-y-16">
            <Article id="artikel-1" title="Artikel 1 — Definities">
              <Clause nr="1.1">
                De hierna met een beginhoofdletter aangeduide begrippen hebben in deze Algemene Voorwaarden de navolgende betekenis:
              </Clause>
              <dl className="space-y-3 mt-4">
                {definitions.map((d) => (
                  <div key={d.term}>
                    <dt className="font-semibold text-foreground inline">{d.term}: </dt>
                    <dd className="inline">{d.description}</dd>
                  </div>
                ))}
              </dl>
            </Article>

            <Article id="artikel-2" title="Artikel 2 — Toepasselijkheid algemene voorwaarden">
              <Clause nr="2.1">Deze Algemene Voorwaarden zijn van toepassing op de Registratie en op de Diensten van ZP Zaken.</Clause>
              <Clause nr="2.2">Wordt een Dienst afgenomen dan zal deze Dienst uitdrukkelijk worden beheerst door de daartoe overeengekomen Overeenkomst.</Clause>
              <Clause nr="2.3">De toepasselijkheid van deze Algemene Voorwaarden wordt door de Gebruiker aanvaard door het aangaan van de Overeenkomst en/of het gebruikmaken van de diensten en/of producten van ZP Zaken.</Clause>
            </Article>

            <Article id="artikel-3" title="Artikel 3 — Profiel en gebruik diensten">
              <Clause nr="3.1">Wanneer Gebruiker Gegevens verstrekt aan ZP Zaken, stemt hij er mee in dat hij uitsluitend juiste, actuele en volledige Gegevens verstrekt. Gebruiker verplicht zich wijzigingen in het Profiel tijdig door te geven.</Clause>
              <Clause nr="3.2">ZP Zaken behoudt zich het recht voor om zonder nadere toelichting geen Profiel van Gebruiker aan te maken, hem toegang tot de Dienst te weigeren of geen Overeenkomst met Gebruiker te sluiten.</Clause>
              <Clause nr="3.3">Gebruiker zal derden geen toegang tot de Dienst verlenen en daartoe alle passende veiligheidsmaatregelen nemen. Gebruiker houdt zijn inloggegevens geheim en beperkt de toegang tot zijn apparaten door derden. Indien een derde mogelijk toegang heeft verkregen tot voornoemde inloggegevens dient Gebruiker ZP Zaken daarvan onverwijld op de hoogte te stellen.</Clause>
              <Clause nr="3.4">Gebruiker verleent ZP Zaken toestemming om de Gegevens, in overeenstemming met het Privacy Statement, te gebruiken, te reproduceren, te verspreiden en aan te passen om er afgeleide rechten van te vervaardigen.</Clause>
              <Clause nr="3.5">Het Profiel is voor onbepaalde tijd beschikbaar en kan door Gebruiker worden beëindigd door middel van een e-mail aan info@zpzaken.nl. Het Profiel wordt vijf werkdagen na ontvangst verwijderd. Indien een of meerdere overeenkomsten nog van kracht zijn, wordt deze termijn verlengd tot de dag waarop de laatste overeenkomst eindigt.</Clause>
              <Clause nr="3.6">Gebruiker dient zich te realiseren dat het verstrekken van Gegevens via het internet risico's met zich mee kan brengen, en dit in overweging te nemen bij het verstrekken van Gegevens aan ZP Zaken.</Clause>
            </Article>

            <Article id="artikel-4" title="Artikel 4 — Rechten en verplichtingen van gebruiker">
              <Clause nr="4.1">Gebruiker garandeert dat hij tijdens de Registratie en gebruikmaking van de Dienst geen inbreuk maakt op enige wet- en regelgeving.</Clause>
              <Clause nr="4.2">Gebruiker kan suggesties voor verbetering van de Dienst doorgeven aan ZP Zaken via de Website. ZP Zaken mag dergelijke suggesties overnemen en de Dienst aanpassen zonder enige vergoeding verschuldigd te zijn aan Gebruiker.</Clause>
              <Clause nr="4.3">Gebruiker dient gebreken in de Dienst zo spoedig mogelijk nadat hij daarvan op de hoogte is te melden aan ZP Zaken.</Clause>
              <p className="font-semibold text-foreground pt-2">4.4 Herroepingsrecht</p>
              <Clause nr="4.4.1">Producten: De consument kan een Overeenkomst met betrekking tot de aankoop van een product gedurende een bedenktijd van 14 dagen zonder opgave van redenen ontbinden.</Clause>
              <Clause nr="4.4.2">Diensten en digitale inhoud: De consument kan een dienstenovereenkomst gedurende een bedenktijd van 14 dagen zonder opgave van redenen ontbinden.</Clause>
              <Clause nr="4.4.3">De bedenktijd gaat in op de dag die volgt op de dag waarop het product is ontvangen of de dag waarop de dienstenovereenkomst is afgesloten.</Clause>
            </Article>

            <Article id="artikel-5" title="Artikel 5 — Gedragsregels">
              <Clause nr="5.1">Gebruiker zal zich tijdens het gebruik van de Dienst fatsoenlijk gedragen en zal onder geen beding via de Website:</Clause>
              <Clause nr="5.1.1">Malware (virussen, ransomware, spyware enz.) verzenden, plaatsen of verspreiden.</Clause>
              <Clause nr="5.1.2">Valse, smadelijke, lasterlijke, obscene, beledigende, intimiderende of bedreigende gegevens verzenden of plaatsen.</Clause>
              <Clause nr="5.1.3">Informatie verzenden die inbreuk maakt op intellectuele eigendomsrechten of andere rechten van derden.</Clause>
              <Clause nr="5.1.4">Inbreuk maken op rechten van anderen, waaronder het recht op privacy.</Clause>
              <Clause nr="5.1.5">Spam, junkmail of kettingbrieven verzenden.</Clause>
              <Clause nr="5.1.6">Het functioneren van de Website in gevaar brengen of de aangeboden informatie of onderliggende software aantasten.</Clause>
            </Article>

            <Article id="artikel-6" title="Artikel 6 — Naleving, opschorting en beëindiging van de Dienst">
              <Clause nr="6.1">ZP Zaken behoudt zich het recht voor om de Dienst of enig deel daarvan te wijzigen of stop te zetten zonder kennisgeving aan Gebruiker.</Clause>
              <Clause nr="6.2">Wanneer Gebruiker in strijd handelt met de gedragsregels uit artikel 5, behoudt ZP Zaken zich het recht voor zijn Profiel te verwijderen en de Dienst te staken.</Clause>
              <Clause nr="6.3">Het abonnement kan door partijen te allen tijde worden opgezegd.</Clause>
            </Article>

            <Article id="artikel-7" title="Artikel 7 — Intellectuele Eigendomsrechten">
              <Clause nr="7.1">ZP Zaken behoudt alle intellectuele eigendomsrechten met betrekking tot alle op of via de Website of Dienst aangeboden informatie, waaronder alle teksten, grafisch materiaal en logo's. Kopiëren, verspreiden of openbaar maken is niet toegestaan zonder voorafgaande schriftelijke toestemming van ZP Zaken.</Clause>
              <Clause nr="7.2">Gebruiker verbindt zich geen inbreuk te maken op merken, handelsnamen, modellen of andere intellectuele eigendomsrechten van ZP Zaken of haar gelieerde ondernemingen.</Clause>
            </Article>

            <Article id="artikel-8" title="Artikel 8 — Geen garantie, beperking aansprakelijkheid">
              <Clause nr="8.1">Het gebruik van de Website is voor eigen rekening en risico van Gebruiker. ZP Zaken garandeert niet dat de Website foutloos of ononderbroken zal functioneren.</Clause>
              <Clause nr="8.2">ZP Zaken verstrekt geen garantie dat de op de Website aangeboden informatie juist, volledig of actueel is.</Clause>
              <Clause nr="8.3">ZP Zaken geeft geen garantie voor de geschiktheid, functionaliteit of beschikbaarheid van de Dienst.</Clause>
              <Clause nr="8.4">ZP Zaken is niet aansprakelijk voor schade die voortvloeit uit: het niet tot stand komen van overeenkomsten, de verleende diensten, defecten of malware aan apparatuur, de aangeboden informatie, de werking of het niet beschikbaar zijn van de Website, misbruik, verlies van Gegevens of aanspraken van derden.</Clause>
              <Clause nr="8.5">In geen geval is ZP Zaken aansprakelijk voor enige indirecte schade geleden door of in verband met de uitvoering van de Overeenkomst.</Clause>
              <Clause nr="8.6">Indien ZP Zaken aansprakelijk mocht zijn, is deze aansprakelijkheid te allen tijde beperkt tot directe schade en maximaal tot een bedrag van EUR 10.000 (tienduizend euro).</Clause>
              <Clause nr="8.7">ZP Zaken is niet aansprakelijk voor schade die ontstaat als gevolg van oorzaken buiten haar invloedsfeer, waaronder storingen bij het verzenden van Gegevens, verlies van Gegevens of onjuist gebruik van de Website door Gebruiker of derden.</Clause>
              <Clause nr="8.8">De uitsluiting van aansprakelijkheid uit artikel 8.4 tot en met 8.7 geldt mede ten gunste van bestuurders, medewerkers en toeleveranciers van ZP Zaken, maar niet voor schade als gevolg van opzet of bewuste roekeloosheid.</Clause>
              <Clause nr="8.9">De wettelijke verjaringstermijn voor vorderingen van Gebruiker wordt verkort tot één jaar.</Clause>
            </Article>

            <Article id="artikel-9" title="Artikel 9 — Beleid voor linken">
              <Clause nr="9.1">Gebruiker zorgt ervoor dat een link naar de Website geen schade toebrengt aan ZP Zaken of afbreuk doet aan de goodwill van ZP Zaken. Gebruiker linkt de Website niet aan een website die onwettig, beledigend of onfatsoenlijk is.</Clause>
              <Clause nr="9.2">Hyperlinks naar websites van derden houden geen aanbeveling in van die websites of diensten. Het gebruik van dergelijke hyperlinks is voor eigen risico van Gebruiker.</Clause>
            </Article>

            <Article id="artikel-10" title="Artikel 10 — Geheimhouding">
              <Clause nr="10.1">Beide partijen zijn verplicht tot geheimhouding van alle informatie van vertrouwelijke aard, tenzij deze gegevens algemeen bekend zijn, openbaarmaking noodzakelijk is voor de uitvoering van de dienst, of een wettelijke verplichting openbaarmaking vereist.</Clause>
              <Clause nr="10.2">ZP Zaken is gerechtigd gegevens van Gebruiker te verstrekken aan gelieerde ondernemingen, professionele adviseurs en derden die betrokken zijn bij de verlening van de Dienst.</Clause>
            </Article>

            <Article id="artikel-11" title="Artikel 11 — Overdracht rechten en verplichtingen">
              <Clause nr="11.1">Gebruiker is niet gerechtigd zonder voorafgaande schriftelijke toestemming van ZP Zaken enige rechten of verplichtingen over te dragen.</Clause>
              <Clause nr="11.2">ZP Zaken heeft het recht om zonder toestemming van Gebruiker rechten en verplichtingen over te dragen aan gelieerde ondernemingen.</Clause>
            </Article>

            <Article id="artikel-12" title="Artikel 12 — Werking van de Algemene Voorwaarden">
              <Clause nr="12.1">Afwijkende bedingen gelden slechts indien uitdrukkelijk schriftelijk overeengekomen tussen Gebruiker en een bevoegde vertegenwoordiger van ZP Zaken.</Clause>
              <Clause nr="12.2">Indien een bepaling nietig blijkt te zijn, laat dit de geldigheid van de overige bepalingen onverlet.</Clause>
              <Clause nr="12.3">ZP Zaken behoudt zich het recht voor deze voorwaarden te wijzigen. Wijzigingen worden kenbaar gemaakt aan Gebruiker met vermelding van de inhoud van de wijziging.</Clause>
            </Article>

            <Article id="artikel-13" title="Artikel 13 — Geschillenregeling">
              <Clause nr="13.1">Op alle rechtsverhoudingen tussen ZP Zaken en Gebruiker is Nederlands recht van toepassing.</Clause>
              <Clause nr="13.2">Geschillen die niet minnelijk kunnen worden geschikt, worden voorgelegd aan de bevoegde rechter te Amsterdam.</Clause>
            </Article>

            <Article id="artikel-14" title="Artikel 14 — Betaling">
              <Clause nr="14.1">Abonnementskosten worden jaarlijks in rekening gebracht via automatisch incasso, tenzij anders overeengekomen.</Clause>
              <Clause nr="14.2">Bij een niet-succesvolle betaling kan het abonnement eenzijdig worden opgeschort.</Clause>
              <Clause nr="14.3">ZP Zaken behoudt zich het recht voor abonnementen en/of prijzen te wijzigen. Wijzigingen zijn van toepassing vanaf de eerstvolgende kalendermaand na aankondiging.</Clause>
            </Article>

            <Article id="artikel-15" title="Artikel 15 — Cookiebeleid">
              <Clause nr="15.1">
                ZP Zaken gebruikt cookies en soortgelijke technieken voor technische, functionele en analytische doeleinden. Het volledige cookiebeleid is beschikbaar op{" "}
                <a href="/cookies" className="text-accent hover:underline">zpzaken.nl/cookies</a>.
              </Clause>
              <Clause nr="15.2">ZP Zaken plaatst cookies die technisch noodzakelijk zijn voor de werking van de website en analytische cookies die geanonimiseerde informatie verzamelen over het gebruik van de website.</Clause>
              <Clause nr="15.3">
                ZP Zaken kan van tijd tot tijd het cookiebeleid updaten. Raadpleeg{" "}
                <a href="/cookies" className="text-accent hover:underline">zpzaken.nl/cookies</a> regelmatig voor actuele informatie.
              </Clause>
            </Article>

            <Article id="artikel-16" title="Artikel 16 — Informatie">
              <Clause nr="16.1">Bij vragen, opmerkingen of klachten over onze Dienst of deze Algemene Voorwaarden kunt u contact opnemen via:</Clause>
              <div className="bg-secondary rounded-xl p-6 mt-4 text-sm space-y-1">
                <p className="font-semibold text-foreground">ZP Zaken B.V.</p>
                <p>Tupolevlaan 41</p>
                <p>1119 NW Schiphol-Rijk</p>
                <p>E-mail: <a href="mailto:info@zpzaken.nl" className="text-accent hover:underline">info@zpzaken.nl</a></p>
                <p>Telefoon: <a href="tel:0232010502" className="text-accent hover:underline">023 - 201 0502</a></p>
                <p>KvK: 62117092</p>
                <p>AFM vergunningsnummer: 12050636</p>
              </div>
              <p className="text-xs text-muted-foreground pt-4">Versie: april 2026</p>
            </Article>
          </div>
        </div>
      </section>
    </Layout>
  );
}
