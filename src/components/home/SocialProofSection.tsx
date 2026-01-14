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
    role: "ZZP'er in de zorg",
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
];

const stats = [
  { value: "2.500+", label: "Tevreden klanten" },
  { value: "4.9/5", label: "Gemiddelde beoordeling" },
  { value: "10+", label: "Jaar ervaring" },
  { value: "24u", label: "Gemiddelde reactietijd" },
];

export function SocialProofSection() {
  return (
    <section className="section-padding bg-background">
      <div className="container-wide">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-primary mb-2">{stat.value}</p>
              <p className="text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="mb-4">
            Wat zzp'ers over ons zeggen
          </h2>
          <p className="text-lg text-muted-foreground">
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
                <div className="bg-card rounded-2xl p-8 shadow-card border border-border/50 relative h-full">
                  <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/20" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <p className="text-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-4 mt-8">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        </Carousel>

        {/* Trust badges */}
        <div className="mt-16 pt-12 border-t border-border">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center font-bold text-primary">
                AFM
              </div>
              <span className="text-sm">AFM geregistreerd</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center font-bold text-primary">
                Kifid
              </div>
              <span className="text-sm">Kifid aangesloten</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                <Star className="h-6 w-6 fill-primary text-primary" />
              </div>
              <span className="text-sm">Google Reviews 4.9</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
