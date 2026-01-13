import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Mail, MapPin, Clock, Calendar, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formElement = e.currentTarget;
    const formDataRaw = new FormData(formElement);
    
    const naam = (formDataRaw.get("name") as string) || "";
    const naamParts = naam.trim().split(" ");
    const voornaam = naamParts[0] || "";
    const achternaam = naamParts.slice(1).join(" ") || "";
    const email = (formDataRaw.get("email") as string) || "";
    const telefoon = (formDataRaw.get("phone") as string) || "";
    const beroep = (formDataRaw.get("profession") as string) || "";
    const onderwerp = (formDataRaw.get("subject") as string) || "";
    const bericht = (formDataRaw.get("message") as string) || "";

    try {
      // Prepare data for AFAS
      const afasData = {
        naam,
        voornaam,
        achternaam,
        email,
        telefoon,
        beroep,
        onderwerp,
        bericht,
        bron: "website",
        type: "contact",
        timestamp: new Date().toISOString(),
      };

      // Send to AFAS (no-cors mode for cross-origin)
      await fetch("https://shop.zpzaken.nl/bav-jaarlijks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(afasData),
      });

      // Also save to database for admin dashboard
      const { error } = await supabase.from("leads").insert({
        type: "contact",
        voornaam: voornaam || naam,
        achternaam: achternaam || "-",
        email,
        telefoon: telefoon || null,
        beroep: beroep || null,
        opmerkingen: `Onderwerp: ${onderwerp}\n\n${bericht}`,
        bron: "website",
      });

      if (error) {
        console.error("Database error:", error);
        // Don't throw - AFAS submission succeeded
      }

      setIsSubmitted(true);
      toast({
        title: "Bericht verzonden!",
        description: "We nemen binnen 24 uur contact met je op.",
      });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast({
        title: "Er ging iets mis",
        description: "Probeer het later opnieuw of neem telefonisch contact op.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground py-16 md:py-24">
        <div className="container-wide">
          <div className="max-w-3xl">
            <h1 className="mb-6">
              Contact & advies aanvragen
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80">
              Heb je vragen of wil je een gratis adviesgesprek? Vul het formulier in 
              of neem direct contact met ons op. We reageren binnen 24 uur.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-3 gap-12 lg:gap-16">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-2xl p-8 lg:p-10 shadow-card border border-border/50">
                <h2 className="text-2xl font-semibold mb-2">Stuur een bericht</h2>
                <p className="text-muted-foreground mb-8">
                  Vul onderstaand formulier in en we nemen zo snel mogelijk contact met je op.
                </p>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-8 w-8 text-accent" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Bedankt voor je bericht!</h3>
                    <p className="text-muted-foreground mb-6">
                      We hebben je aanvraag ontvangen en nemen binnen 24 uur contact met je op.
                    </p>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                      Nieuw bericht sturen
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Naam *</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Je volledige naam"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mailadres *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="jouw@email.nl"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefoonnummer</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="06 - 12345678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profession">Beroep / sector</Label>
                        <Input
                          id="profession"
                          name="profession"
                          placeholder="Bijv. ICT consultant, designer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Onderwerp *</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="Waar kunnen we je mee helpen?"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Je bericht *</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Vertel ons meer over je situatie en vraag..."
                        rows={5}
                        required
                      />
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="privacy"
                        name="privacy"
                        required
                        className="mt-1"
                      />
                      <Label htmlFor="privacy" className="text-sm text-muted-foreground font-normal">
                        Ik ga akkoord met de privacyverklaring en geef toestemming om contact 
                        met mij op te nemen over mijn vraag.
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      variant="accent"
                      size="lg"
                      className="w-full sm:w-auto"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Verzenden..." : "Verstuur bericht"}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
                <h3 className="text-lg font-semibold mb-6">Direct contact</h3>
                <div className="space-y-4">
                  <a
                    href="tel:0201234567"
                    className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">020 - 123 4567</p>
                      <p className="text-sm">Bel ons direct</p>
                    </div>
                  </a>
                  <a
                    href="mailto:info@zpzaken.nl"
                    className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">info@zpzaken.nl</p>
                      <p className="text-sm">Mail ons</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Amsterdam</p>
                      <p className="text-sm">Nederland</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
                <h3 className="text-lg font-semibold mb-6">Openingstijden</h3>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-sm">
                    <p className="mb-2">
                      <span className="font-medium">Ma - Vr:</span>{" "}
                      <span className="text-muted-foreground">09:00 - 17:30</span>
                    </p>
                    <p>
                      <span className="font-medium">Za - Zo:</span>{" "}
                      <span className="text-muted-foreground">Gesloten</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-accent/10 rounded-2xl p-8 border border-accent/20">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-6 w-6 text-accent" />
                  <h3 className="text-lg font-semibold">Plan een gesprek</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Liever direct een afspraak inplannen? Kies een moment dat jou uitkomt.
                </p>
                <Button variant="accent" size="sm" className="w-full">
                  Open agenda
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
