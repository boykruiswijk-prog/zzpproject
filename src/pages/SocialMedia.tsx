import { LocalizedLink } from "@/components/LocalizedLink";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/layout/Layout";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, Share2, CheckCircle, Shield, Users, Star, Phone, 
  ExternalLink, MessageSquare, BookOpen, Scale, FileCheck
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import teamHero from "@/assets/team-hero.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const trustPoints = [
  { icon: Users, title: "Directe benadering", description: "Geen onnodige tussenpartijen — je spreekt direct met een adviseur die jouw situatie begrijpt." },
  { icon: Shield, title: "Specialist in aansprakelijkheid", description: "Beroeps- én bedrijfsaansprakelijkheid onder één dak, met onze unieke BAV+AVB combinatiepolis." },
  { icon: CheckCircle, title: "Transparant advies", description: "Eerlijk, onafhankelijk advies zonder verborgen kosten. Wij adviseren alleen wat je écht nodig hebt." },
  { icon: Star, title: "Persoonlijke begeleiding", description: "Een klein team dat klaarstaat. Altijd een mens aan de lijn, nooit een callcenter." },
];

const stats = [
  { value: "2.500+", label: "Tevreden zzp'ers" },
  { value: "4.9/5", label: "Google Reviews" },
  { value: "13+", label: "Jaar ervaring" },
  { value: "< 24u", label: "Reactietijd" },
];

const linkedInContent = [
  "Praktische tips voor zzp'ers over verzekeringen en risicobeheer",
  "Updates over wet- en regelgeving die jou als ondernemer raken",
  "Inzichten over beroeps- en bedrijfsaansprakelijkheid",
  "Praktijkcases en ervaringen van ondernemers",
  "Nieuws over de arbeidsmarkt voor zelfstandigen",
];

const faqs = [
  {
    q: "Welke verzekering heeft een zzp'er nodig?",
    a: "Dat hangt af van je beroep en situatie. De meeste zzp'ers hebben minimaal een beroepsaansprakelijkheidsverzekering (BAV) en bedrijfsaansprakelijkheidsverzekering (AVB) nodig. Wij bieden een unieke combinatiepolis die beide dekt. Plan een gratis adviesgesprek en we bekijken samen wat bij jou past."
  },
  {
    q: "Is een beroepsaansprakelijkheidsverzekering verplicht?",
    a: "In veel sectoren wordt een BAV verplicht gesteld door opdrachtgevers. Hoewel het wettelijk niet altijd verplicht is, is het vrijwel onmisbaar als je werkt in de IT, consultancy, financiën of andere kennisintensieve sectoren. Zonder BAV loop je het risico persoonlijk aansprakelijk gesteld te worden voor beroepsfouten."
  },
  {
    q: "Wat kost een bedrijfsaansprakelijkheidsverzekering?",
    a: "De kosten variëren per beroep, omzet en gewenste dekking. Onze BAV+AVB combinatiepolis begint al vanaf een scherp maandtarief. Vraag een vrijblijvende offerte aan voor een indicatie op maat."
  },
  {
    q: "Waarom is aansprakelijkheid belangrijk voor zzp'ers?",
    a: "Als zzp'er ben je persoonlijk aansprakelijk voor schade die je veroorzaakt tijdens je werk. Zonder de juiste verzekering kan één fout leiden tot financiële problemen. Een goede aansprakelijkheidsverzekering beschermt je onderneming én je privévermogen."
  },
];

