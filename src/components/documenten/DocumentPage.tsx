import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";

interface DocumentPageProps {
  title: string;
  versie: string;
  metaDescription: string;
  canonicalSlug: string; // e.g. "slotverklaring"
  children: ReactNode;
}

export function DocumentPage({
  title,
  versie,
  metaDescription,
  canonicalSlug,
  children,
}: DocumentPageProps) {
  const today = formatDateNL(new Date());
  const url = `https://zpzaken.nl/documenten/${canonicalSlug}`;

  return (
    <Layout>
      <Helmet>
        <title>{title} | ZP Zaken</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={`${title} | ZP Zaken`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={url} />
        <style>{`
          @media print {
            header, footer, nav, .no-print { display: none !important; }
            .doc-print-area { max-width: none !important; padding: 0 !important; }
            body { background: white !important; }
          }
          .doc-prose { font-size: 18px; line-height: 1.7; }
          .doc-prose h2 { font-size: 28px; font-weight: 600; margin-top: 48px; margin-bottom: 16px; }
          .doc-prose h3 { font-size: 22px; font-weight: 600; margin-top: 32px; margin-bottom: 12px; }
          .doc-prose p { margin-bottom: 16px; }
          .doc-prose ul { list-style: none; padding-left: 0; margin-bottom: 16px; }
          .doc-prose ul li { position: relative; padding-left: 24px; margin-bottom: 12px; }
          .doc-prose ul li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0.7em;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: hsl(var(--accent));
          }
          @media (max-width: 768px) {
            .doc-prose { font-size: 16px; }
            .doc-prose h2 { font-size: 24px; margin-top: 36px; }
            .doc-prose h3 { font-size: 20px; margin-top: 24px; }
          }
        `}</style>
      </Helmet>

      <section className="bg-muted/30 border-b border-border/60">
        <div className="container-wide py-10 md:py-14">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-accent tracking-wider uppercase mb-2">
                ZP Zaken
              </p>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
              <p className="text-muted-foreground">{versie}</p>
            </div>
            <div className="no-print">
              <Button variant="accent" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print of bewaar als PDF
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container-wide py-12 md:py-16">
          <article className="doc-print-area doc-prose max-w-3xl mx-auto text-foreground">
            {children}
          </article>
        </div>
      </section>

      <section className="bg-muted/40 border-t border-border/60">
        <div className="container-wide py-10">
          <div className="max-w-3xl mx-auto text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">ZP Zaken B.V.</p>
            <p>
              Tupolevlaan 41-61, 1119 NW Schiphol-Rijk · 020 - 457 3077 ·{" "}
              <a href="mailto:info@zpzaken.nl" className="text-accent hover:underline">
                info@zpzaken.nl
              </a>
            </p>
            <p>AFM 12050636 · KvK 62117092 · Kifid 300.019283</p>
            <p className="pt-2 italic">Document gegenereerd op {today}</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
