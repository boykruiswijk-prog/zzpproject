import { Star, Quote } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const testimonials = [
  {
    name: "Lisa van der Berg",
    role: "Freelance designer",
    content: "Eindelijk iemand die uitlegt wat je écht nodig hebt. Geen onnodige verzekeringen, wel goede dekking. Super tevreden!",
    rating: 5,
  },
  {
    name: "Mark Jansen",
    role: "ICT Consultant",
    content: "Als IT'er werd ik door opdrachtgevers verplicht om een beroepsaansprakelijkheidsverzekering te hebben. Zpzaken hielp me snel aan de juiste polis.",
    rating: 5,
  },
  {
    name: "Sandra de Vries",
    role: "ZZP'er",
    content: "Het adviesgesprek was echt verhelderend. Ik had geen idee dat ik onderverzekerd was. Nu voel ik me veel zekerder.",
    rating: 5,
  },
  {
    name: "Peter Bakker",
    role: "Bouwkundige",
    content: "Snelle service en eerlijk advies. Ze pushen niet, maar denken echt met je mee. Aanrader voor elke zzp'er!",
    rating: 5,
  },
  {
    name: "Anna Vermeer",
    role: "Marketing consultant",
    content: "Binnen een dag had ik een passende verzekering. Het hele proces was helder en zonder gedoe.",
    rating: 5,
  },
  {
    name: "Joost Hendriks",
    role: "Filmmaker",
    content: "Als creatieve ondernemer had ik geen idee welke aansprakelijkheidsverzekering ik nodig had. ZP Zaken legde het helder uit en regelde alles snel.",
    rating: 5,
  },
  {
    name: "Michelle Groot",
    role: "Interimmanager",
    content: "Na jaren bij een grote verzekeraar eindelijk persoonlijk contact. Ze kennen mijn situatie en denken proactief mee.",
    rating: 5,
  },
  {
    name: "Robert Visser",
    role: "Projectleider",
    content: "Ik was sceptisch over online advies, maar ze namen echt de tijd. Nu heb ik een pakket dat betaalbaar is én goed dekt.",
    rating: 5,
  },
  {
    name: "Eva Mulder",
    role: "Tekstschrijver",
    content: "Heel fijn dat ze ook aan arbeidsongeschiktheid denken. Daar had ik zelf niet bij stilgestaan. Dankjewel!",
    rating: 5,
  },
  {
    name: "Thomas de Wit",
    role: "Testmanager",
    content: "De combinatiepolis van beroeps- en bedrijfsaansprakelijkheid scheelt me honderden euro's per jaar. Slim geregeld.",
    rating: 5,
  },
  {
    name: "Fatima El Amrani",
    role: "Changemanager",
    content: "In de zorg is goede verzekering essentieel. ZP Zaken begreep direct wat ik nodig had. Zeer tevreden met het advies.",
    rating: 5,
  },
  {
    name: "Kees van Dijk",
    role: "ZZP'er",
    content: "Eerlijk advies, geen verborgen kosten. Precies wat je als ondernemer wilt. Ik raad ze iedereen aan.",
    rating: 5,
  },
];

const stats = [
  { value: "2.500+", label: "Tevreden klanten" },
  { value: "4.9/5", label: "Gemiddelde beoordeling" },
  { value: "10+", label: "Jaar ervaring" },
  { value: "24u", label: "Gemiddelde reactietijd" },
];

export function SocialProofSection() {
  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="mb-4">
            Wat zzp'ers over ons zeggen
          </h2>
          <p className="text-muted-foreground">
            Lees de ervaringen van ondernemers die ons voorgingen.
          </p>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {testimonials.map((testimonial) => (
              <CarouselItem key={testimonial.name} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <div className="bg-card rounded-xl p-6 shadow-card border border-border relative h-full">
                  <Quote className="absolute top-5 right-5 h-6 w-6 text-primary/10" />
                  
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                    ))}
                  </div>
                  
                  <p className="text-foreground text-sm mb-5 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  
                  <div>
                    <p className="font-medium text-foreground text-sm">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-4 mt-6">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        </Carousel>

        {/* Trust badges */}
        <div className="mt-12 pt-10 border-t border-border">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs text-primary">
                AFM
              </div>
              <span className="text-sm">AFM geregistreerd</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-xs text-primary">
                Kifid
              </div>
              <span className="text-sm">Kifid aangesloten</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center">
                <Star className="h-5 w-5 fill-accent text-accent" />
              </div>
              <span className="text-sm">Google Reviews 4.9</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
