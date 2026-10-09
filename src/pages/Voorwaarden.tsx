import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { seoRoute } from "@/config/seoRoutes";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { branches, algemeneBavDocumenten, type Document } from "@/data/documentenLijst";

const SEO = seoRoute("/voorwaarden");

function PdfLink({ doc, label }: { doc: Document; label?: string }) {
  return (
    <a href={doc.path} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-lg px-3 py-2 -mx-3 hover:bg-accent/5 transition-colors">
      <FileText className="h-4 w-4 mt-1 flex-shrink-0 text-accent" />
      <span className="text-sm leading-snug">
        <span className="text-accent group-hover:underline font-medium">{label ?? doc.titel}</span>
        {!label && doc.productCode && <span className="text-muted-foreground font-normal"> ({doc.productCode})</span>}
      </span>
    </a>
  );
}

export default function Voorwaarden() {
  const kantoorrisico = branches.flatMap((b) => b.documenten).find((d) => d.type === "aanvullend");
  const havbKaart = algemeneBavDocumenten.find((d) => d.type === "verzekeringskaart");
  return (
    <Layout>
      <SEOHead title={SEO.title} description={SEO.description} canonical="https://zpzaken.nl/voorwaarden" />
      <PageHero
        title="Polisvoorwaarden"
        subtitle="Je bent verzekerd via de collectieve polis van ZP Zaken bij Hiscox. Daarom ontvang je geen eigen polis, maar een verzekeringscertificaat. De voorwaarden hieronder gelden voor jouw dekking."
        badge={{ icon: <FileText className="h-4 w-4" />, text: "Hiscox-voorwaarden" }}
      />
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Je bent gedekt vanaf de ingangsdatum die je zelf kiest bij je aanmelding. Fouten van voor die datum zijn niet gedekt. Er is geen uitloopdekking.</p>
              <Button variant="accent" asChild className="shrink-0"><Link to="/mijn-zp/polis">Verzekeringscertificaat opvragen</Link></Button>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {branches.map((b) => (
                <div key={b.id} className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                  <h2 className="text-lg font-bold mb-1">{b.naam}</h2>
                  {b.subnaam && <p className="text-sm italic text-muted-foreground mb-4">{b.subnaam}</p>}
                  <ul className="space-y-1">
                    {b.documenten.filter((d) => d.type === "polisvoorwaarden" || d.type === "verzekeringskaart").map((d) => <li key={d.id}><PdfLink doc={d} /></li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <h2 className="text-lg font-bold mb-4">Voor alle branches</h2>
              <ul className="space-y-1">
                {havbKaart && <li><PdfLink doc={havbKaart} label="Verzekeringskaart bedrijfsaansprakelijkheid (HAVB-08B)" /></li>}
                {kantoorrisico && <li><PdfLink doc={kantoorrisico} /></li>}
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">Brochures en de documenten van ZP Zaken vind je op <Link to="/documenten" className="text-accent hover:underline">Documenten en downloads</Link>.</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
