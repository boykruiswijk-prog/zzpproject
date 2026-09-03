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
