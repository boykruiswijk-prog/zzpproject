export interface SearchEntry {
  title: string;
  path: string;
  keywords: string;
  snippet: string;
}

// Statische zoekindex voor publieke pagina's.
// Werk dit bij wanneer pagina-inhoud significant wijzigt.
export const searchIndex: SearchEntry[] = [
  {
    title: "Home — ZP Zaken",
    path: "/",
    keywords: "zzp verzekering BAV AVB combinatiepolis online afsluiten zelfstandig ondernemer",
    snippet: "BAV + AVB combinatieverzekering voor zzp'ers. Vanaf €30/maand, direct online afsluiten.",
  },
  {
    title: "Over ons",
    path: "/over-ons",
    keywords: "team Boy Kruiswijk Ellen Baars Roxy Gert-Jan adviseur missie",
    snippet: "Wie wij zijn: een team van adviseurs gespecialiseerd in zzp-verzekeringen. AFM geregistreerd.",
  },
  {
    title: "Voor wie",
    path: "/voor-wie",
    keywords: "doelgroep bouw techniek zorg welzijn consultancy HR finance ICT marketing PR",
    snippet: "ZP Zaken werkt voor zelfstandige professionals in techniek, zorg, consultancy, finance, ICT, marketing en zakelijke dienstverlening.",
  },
  {
    title: "Diensten",
    path: "/diensten",
    keywords: "diensten verzekering screening factoring juridisch administratie boekhouding",
    snippet: "Een overzicht van alle diensten: verzekeringen, screening, factoring, juridisch advies en administratie.",
  },
  {
    title: "Verzekeringen",
    path: "/verzekeringen",
    keywords: "BAV AVB rechtsbijstand AOV beroepsaansprakelijkheid bedrijfsaansprakelijkheid",
    snippet: "BAV en AVB combinatiepolis, AOV en rechtsbijstand. Direct online afsluiten of advies aanvragen.",
  },
  {
    title: "AOV",
    path: "/aov",
    keywords: "arbeidsongeschiktheid zzp AOV inkomen",
    snippet: "Bescherm je inkomen met een passende arbeidsongeschiktheidsverzekering.",
  },
  {
    title: "Pensioen",
    path: "/pensioen",
    keywords: "pensioen zzp oude dag",
    snippet: "Slim opbouwen voor later met een pensioenoplossing op maat.",
  },
  {
    title: "Zorgverzekering",
    path: "/zorgverzekering",
    keywords: "zorgverzekering ziektekosten zzp",
    snippet: "Vergelijk zorgverzekeringen voor zelfstandigen.",
  },
  {
    title: "Screening",
    path: "/screening",
    keywords: "screening Otentica VOG identiteit",
    snippet: "Professionele screening voor opdrachten waar veiligheid of vertrouwen vereist is.",
  },
  {
    title: "Kennisbank",
    path: "/kennisbank",
    keywords: "blog artikelen tips advies zzp ondernemen kennisbank",
    snippet: "Praktische artikelen voor zzp'ers over verzekeringen, ondernemen en regelgeving.",
  },
  {
    title: "Wet en regelgeving — Kennisbank",
    path: "/kennisbank/wet-en-regelgeving",
    keywords: "wet DBA modelovereenkomst regelgeving juridisch zelfstandigenregeling wetgeving",
    snippet: "Alles over Wet DBA, zelfstandigenregelingen en juridische aspecten voor zzp'ers.",
  },
  {
    title: "Ondernemen — Kennisbank",
    path: "/kennisbank/ondernemen",
    keywords: "ondernemen groei klantrelaties professionalisering risicomanagement zelfstandig",
    snippet: "Praktische tips voor groei, klantrelaties en risicomanagement als zelfstandige.",
  },
  {
    title: "Belastingen — Kennisbank",
    path: "/kennisbank/belastingen",
    keywords: "belasting belastingaangifte BTW aftrekposten fiscaal zzp",
    snippet: "Belastingaangifte, BTW en fiscale aftrekposten voor zzp'ers — helder uitgelegd.",
  },
  {
    title: "Financiën — Kennisbank",
    path: "/kennisbank/financien",
    keywords: "financien financieel beheer pensioen sparen beleggen toekomst",
    snippet: "Financieel beheer, pensioen en sparen voor zzp'ers.",
  },
  {
    title: "FAQ — Veelgestelde vragen",
    path: "/faq",
    keywords: "vragen antwoorden faq help",
    snippet: "Antwoorden op de meest gestelde vragen over onze dienstverlening en verzekeringen.",
  },
  {
    title: "Waarom ZP Zaken",
    path: "/waarom-zp-zaken",
    keywords: "voordelen onafhankelijk transparant directe partner geen bemiddelaar",
    snippet: "Onafhankelijk advies, transparante tarieven en direct contact. Geen tussenpersonen.",
  },
  {
    title: "Zo werken wij",
    path: "/zo-werken-wij",
    keywords: "werkwijze proces stappen advies",
    snippet: "Onze werkwijze in heldere stappen — van eerste contact tot polis.",
  },
  {
    title: "Partners",
    path: "/partners",
    keywords: "partners samenwerking verzekeraars",
    snippet: "Wij werken samen met betrouwbare partners en verzekeraars.",
  },
  {
    title: "Historie",
    path: "/historie",
    keywords: "geschiedenis tijdlijn 2014 jubileum",
    snippet: "ZP Zaken sinds 2014 — onze tijdlijn.",
  },
  {
    title: "Collectieve inkoop",
    path: "/collectieve-inkoop",
    keywords: "collectief inkoop voordeel pilot",
    snippet: "Profiteer van collectieve inkoopvoordelen via ZP Zaken.",
  },
  {
    title: "Documenten",
    path: "/documenten",
    keywords: "dienstverleningsdocument gedragscode slotverklaring pdf download",
    snippet: "Download het dienstverleningsdocument, de gedragscode en de slotverklaring.",
  },
  {
    title: "Contact",
    path: "/contact",
    keywords: "contact bellen mail whatsapp adres Schiphol-Rijk Tupolevlaan",
    snippet: "Neem contact op: 020 - 457 3077, info@zpzaken.nl of WhatsApp.",
  },
  {
    title: "Algemene voorwaarden",
    path: "/algemene-voorwaarden",
    keywords: "voorwaarden algemene avg",
    snippet: "Onze algemene voorwaarden.",
  },
  {
    title: "Klachtenprocedure",
    path: "/klachtenprocedure",
    keywords: "klacht klachten Kifid procedure",
    snippet: "Onze klachtenprocedure en Kifid-aansluiting.",
  },
  {
    title: "Cookies",
    path: "/cookies",
    keywords: "cookies privacy tracking",
    snippet: "Cookie- en privacy-informatie.",
  },
  { title: "Mijn ZP — Certificaat opvragen", path: "/mijn-zp/certificaat", keywords: "certificaat verzekeringsbewijs opdrachtgever", snippet: "Vraag een verzekeringscertificaat aan voor je opdrachtgever." },
  { title: "Mijn ZP — Verzekering pauzeren", path: "/mijn-zp/pauzeren", keywords: "pauzeren tijdelijk loondienst opzeggen uitloop", snippet: "Pauzeer tijdelijk je verzekering met behoud van uitlooprisico." },
  { title: "Mijn ZP — Documenten opvragen", path: "/mijn-zp/documenten", keywords: "polisblad polisvoorwaarden documenten kopie", snippet: "Vraag een kopie op van je polisblad, voorwaarden of ander document." },
  { title: "FAQ — Hoe pauzeer ik mijn verzekering?", path: "/faq", keywords: "pauzeren verzekering opzeggen uitlooprisico mijn verzekering beheren", snippet: "Pauzeer je verzekering via de wizard; uitlooprisico blijft behouden." },
  { title: "FAQ — Verzekeringscertificaat aanvragen", path: "/faq", keywords: "certificaat verzekeringsbewijs aanvragen", snippet: "Hoe vraag je een verzekeringscertificaat aan." },
];
