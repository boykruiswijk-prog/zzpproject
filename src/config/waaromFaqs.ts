// FAQ's van /waarom-zp-zaken. Losgekoppeld van de component zodat zowel de
// pagina als de prerender-stap dezelfde bron gebruiken.
//
// Regel: een vraag mag hier alleen staan als het antwoord ook zichtbaar op de
// pagina wordt beantwoord. De FAQSection rendert alle items hieronder, en de
// prerender-stap zet diezelfde vragen en antwoorden in de statische HTML.

export interface WaaromFaq {
  q: string;
  a: string;
}

export const waaromFaqs: WaaromFaq[] = [
  {
    q: "Wat is het verschil tussen een platformverzekering en een eigen polis bij ZP Zaken?",
    a: "Een platformverzekering is gekoppeld aan jouw opdracht bij dat platform. Zodra de opdracht eindigt, eindigt ook je dekking. Een eigen polis bij ZP Zaken staat op jouw naam, loopt door zolang jij dat wilt en is dagelijks opzegbaar. Jij hebt de controle.",
  },
  {
    q: "Kan ik naast mijn intermediairverzekering ook bij ZP Zaken verzekerd zijn?",
    a: "Dat hoeft niet :  bij ZP Zaken heb je al betere dekking voor een lagere prijs. Je kunt je intermediair laten weten dat je al verzekerd bent via een eigen polis.",
  },
  {
    q: "Waarom biedt ZP Zaken ook bemiddeling via Onefellow?",
    a: "Omdat een goede zzp'er meer verdient dan alleen een goede opdracht. Onefellow bemiddelt gratis voor jou als zelfstandige :  geen kosten, wel persoonlijk contact.",
  },
  {
    q: "Hoe kan ZP Zaken zoveel goedkoper zijn?",
    a: "Wij werken met een mantelovereenkomst voor 5.000+ zzp'ers. Door de premie te delen over een grote groep blijft de prijs structureel laag. Geen winstmarge voor een tussenpersoon bovenop.",
  },
  {
    q: "Wat als ik tussen opdrachten zit :  ben ik dan verzekerd?",
    a: "Ja. Jouw polis bij ZP Zaken loopt gewoon door. Je bent dagelijks opzegbaar maar nooit automatisch gestopt. Dat is het fundamentele verschil met een intermediairverzekering.",
  },
];
