import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Mail, MapPin, Clock, CheckCircle, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { trackContactFormSubmit } from "@/lib/tracking";
import teamRoxy from "@/assets/team-roxy.jpg";
import ellenPortrait from "@/assets/ellen-baars-portrait.jpg";

export default function Contact() {
  const { t } = useTranslation();
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
       const { error } = await supabase.from("leads").insert({
        type: "contact", voornaam: voornaam || naam, achternaam: achternaam || "-", email, telefoon: telefoon || null, beroep: beroep || null, opmerkingen: `Onderwerp: ${onderwerp}\n\n${bericht}`, bron: "website",
      });
      if (error) console.error("Database error:", error);

      // Send email notification (fire-and-forget)
      supabase.functions.invoke("send-notification", {
        body: {
          type: "contact",
          naam: naam,
          email: email,
          bericht: `Onderwerp: ${onderwerp}\n\n${bericht}`,
        },
      }).catch((err) => console.error("Email notification failed:", err));

      trackContactFormSubmit();
      setIsSubmitted(true);
      toast({ title: t("contact.toastSuccess"), description: t("contact.toastSuccessDesc") });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast({ title: t("contact.toastError"), description: t("contact.toastErrorDesc"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Contact | Gratis Adviesgesprek Aanvragen | ZP Zaken</title>
        <meta name="description" content="Neem contact op met ZP Zaken voor persoonlijk verzekeringsadvies. Bel 023 - 201 0502, mail info@zpzaken.nl of plan een gratis adviesgesprek." />
        <link rel="canonical" href="https://zpzaken.nl/contact" />
      </Helmet>
      <PageHero
        title={t("contact.title")}
        subtitle={t("contact.subtitle")}
        badge={{ icon: <MessageCircle className="h-4 w-4" />, text: t("contact.badge") }}
        backgroundImage={teamRoxy}
      />

      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="grid lg:grid-cols-3 gap-12 lg:gap-16">
            <div className="lg:col-span-2">
              <div className="bg-card rounded-2xl p-8 lg:p-10 shadow-card border border-border/50">
                <h2 className="text-2xl font-semibold mb-2">{t("contact.formTitle")}</h2>
                <p className="text-muted-foreground mb-8">{t("contact.formSubtitle")}</p>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-8 w-8 text-accent" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t("contact.successTitle")}</h3>
                    <p className="text-muted-foreground mb-6">{t("contact.successDesc")}</p>
                    <Button variant="outline" onClick={() => setIsSubmitted(false)}>{t("contact.newMessage")}</Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t("contact.name")} *</Label>
                        <Input id="name" name="name" placeholder={t("contact.namePlaceholder")} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("contact.email")} *</Label>
                        <Input id="email" name="email" type="email" placeholder={t("contact.emailPlaceholder")} required />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone">{t("contact.phone")}</Label>
                        <Input id="phone" name="phone" type="tel" placeholder={t("contact.phonePlaceholder")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profession">{t("contact.profession")}</Label>
                        <Input id="profession" name="profession" placeholder={t("contact.professionPlaceholder")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">{t("contact.subject")} *</Label>
                      <Input id="subject" name="subject" placeholder={t("contact.subjectPlaceholder")} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">{t("contact.message")} *</Label>
                      <Textarea id="message" name="message" placeholder={t("contact.messagePlaceholder")} rows={5} required />
                    </div>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" id="privacy" name="privacy" required className="mt-1" />
                      <Label htmlFor="privacy" className="text-sm text-muted-foreground font-normal">{t("contact.privacy")}</Label>
                    </div>
                    <Button type="submit" variant="accent" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
                      {isSubmitting ? t("contact.submitting") : t("contact.submit")}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
                <h3 className="text-lg font-semibold mb-6">{t("contact.directContact")}</h3>
                <div className="space-y-4">
                  <a href="tel:0232010502" className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center"><Phone className="h-5 w-5 text-accent" /></div>
                    <div><p className="font-medium text-foreground">023 - 201 0502</p><p className="text-sm">{t("contact.callUs")}</p></div>
                  </a>
                  <a href="mailto:info@zpzaken.nl" className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center"><Mail className="h-5 w-5 text-accent" /></div>
                    <div><p className="font-medium text-foreground">info@zpzaken.nl</p><p className="text-sm">{t("contact.mailUs")}</p></div>
                  </a>
                  <a href="https://wa.me/31652064589" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-muted-foreground hover:text-foreground transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center"><MessageCircle className="h-5 w-5 text-accent" /></div>
                    <div><p className="font-medium text-foreground">06 5206 4589</p><p className="text-sm">WhatsApp ons</p></div>
                  </a>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center"><MapPin className="h-5 w-5 text-accent" /></div>
                    <div><p className="font-medium text-foreground">Tupolevlaan 41, 1119 NW Schiphol-Rijk</p><p className="text-sm">Nederland</p></div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50">
                <img
                  src={ellenPortrait}
                  alt="Ellen Baars - Senior Adviseur ZP Zaken"
                  className="w-full object-cover"
                  style={{ borderRadius: "12px 12px 0 0", objectPosition: "center top", maxHeight: "400px" }}
                />
                <div className="p-6">
                  <p className="font-semibold text-foreground">Ellen Baars</p>
                  <p className="text-sm text-accent mb-3">Senior Adviseur — ZP Zaken</p>
                  <p className="text-sm text-muted-foreground">
                    Ik help je graag bij het vinden van de juiste verzekering. Neem gerust contact op — ik reageer binnen 24 uur.
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50">
                <h3 className="text-lg font-semibold mb-6">{t("contact.openingHours")}</h3>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"><Clock className="h-5 w-5 text-accent" /></div>
                  <div className="text-sm">
                    <p className="mb-2"><span className="font-medium">{t("contact.monFri")}</span> <span className="text-muted-foreground">{t("contact.monFriHours")}</span></p>
                    <p><span className="font-medium">{t("contact.satSun")}</span> <span className="text-muted-foreground">{t("contact.closed")}</span></p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
