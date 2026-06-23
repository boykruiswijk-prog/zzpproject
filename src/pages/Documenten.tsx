import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { FileText, BookOpen, Phone, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import {
  branches,
  algemeneBavDocumenten,
  zpZakenEigenDocumenten,
  type Document,
} from "@/data/documentenLijst";

function DocLink({ doc }: { doc: Document }) {
  const Icon = doc.isHtmlPage ? BookOpen : FileText;
  const inner = (
    <>
      <Icon className="h-4 w-4 mt-1 flex-shrink-0 text-accent" />
      <span className="text-sm leading-snug">
        <span className="text-accent group-hover:underline font-medium">
          {doc.titel}
        </span>
        {doc.productCode && (
          <span className="text-muted-foreground font-normal"> ({doc.productCode})</span>
        )}
      </span>
    </>
  );
  const className = "group flex items-start gap-3 rounded-lg px-3 py-2 -mx-3 hover:bg-accent/5 transition-colors";
  if (doc.isHtmlPage) {
    return <Link to={doc.path} className={className}>{inner}</Link>;
  }
  return (
    <a
      href={doc.path}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <FileText className="h-4 w-4 mt-1 flex-shrink-0 text-accent" />
      <span className="text-sm leading-snug">
        <span className="text-accent group-hover:underline font-medium">
          {doc.titel}
        </span>
        {doc.productCode && (
          <span className="text-muted-foreground font-normal"> ({doc.productCode})</span>
        )}
      </span>
    </a>
  );
}

function DocList({ docs }: { docs: Document[] }) {
  return (
    <ul className="space-y-1">
      {docs.map((d) => (
        <li key={d.id}>
          <DocLink doc={d} />
        </li>
      ))}
    </ul>
  );
}

export default function Documenten() {
  return (
    <Layout>
      <Helmet>
        <title>Documenten en downloads | ZP Zaken</title>
        <meta
          name="description"
          content="Bekijk en download polisvoorwaarden, verzekeringskaarten en brochures van ZP Zaken per branche."
        />
        <link rel="canonical" href="https://zpzaken.nl/documenten" />
        <meta property="og:title" content="Documenten en downloads | ZP Zaken" />
        <meta
          property="og:description"
          content="Bekijk en download polisvoorwaarden, verzekeringskaarten en brochures van ZP Zaken per branche."
        />
        <meta property="og:url" content="https://zpzaken.nl/documenten" />
      </Helmet>

      <PageHero
        title="Documenten en downloads"
        subtitle="Bekijk hier alle voorwaarden, verzekeringskaarten en brochures per branche. Heb je hulp nodig bij het kiezen? Bel 020 - 457 3077 of stuur een WhatsApp."
        badge={{ icon: <FileText className="h-4 w-4" />, text: "Officiële documenten" }}
      />

      {/* Sectie 1: Per branche */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Documenten per branche</h2>
            <p className="text-muted-foreground mb-10">
              Per beroepsgroep gelden specifieke polisvoorwaarden en verzekeringskaarten.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {branches.map((branche) => (
                <div
                  key={branche.id}
                  className="bg-card border border-border/60 rounded-2xl p-6 shadow-card"
                >
                  <h3 className="text-lg font-bold mb-1">{branche.naam}</h3>
                  {branche.subnaam && (
                    <p className="text-sm italic text-muted-foreground mb-4">{branche.subnaam}</p>
                  )}
                  {branche.documenten.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Documenten in voorbereiding.
                    </p>
                  ) : (
                    <DocList docs={branche.documenten} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sectie 2: Algemene BAV */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Documenten bedrijfsaansprakelijkheidsverzekering
            </h2>
            <p className="text-muted-foreground mb-6">
              Deze documenten gelden voor alle branches en beroepen.
            </p>
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <DocList docs={algemeneBavDocumenten} />
            </div>
          </div>
        </div>
      </section>


      {/* Sectie 4: ZP Zaken eigen */}
      <section className="section-padding bg-muted/30">
        <div className="container-wide">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">ZP Zaken documenten</h2>
            <p className="text-muted-foreground mb-6">
              Onze werkwijze, gedragscode en slotverklaring.
            </p>
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <DocList docs={zpZakenEigenDocumenten} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-foreground text-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-background">
              Vragen over een document?
            </h2>
            <p className="text-background/70 mb-8">
              We beantwoorden je vragen graag.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="accent" asChild>
                <a href="tel:+31204573077">
                  <Phone className="h-4 w-4" />
                  Bel 020 - 457 3077
                </a>
              </Button>
              <Button variant="outline" asChild className="bg-transparent border-background/30 text-background hover:bg-background hover:text-foreground">
                <a href="mailto:info@zpzaken.nl">
                  <Mail className="h-4 w-4" />
                  Stuur een mail
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
