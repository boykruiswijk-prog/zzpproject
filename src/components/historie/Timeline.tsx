import { useEffect, useRef, useState } from "react";
import { 
  Rocket, 
  Building2, 
  Award, 
  TrendingUp,
  Sparkles,
  Shield,
  PartyPopper,
  Coffee,
  Zap,
  Heart,
  Star
} from "lucide-react";
import officelogo from "@/assets/office-logo.jpg";
import teamRoxy from "@/assets/team-roxy.jpg";
import officeCookies from "@/assets/office-cookies.jpg";
import officeCoffee from "@/assets/office-coffee.jpg";

const timelineEvents = [
  {
    year: "2014",
    title: "De start van een droom",
    subtitle: "Ontstaan vanuit HeadFirst",
    description: "ZP Zaken werd geboren vanuit Kennisbemiddelaar HeadFirst. Oprichter Boy Kruiswijk zag een gat in de markt: zzp'ers verdienden persoonlijke begeleiding en unieke verzekeringsoplossingen.",
    icon: Rocket,
    highlight: "Het fundament gelegd",
    stats: "Eerste klanten geholpen",
    color: "from-orange-500 to-red-500",
    image: officelogo,
  },
  {
    year: "2017",
    title: "Op eigen kracht",
    subtitle: "Volledig zelfstandig",
    description: "Na drie jaar groeien was het tijd voor de volgende stap. ZP Zaken werd volledig onafhankelijk en kon haar eigen koers varen.",
    icon: TrendingUp,
    highlight: "100% onafhankelijk",
    stats: "Eigen identiteit",
    color: "from-blue-500 to-indigo-500",
    image: null,
  },
  {
    year: "2019",
    title: "Het jaar van de automatisering",
    subtitle: "Schaalbaar met behoud van persoonlijk contact",
    description: "Vergaande automatisering, maar met behoud van klantcontact — want wij geloven in mensen en zaken doen met mensen, niet in zakendoen met systemen.",
    icon: Zap,
    highlight: "Automatisering",
    stats: "Schaalbaar & persoonlijk",
    color: "from-yellow-500 to-orange-500",
    image: teamRoxy,
  },
  {
    year: "2022",
    title: "Een eigen thuis",
    subtitle: "Kantoor in Hoofddorp",
    description: "De groei vroeg om meer ruimte. In het hart van Hoofddorp opende ZP Zaken haar eigen kantoor. Een plek waar ondernemers welkom zijn.",
    icon: Building2,
    highlight: "Eigen locatie",
    stats: "Hoofddorp",
    color: "from-green-500 to-emerald-500",
    image: null,
  },
  {
    year: "2024",
    title: "Marktleider in zzp-verzekeringen",
    subtitle: "Duizenden ondernemers geholpen",
    description: "ZP Zaken is uitgegroeid tot dé specialist voor zzp'ers in Nederland. Het bewijs dat persoonlijke aandacht en expertise het verschil maken.",
    icon: Award,
    highlight: "Marktleider",
    stats: "Duizenden klanten",
    color: "from-purple-500 to-pink-500",
    image: officeCookies,
  },
  {
    year: "Eind 2024",
    title: "Nieuw hoofdkantoor",
    subtitle: "Schiphol-Rijk, Tupolevlaan 41",
    description: "Een gloednieuw kantoor op Schiphol-Rijk. Tupolevlaan 41 is nu ons thuis — een moderne werkplek waar ondernemers altijd welkom zijn. En ja, de koffie is hier écht lekker.",
    icon: Coffee,
    highlight: "Nieuwe locatie",
    stats: "Schiphol-Rijk",
    color: "from-amber-500 to-yellow-500",
    image: officeCoffee,
  },
  {
    year: "2026",
    title: "Klaar voor de toekomst",
    subtitle: "Nieuwe website & innovatieve diensten",
    description: "Online screening voor zzp'ers én onze eigen factoring-oplossing. Geen risico's meer, maar zekerheid: uitbetaling binnen 24 uur en faillissementsrisico afgedekt.",
    icon: Sparkles,
    highlight: "Innovatie",
    stats: "Screening & Factoring",
    color: "from-pink-500 to-rose-500",
    image: null,
  },
];

interface TimelineItemProps {
  event: typeof timelineEvents[0];
  index: number;
  isVisible: boolean;
}

