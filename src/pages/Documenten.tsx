import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { FileText, Download, Phone } from "lucide-react";
import { TrustSignalsStrip } from "@/components/social-proof/TrustSignalsStrip";

const documents = [
  {
    title: "Dienstverleningsdocument",
    description: "Wat je van ZP Zaken mag verwachten als financieel dienstverlener.",
    file: "/documenten/dienstverleningsdocument.pdf",
  },
  {
    title: "Gedragscode",
    description: "Onze gedragsregels en hoe wij omgaan met onze klanten en partners.",
    file: "/documenten/gedragscode.pdf",
  },
  {
    title: "Slotverklaring 2026",
    description: "De slotverklaring die je bij het afsluiten van een verzekering ondertekent.",
    file: "/documenten/slotverklaring-2026.pdf",
  },
];

export default function Documenten() {
  return (
    <Layout>
      <Helmet>
        <title>Documenten | ZP Zaken</title>
        <meta
          name="description"
          content="Download de formele documenten van ZP Zaken: dienstverleningsdocument, gedragscode en slotverklaring."
        />
        <link rel="canonical" href="https://zpzaken.nl/documenten" />
      </Helmet>

      <PageHero
        title="Documenten"
        subtitle='Hier vind je onze formele documenten. Heb je vragen over een van deze stukken? Neem dan contact met ons op via 020 - 457 3077.'
        badge={{ icon: <FileText className="h-4 w-4" />, text: "Officiële documenten" }}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {documents.map((doc) => (
              <div
                key={doc.title}
                className="bg-card border border-border/60 rounded-2xl p-6 shadow-card hover:shadow-card-hover hover:border-accent/40 transition-all duration-300 flex flex-col"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <h2 className="text-lg font-semibold mb-2">{doc.title}</h2>
                <p className="text-sm text-muted-foreground mb-6 flex-1">{doc.description}</p>
                <Button variant="accent" asChild className="w-full">
                  <a href={doc.file} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </div>
            ))}
          </div>

          <div className="max-w-5xl mx-auto mt-12">
            <TrustSignalsStrip />
          </div>



          <div className="max-w-3xl mx-auto mt-12 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 text-accent" />
            Vragen? Bel ons op{" "}
            <a href="tel:+31204573077" className="font-medium text-foreground hover:text-accent">
              020 - 457 3077
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}
