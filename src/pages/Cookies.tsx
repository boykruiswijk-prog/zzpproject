import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { PageHero } from "@/components/layout/PageHero";
import { Cookie, Shield, BarChart3, Megaphone, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "zpzaken_cookie_consent";

const cookieTypes = [
  {
    icon: Shield,
    title: "Noodzakelijke cookies",
    description: "Deze cookies zijn essentieel voor de basisfunctionaliteit van de website. Zonder deze cookies kan de website niet correct functioneren. Ze worden gebruikt voor:",
    items: [
      "Onthouden van je cookie-voorkeuren",
      "Beveiligen van formulieren tegen misbruik",
      "Laden van pagina's en navigatie",
      "Sessie- en authenticatiebeheer",
    ],
    canDisable: false,
  },
  {
    icon: BarChart3,
    title: "Analytische cookies",
    description: "Deze cookies helpen ons te begrijpen hoe bezoekers onze website gebruiken. De informatie wordt geanonimiseerd verzameld en helpt ons bij:",
    items: [
      "Meten van bezoekersaantallen",
      "Analyseren van gebruikersgedrag",
      "Verbeteren van de gebruikerservaring",
      "Identificeren van populaire pagina's",
    ],
    canDisable: true,
  },
  {
    icon: Megaphone,
    title: "Marketing cookies",
    description: "Deze cookies worden gebruikt om advertenties relevanter te maken voor jou. Ze kunnen ook worden gebruikt om:",
    items: [
      "Gepersonaliseerde advertenties te tonen",
      "De effectiviteit van campagnes te meten",
      "Je te herkennen op andere websites",
      "Social media-integraties mogelijk te maken",
    ],
    canDisable: true,
  },
];

const cookieDetails = [
  {
    name: "zpzaken_cookie_consent",
    provider: "ZP Zaken",
    purpose: "Slaat je cookie-voorkeuren op",
    expiry: "1 jaar",
    type: "Noodzakelijk",
  },
  {
    name: "_ga, _gid",
    provider: "Google Analytics",
    purpose: "Verzamelt geanonimiseerde statistieken",
    expiry: "2 jaar / 24 uur",
    type: "Analytisch",
  },
  {
    name: "_fbp",
    provider: "Meta (Facebook)",
    purpose: "Marketing en retargeting",
    expiry: "3 maanden",
    type: "Marketing",
  },
];

export default function Cookies() {
  const resetCookieConsent = () => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    window.location.reload();
  };

  return (
    <Layout>
      <SEOHead
        title="Cookiebeleid | ZP Zaken"
        description="Lees hoe ZP Zaken cookies gebruikt om jouw ervaring te verbeteren. Beheer je cookie-voorkeuren."
      />
      <PageHero
        title="Cookiebeleid"
        subtitle="Transparantie over hoe wij cookies gebruiken om jouw ervaring te verbeteren."
        badge={{
          icon: <Cookie className="h-4 w-4" />,
          text: "Privacy & Cookies"
        }}
      />

      {/* Introduction */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg">
              <p className="text-lg text-muted-foreground leading-relaxed">
                ZP Zaken B.V. respecteert jouw privacy. Op deze pagina leggen wij uit welke cookies wij gebruiken, waarom we ze gebruiken en hoe je je voorkeuren kunt beheren. Dit cookiebeleid is voor het laatst bijgewerkt op <strong>3 februari 2026</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What are cookies */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Wat zijn cookies?</h2>
            <p className="text-muted-foreground mb-4">
              Cookies zijn kleine tekstbestanden die op je computer, tablet of telefoon worden opgeslagen wanneer je een website bezoekt. Ze worden veel gebruikt om websites te laten werken, efficiënter te maken en informatie te verstrekken aan de eigenaren van de site.
            </p>
            <p className="text-muted-foreground">
              Cookies kunnen worden ingesteld door de website die je bezoekt (first-party cookies) of door andere partijen zoals adverteerders of analysetools (third-party cookies).
            </p>
          </div>
        </div>
      </section>

      {/* Cookie Types */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Welke cookies gebruiken wij?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Wij maken onderscheid tussen verschillende soorten cookies, elk met een specifiek doel.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {cookieTypes.map((type) => (
              <div key={type.title} className="bg-card rounded-2xl border border-border/50 p-6 shadow-card">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <type.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{type.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{type.description}</p>
                <ul className="space-y-2">
                  {type.items.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${type.canDisable ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
                    {type.canDisable ? 'Uitschakelbaar' : 'Altijd actief'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cookie Details Table */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Overzicht van gebruikte cookies</h2>
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold">Cookie</th>
                      <th className="text-left p-4 text-sm font-semibold">Aanbieder</th>
                      <th className="text-left p-4 text-sm font-semibold">Doel</th>
                      <th className="text-left p-4 text-sm font-semibold">Bewaartermijn</th>
                      <th className="text-left p-4 text-sm font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cookieDetails.map((cookie, index) => (
                      <tr key={index}>
                        <td className="p-4 text-sm font-mono text-muted-foreground">{cookie.name}</td>
                        <td className="p-4 text-sm">{cookie.provider}</td>
                        <td className="p-4 text-sm text-muted-foreground">{cookie.purpose}</td>
                        <td className="p-4 text-sm text-muted-foreground">{cookie.expiry}</td>
                        <td className="p-4 text-sm">
                          <span className="bg-accent/10 text-accent text-xs font-medium px-2 py-1 rounded">
                            {cookie.type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your Rights */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Jouw rechten</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Op grond van de Algemene Verordening Gegevensbescherming (AVG/GDPR) en de Telecommunicatiewet heb je het recht om:
              </p>
              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  Je toestemming voor cookies in te trekken of aan te passen
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  Cookies te verwijderen via je browserinstellingen
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  Inzage te vragen in de gegevens die wij verzamelen
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  Een klacht in te dienen bij de Autoriteit Persoonsgegevens
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Manage Preferences */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-14 h-14 bg-primary-foreground/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="h-7 w-7" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Cookie-voorkeuren beheren</h2>
            <p className="text-primary-foreground/80 mb-8">
              Je kunt je cookie-voorkeuren op elk moment aanpassen. Klik op de onderstaande knop om de cookie-instellingen opnieuw te openen.
            </p>
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={resetCookieConsent}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Cookie className="h-4 w-4 mr-2" />
              Cookie-instellingen openen
            </Button>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Vragen?</h2>
            <p className="text-muted-foreground mb-6">
              Heb je vragen over ons cookiebeleid of over hoe wij met je gegevens omgaan? Neem dan contact met ons op.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>ZP Zaken B.V.</strong></p>
              <p>Tupolevlaan 41, Schiphol-Rijk</p>
              <p>E-mail: <a href="mailto:privacy@zpzaken.nl" className="text-accent hover:underline">privacy@zpzaken.nl</a></p>
              <p>AFM vergunningsnummer: 12050636</p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
