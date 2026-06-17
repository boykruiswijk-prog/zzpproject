import { Helmet } from "react-helmet-async";
import { CheckCircle2, ArrowRight, Phone, MessageCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";

export default function OfferteBedankt() {
  return (
    <Layout>
      <Helmet>
        <title>Bedankt voor je offerteaanvraag | ZP Zaken</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <section className="section-padding bg-secondary min-h-[60vh] flex items-center">
        <div className="container-wide max-w-2xl text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent mb-6">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mb-4">Bedankt! Je offerteaanvraag is verstuurd</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Een adviseur neemt binnen 24 uur contact met je op met een persoonlijke offerte.
            Je ontvangt zo ook een bevestiging per e-mail.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
            <Button asChild variant="accent" size="lg">
              <LocalizedLink to="/">
                Terug naar home <ArrowRight className="h-5 w-5" />
              </LocalizedLink>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="tel:+31204573077">
                <Phone className="h-5 w-5" /> 020 - 457 3077
              </a>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="https://wa.me/31652064589" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
