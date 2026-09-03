// FAQPage-schema per kennisbankartikel.
//
// Regel: een vraag mag hier alleen staan als het antwoord ook zichtbaar op de
// pagina wordt beantwoord, en de antwoordtekst moet letterlijk overeenkomen met
// de zichtbare tekst in het artikel. Bedragen en percentages komen uit dezelfde
// fiscale tokens ({{fiscaal:...}}) als de artikeltekst, zodat schema en tekst
// nooit uiteen kunnen lopen.

export interface ArtikelFaqItem {
  question: string;
  /** Mag fiscale tokens bevatten; wordt bij render geresolveerd. */
  answer: string;
}

export const ARTIKEL_FAQS: Record<string, ArtikelFaqItem[]> = {
  "auto-van-de-zaak-of-prive": [
    {
      question: "Kan je je auto zakelijk rijden zonder bijtelling?",
      answer:
        "Dat hangt ervan af hoeveel kilometers je privé rijdt. Rij je minder dan {{fiscaal:bijtellingPriveKilometergrens:waarde}} per jaar privé, dan heb je geen bijtelling. Kom je privé boven die grens, dan dus wel.",
    },
    {
      question: "Hoe hoog is de bijtelling in {{fiscaal:bijtellingStandaardtarief:jaar}}?",
      answer:
        "In {{fiscaal:bijtellingStandaardtarief:jaar}} zijn er twee bijtellingstarieven, afhankelijk van de CO2-uitstoot: {{fiscaal:bijtellingVerlaagdTarief:waarde}} en {{fiscaal:bijtellingStandaardtarief:waarde}}. Heeft de auto CO2-uitstoot, dan geldt {{fiscaal:bijtellingStandaardtarief:waarde}} over de volledige cataloguswaarde.",
    },
    {
      question: "Wat is een rittenadministratie?",
      answer:
        "Een rittenadministratie wil zeggen dat je alle gereden kilometers bijhoudt en noteert of deze privé of zakelijk waren.",
    },
  ],
  "hoe-bereken-ik-bijtelling-als-zzper": [
    {
      question: "Wanneer betaal je bijtelling als zzp'er?",
      answer:
        "Je krijgt te maken met bijtelling als je meer dan {{fiscaal:bijtellingPriveKilometergrens:waarde}} per jaar privé gebruik maakt van de auto, die op naam van je zaak staat.",
    },
    {
      question: "Hoelang geldt het lage bijtellingspercentage?",
      answer:
        "Het lage percentage geldt voor {{fiscaal:bijtellingVastePeriode:waarde}}, gerekend vanaf de eerste tenaamstelling.",
    },
  ],
  "rijd-je-als-zzp-er-fiscaal-voordelig-met-een-youngtimer": [
    {
      question: "Wat is een youngtimer?",
      answer:
        "Een youngtimer is een auto die ouder is dan {{fiscaal:bijtellingYoungtimerLeeftijd:waarde}}. Net als bij oldtimers is er een speciale regeling. In dit geval wordt de bijtelling anders berekend.",
    },
    {
      question: "Hoeveel bijtelling betaal je voor een youngtimer?",
      answer:
        "Bij een youngtimer betaal je {{fiscaal:bijtellingYoungtimerTarief:waarde}} aan bijtelling over de huidige verkoopwaarde, de waarde in het economisch verkeer.",
    },
  ],
  "zzp-of-eenmanszaak": [
    {
      question: "Is zzp een eenmanszaak?",
      answer:
        "Je kunt als zzp'er je laten inschrijven als eenmanszaak, maar ook als bv. Dus ja, je kunt zzp'er zijn en een eenmanszaak hebben. Maar dat hoeft dus niet.",
    },
    {
      question: "Kan een eenmanszaak personeel hebben?",
      answer:
        "Een eenmanszaak is een rechtsvorm, waarbij je wel degelijk personeel in dienst kunt hebben. Het woorddeel 'eenmans' slaat namelijk op het aantal eigenaren van de onderneming.",
    },
  ],
  "zzp-en-belasting": [
    {
      question: "Welke belasting betaal je als zzp'er?",
      answer:
        "Als zzp'er heb je naast je inkomstenbelasting eveneens te maken met de belastingdienst als je btw-plichtig bent. Verder komt ook de Wettelijke bijdrage Zorgverzekeringswet om de hoek kijken.",
    },
    {
      question: "Hoe hoog is de bijdrage Zvw?",
      answer:
        "De bijdrage Zvw is een percentage van je inkomen: {{fiscaal:zvwBijdrageOndernemers:waarde}}. Dat maximum is {{fiscaal:zvwMaximaleBijdrage:waarde}}, berekend over een bijdrage-inkomen tot {{fiscaal:zvwMaximumBijdrageInkomen:waarde}}.",
    },
    {
      question: "Wanneer moet je belastingaangifte doen?",
      answer:
        "Je inkomstenbelasting moet je aangeven voor 1 mei, net zoals je zou moeten doen als je nog in loondienst zou werken. Je kunt eventueel uitstel vragen, maar dit moet dan wel voor 1 mei gebeuren.",
    },
  ],
  "zzp-aftrekposten": [
    {
      question: "Wat is het urencriterium?",
      answer:
        "Het urencriterium wil zeggen dat je minimaal {{fiscaal:urencriterium:waarde}} als zelfstandig ondernemer in het kalenderjaar werkzaam moet zijn geweest.",
    },
    {
      question: "Hoe hoog is de mkb-winstvrijstelling?",
      answer:
        "Het gaat om {{fiscaal:mkbWinstvrijstelling:waarde}} van de winst, waar dan al wel de ondernemersaftrek afgehaald is.",
    },
  ],
  "wat-is-de-zelfstandigenaftrek": [
    {
      question: "Hoe hoog is de zelfstandigenaftrek?",
      answer:
        "Voldoe je aan de voorwaarden? Dan mag je gebruikmaken van de zelfstandigenaftrek voor een bedrag van {{fiscaal:zelfstandigenaftrek}}. Het belastingvoordeel van de zelfstandigenaftrek is beperkt: het wordt berekend met een tarief van {{fiscaal:tariefcorrectieAftrekposten:waarde}}.",
    },
    {
      question: "Hoe vaak mag je de zelfstandigenaftrek toepassen?",
      answer:
        "De zelfstandigenaftrek komt gewoon ieder jaar terug bij de opgave van de inkomstenbelasting. Hier zit dus geen limiet aan, in tegenstelling tot de startersaftrek.",
    },
  ],
  "wat-is-startersaftrek": [
    {
      question: "Hoe hoog is de startersaftrek?",
      answer: "De startersaftrek is {{fiscaal:startersaftrek}}.",
    },
    {
      question: "Hoe vaak mag je startersaftrek toepassen?",
      answer:
        "Zoals gezegd mag je de startersaftrek drie keer gebruiken in de eerste vijf jaar van je onderneming. Startersaftrek kan niet doorgeschoven worden. Je moet dus gebruikmaken van deze aftrekpost als je hier recht op hebt.",
    },
  ],
  "wat-is-het-urencriterium": [
    {
      question: "Hoeveel uur is het urencriterium?",
      answer:
        "Je moet minimaal {{fiscaal:urencriterium:waarde}} per jaar aan je bedrijf werken om te voldoen aan deze regel.",
    },
    {
      question: "Wat is het verlaagd urencriterium?",
      answer:
        "Mensen die arbeidsongeschikt zijn en ondernemer zijn geworden, kunnen recht hebben op startersaftrek bij arbeidsongeschiktheid. Zij moeten dan voldoen aan het verlaagd urencriterium. Dit is 800 uur.",
    },
  ],
  "bijdrage-zorgverzekeringswet-zzp": [
    {
      question: "Is de bijdrage Zvw aftrekbaar?",
      answer:
        "Nee, de bijdrage Zvw is niet aftrekbaar van je belastbare winst. Dat geldt zowel voor de inkomensafhankelijke bijdrage Zvw als voor de premie van je eigen zorgverzekering.",
    },
    {
      question: "Hoeveel is de bijdrage Zvw dit jaar?",
      answer:
        "Voor {{fiscaal:zvwBijdrageOndernemers:jaar}} is het percentage van de Zvw voor ondernemers vastgesteld op {{fiscaal:zvwBijdrageOndernemers:waarde}}. De bijdrage wordt geheven over maximaal {{fiscaal:zvwMaximumBijdrageInkomen:waarde}} bijdrage-inkomen, waardoor de maximale bijdrage uitkomt op {{fiscaal:zvwMaximaleBijdrage:waarde}}.",
    },
    {
      question: "Wie betaalt de bijdrage Zvw als je daarnaast in loondienst bent?",
      answer:
        "Dan betaalt je werkgever over jouw loon de werkgeversheffing Zvw. Over het inkomen uit je eigen onderneming betaal je zelf de bijdrage Zvw. Dit moet je ook doen over inkomsten uit overig werk.",
    },
  ],
};