function TimelineItem({ event, index, isVisible }: TimelineItemProps) {
  const isEven = index % 2 === 0;
  const Icon = event.icon;

  return (
    <div
      className={`relative lg:flex lg:items-center lg:gap-12 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      } ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Content Card */}
      <div className={`lg:w-[calc(50%-3rem)] ${isEven ? "lg:text-right" : "lg:text-left"}`}>
        <div className="group relative bg-card rounded-3xl shadow-lg border border-border/50 hover:shadow-2xl hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          {/* Background Image if available */}
          {event.image && (
            <div className="relative h-48 overflow-hidden">
              <img
                src={event.image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                aria-hidden="true"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${event.color} opacity-20`} />
            </div>
          )}
          
          <div className="p-6 md:p-8 relative">
            {/* Gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${event.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            

            {/* Year Badge with animation */}
            <div className={`relative inline-flex items-center gap-2 bg-gradient-to-r ${event.color} text-white px-5 py-2.5 rounded-full text-lg font-bold mb-4 shadow-lg group-hover:scale-105 transition-transform duration-300 ${
              isEven ? "lg:ml-auto" : ""
            }`}>
              <PartyPopper className="h-4 w-4 animate-pulse" />
              {event.year}
            </div>

            <h3 className="relative text-xl md:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
              {event.title}
            </h3>
            <p className="relative text-accent font-semibold mb-4 flex items-center gap-2 justify-start lg:justify-inherit">
              {!isEven && <Heart className="h-4 w-4 text-accent animate-pulse" />}
              {event.subtitle}
              {isEven && <Heart className="h-4 w-4 text-accent animate-pulse lg:order-first" />}
            </p>
            <p className="relative text-muted-foreground leading-relaxed mb-5">
              {event.description}
            </p>

            {/* Stats badges with hover effects */}
            <div className={`relative flex flex-wrap gap-2 ${isEven ? "lg:justify-end" : "lg:justify-start"}`}>
              <span className="inline-flex items-center gap-1.5 bg-secondary text-foreground px-3 py-2 rounded-xl text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-default">
                <Shield className="h-3.5 w-3.5" />
                {event.highlight}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-accent/20 to-accent/10 text-accent px-3 py-2 rounded-xl text-sm font-medium border border-accent/20">
                <Star className="h-3.5 w-3.5" />
                {event.stats}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Icon - Desktop */}
      <div className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2 z-20">
        <div className={`relative w-20 h-20 bg-gradient-to-br ${event.color} rounded-full flex items-center justify-center shadow-xl group cursor-pointer hover:scale-110 transition-transform duration-300`}>
          {/* Pulsing ring */}
          <div className={`absolute inset-0 bg-gradient-to-br ${event.color} rounded-full animate-ping opacity-20`} />
          <div className="absolute inset-1 bg-card rounded-full flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>

      {/* Mobile Icon */}
      <div className="lg:hidden absolute left-0 top-0 z-20">
        <div className={`w-14 h-14 bg-gradient-to-br ${event.color} rounded-full flex items-center justify-center shadow-lg -ml-2`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Spacer for opposite side */}
      <div className="hidden lg:block lg:w-[calc(50%-3rem)]" />
    </div>
  );
}

export function Timeline() {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleItems((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -50px 0px" }
    );

    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* Animated vertical line - Desktop */}
      <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1.5 hidden lg:block">
        <div className="h-full w-full bg-gradient-to-b from-primary via-accent to-primary rounded-full relative overflow-hidden">
          {/* Animated glow effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Mobile vertical line */}
      <div className="absolute left-5 top-0 h-full w-1 bg-gradient-to-b from-primary via-accent to-primary rounded-full lg:hidden" />

      <div className="space-y-8 lg:space-y-16 pl-16 lg:pl-0">
        {timelineEvents.map((event, index) => (
          <div
            key={event.year}
            ref={(el) => (itemRefs.current[index] = el)}
            data-index={index}
          >
            <TimelineItem 
              event={event} 
              index={index} 
              isVisible={visibleItems.has(index)} 
            />
          </div>
        ))}
      </div>

      {/* Celebration confetti decoration at the end */}
      <div className="flex justify-center mt-12 lg:mt-16">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 px-6 py-3 rounded-full border border-accent/30 animate-pulse">
          <PartyPopper className="h-5 w-5 text-accent" />
          <span className="font-semibold text-foreground">En het avontuur gaat door...</span>
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