export default function SocialMedia() {
  return (
    <Layout>
      <Helmet>
        <title>Social Media & Verzekeringen voor ZZP'ers | ZP Zaken</title>
        <meta name="description" content="Volg ZP Zaken voor tips over aansprakelijkheid, beroeps- en bedrijfsaansprakelijkheidsverzekeringen voor zzp'ers. Zeker ondernemen begint hier." />
        <link rel="canonical" href="https://zpzaken.nl/social-media" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "ZP Zaken",
          "url": "https://zpzaken.nl",
          "sameAs": [
            "https://www.linkedin.com/company/zpzaken"
          ],
          "description": "Onafhankelijk advies over verzekeringen voor zzp'ers en zelfstandig ondernemers."
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(f => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        })}</script>
      </Helmet>

      {/* 1. Hero */}
      <PageHero
        title={<>Social Media & Zeker Ondernemen als <span className="text-accent">ZZP'er</span></>}
        subtitle="Blijf op de hoogte van ondernemersnieuws, verzekeringen en risico's voor zelfstandigen. Volg ons en onderneem met vertrouwen."
        badge={{ icon: <Share2 className="h-4 w-4" />, text: "Volg ZP Zaken" }}
        backgroundImage={teamHero}
      >
        <div className="flex flex-wrap gap-4">
          <Button variant="accent" size="lg" asChild>
            <a href="https://www.linkedin.com/company/zpzaken" target="_blank" rel="noopener noreferrer">
              Volg ons op LinkedIn <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button size="lg" variant="outline" className="bg-background/10 text-primary-foreground border-primary-foreground/30 hover:bg-background/20" asChild>
            <LocalizedLink to="/contact">Vraag gratis advies aan <ArrowRight className="h-4 w-4" /></LocalizedLink>
          </Button>
        </div>
      </PageHero>

      {/* 2. Waarom social media belangrijk is */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-6">Waarom online zichtbaarheid belangrijk is voor <span className="text-primary">zzp'ers</span></h2>
            <div className="prose prose-lg text-muted-foreground space-y-4">
              <p>
                Als zelfstandig ondernemer is het essentieel om op de hoogte te blijven van ontwikkelingen rondom <strong>zzp verzekeringen</strong>, <strong>aansprakelijkheid</strong> en wet- en regelgeving. De wereld van ondernemerschap verandert snel — en de risico's veranderen mee.
              </p>
              <p>
                Bij ZP Zaken geloven we dat kennis delen de basis is van goed ondernemerschap. Via onze social media kanalen delen we praktische tips, updates over <strong>beroepsaansprakelijkheid</strong> en <strong>bedrijfsaansprakelijkheid</strong>, en inzichten die je helpen om weloverwogen beslissingen te nemen over je <strong>ondernemersrisico</strong>.
              </p>
              <p>
                Of je nu net start als zzp'er of al jaren zelfstandig bent: door ons te volgen blijf je altijd een stap voor. Zo kun je focussen op wat je het beste doet — je vak uitoefenen — terwijl wij je helpen de risico's te beperken.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Platforms - LinkedIn */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#0A66C2]/10 border border-[#0A66C2]/20 text-[#0A66C2] px-4 py-2 rounded-full mb-6">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                <span className="text-sm font-semibold">LinkedIn</span>
              </div>
              <h2 className="mb-4">Volg ZP Zaken op <span className="text-primary">LinkedIn</span></h2>
              <p className="text-lg text-muted-foreground mb-6">
                LinkedIn is ons belangrijkste platform. Hier delen wij kennis, tips en updates die relevant zijn voor jou als zelfstandig ondernemer.
              </p>
              <ul className="space-y-3 mb-8">
                {linkedInContent.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="accent" size="lg" asChild>
                <a href="https://www.linkedin.com/company/zpzaken" target="_blank" rel="noopener noreferrer">
                  Volg ZP Zaken op LinkedIn <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 bg-[#0A66C2] rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-lg">ZP Zaken</p>
                  <p className="text-sm text-muted-foreground">Verzekeringen & zakelijke zekerheid voor zzp'ers</p>
                </div>
              </div>
              <div className="space-y-4 border-t border-border pt-6">
                <div className="bg-secondary rounded-xl p-4">
                  <p className="text-sm font-medium mb-1">📌 Laatste post</p>
                  <p className="text-sm text-muted-foreground">Wist je dat de premie voor zakelijke verzekeringen vaak fiscaal aftrekbaar is? Dat maakt je BAV+AVB combinatiepolis netto een stuk voordeliger.</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Volgers</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> Wekelijkse posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Vertrouwen & Autoriteit */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="mb-4">Waarom zzp'ers kiezen voor <span className="text-primary">ZP Zaken</span></h2>
            <p className="text-lg text-muted-foreground">Al meer dan 13 jaar de partner voor zelfstandig ondernemers die zekerheid zoeken.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {trustPoints.map((point) => (
              <div key={point.title} className="bg-card border border-border/50 rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <point.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{point.title}</h3>
                <p className="text-sm text-muted-foreground">{point.description}</p>
              </div>
            ))}
          </div>
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="inline-flex items-center gap-3 bg-primary/5 border border-primary/10 px-6 py-4 rounded-xl">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SEO Content Block */}
      <section className="section-padding bg-secondary">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-8">Verzekeringen voor <span className="text-primary">ZZP'ers</span> en Ondernemers</h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="flex items-center gap-2 mb-3">
                  <FileCheck className="h-5 w-5 text-accent" />
                  Beroepsaansprakelijkheidsverzekering (BAV)
                </h3>
                <p className="text-muted-foreground">
                  Een beroepsaansprakelijkheidsverzekering beschermt je tegen claims die voortkomen uit fouten in je professionele werkzaamheden. Als zzp'er in de IT, consultancy, finance of andere kennisintensieve sectoren is een BAV vaak een vereiste van opdrachtgevers. De verzekering dekt onder andere vermogensschade door onjuist advies, fouten in opdrachten en schending van intellectueel eigendom. Bij ZP Zaken bieden wij een <LocalizedLink to="/verzekeringen" className="text-primary hover:underline font-medium">unieke BAV+AVB combinatiepolis</LocalizedLink> die je volledig beschermt.
                </p>
              </div>

              <div>
                <h3 className="flex items-center gap-2 mb-3">
                  <Scale className="h-5 w-5 text-accent" />
                  Bedrijfsaansprakelijkheidsverzekering (AVB)
                </h3>
                <p className="text-muted-foreground">
                  Een bedrijfsaansprakelijkheidsverzekering dekt schade die je als ondernemer toebrengt aan derden: denk aan letselschade of zaakschade tijdens je werkzaamheden. Voor veel zzp'ers is dit een basisverzekering die je beschermt tegen onverwachte financiële tegenvallers. Samen met een BAV vormt dit de basis van je zakelijke zekerheid. Bekijk onze <LocalizedLink to="/diensten" className="text-primary hover:underline font-medium">diensten</LocalizedLink> voor een compleet overzicht.
                </p>
              </div>

              <div>
                <h3 className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-5 w-5 text-accent" />
                  Rechtsbijstand voor ZZP'ers
                </h3>
                <p className="text-muted-foreground">
                  Juridische conflicten komen vaker voor dan je denkt: een opdrachtgever die niet betaalt, een geschil over een contract of een onterechte aansprakelijkstelling. Een rechtsbijstandverzekering geeft je toegang tot juridische hulp zonder dat je zelf hoge advocaatkosten hoeft te betalen. Wil je weten welke verzekeringen bij jouw situatie passen? <LocalizedLink to="/contact" className="text-primary hover:underline font-medium">Plan een gratis adviesgesprek</LocalizedLink>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="section-padding bg-background">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <h2 className="mb-2 text-center">Veelgestelde vragen over <span className="text-primary">zzp-verzekeringen</span></h2>
            <p className="text-center text-muted-foreground mb-8">Antwoorden op de meest gestelde vragen door zelfstandig ondernemers.</p>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border/50 rounded-xl px-6 shadow-sm">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* 7. CTA */}
      <section className="section-padding text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={officeCoffee} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/90 to-primary/85" />
        </div>
        <div className="container-wide relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="mb-4 text-primary-foreground">Wil jij weten welke verzekering past bij jouw onderneming?</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Plan een gratis adviesgesprek en ontdek binnen 15 minuten welke verzekeringen bij jouw situatie passen. Eerlijk, onafhankelijk en zonder verplichtingen.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Button variant="accent" size="lg" asChild>
                <LocalizedLink to="/contact">Gratis adviesgesprek <ArrowRight className="h-4 w-4" /></LocalizedLink>
              </Button>
              <Button size="lg" variant="outline" className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/20" asChild>
                <a href="tel:0232010502"><Phone className="h-4 w-4" /> Bel 023 - 201 0502</a>
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-primary-foreground/70">
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Gratis en vrijblijvend</span>
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Binnen 24 uur reactie</span>
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> AFM geregistreerd</span>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
