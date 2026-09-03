// Enige bron van waarheid voor de SEO-gegevens van publieke routes.
// Wordt gebruikt door de pagina's zelf (SEOHead / ServicePageTemplate) EN door
// de prerender-plugin in vite.config.ts, zodat de head in de app en de
// geprerenderde head nooit uit elkaar kunnen lopen.
//
// Alleen relatieve imports: dit bestand wordt ook buiten Vite's alias-resolutie
// geladen (vanuit vite.config.ts).
//
// Regels:
// - geen premies of dekkingen die niet uit src/data/bavPakketten.ts komen
// - geen bedrijfsgegevens die niet uit src/config/site.ts komen

import { SITE_CONFIG } from "./site";
import { bavPakketten } from "../data/bavPakketten";

export interface SeoRoute {
  /** Pad zonder taalprefix, beginnend met "/". */
  path: string;
  title: string;
  description: string;
  /** Korte h1 voor het statische fallback-blok in de geprerenderde HTML. */
  h1: string;
  /** Twee tot drie zinnen introtekst die feitelijk klopt met de pagina. */
  intro: string;
}

const goedkoopstePakket = bavPakketten.reduce((laagste, p) =>
  p.prijs < laagste.prijs ? p : laagste,
);

export const seoRoutes: SeoRoute[] = [
  {
    path: "/",
    title: `ZP Zaken | BAV & AVB Verzekering voor ZZP'ers | Vanaf €${goedkoopstePakket.prijs}/maand`,
    description:
      "Onafhankelijke verzekeringsadviseur voor zzp'ers. Sluit direct online een BAV+AVB combinatieverzekering af. Geen eigen risico, dagelijks opzegbaar. AFM geregistreerd.",
    h1: "Verzekeringen voor zzp'ers, direct en onafhankelijk",
    intro:
      `ZP Zaken is een onafhankelijke verzekeringsadviseur voor zelfstandig professionals, met AFM-vergunning ${SITE_CONFIG.registrations.afm}. ` +
      `De gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering sluit je online af vanaf ${goedkoopstePakket.prijsLabel.toLowerCase()}, zonder eigen risico en dagelijks opzegbaar. ` +
      `Vragen? Bel ${SITE_CONFIG.phone} of mail ${SITE_CONFIG.email}.`,
  },
  {
    path: "/diensten",
    title: "Diensten voor ZZP'ers | Verzekeringen, Screening & Administratie | ZP Zaken",
    description:
      "Onze diensten voor zelfstandig professionals. Van verzekeringen en screening tot juridische hulp en factoring. Persoonlijk gesprek, geen callcenter.",
    h1: "Onze diensten voor zzp'ers",
    intro:
      "ZP Zaken bundelt de zaken die je als zelfstandige moet regelen: aansprakelijkheidsverzekeringen, AOV, pensioen, zorgverzekering, screening en creditcontrol. " +
      "Elke dienst begint met een persoonlijk gesprek, niet met een callcenter.",
  },
  {
    path: "/verzekeringen",
    title:
      "BAV + AVB Combinatieverzekering voor ZZP'ers | Direct Online Afsluiten | ZP Zaken",
    description: `De enige gecombineerde beroeps- en bedrijfsaansprakelijkheidsverzekering in Nederland. Vanaf €${goedkoopstePakket.prijs} per maand, geen eigen risico. Direct online afsluiten in 5 stappen.`,
    h1: "BAV & AVB: de combinatiepolis voor zzp'ers",
    intro:
      `De combinatiepolis van ZP Zaken bundelt beroepsaansprakelijkheid (BAV) en bedrijfsaansprakelijkheid (AVB) in één verzekering, vanaf ${goedkoopstePakket.prijsLabel.toLowerCase()}. ` +
      "Er is geen eigen risico en je kunt dagelijks opzeggen. Aanvragen doe je online in vijf stappen.",
  },
  {
    path: "/aov",
    title: "AOV Arbeidsongeschiktheidsverzekering ZZP | ZP Zaken",
    description:
      "Bescherm je inkomen als zzp'er bij ziekte. Vergelijk en sluit direct een AOV af via ZP Zaken. Persoonlijk gesprek, snel geregeld.",
    h1: "AOV voor zzp'ers: zeker van je inkomen bij ziekte",
    intro:
      "Als zelfstandige ben je zelf verantwoordelijk voor je inkomen bij ziekte of arbeidsongeschiktheid. Een AOV vangt je op wanneer je niet kunt werken. " +
      "ZP Zaken bespreekt in een persoonlijk gesprek welke AOV bij je beroep, leeftijd en wachttijd past.",
  },
  {
    path: "/pensioen",
    title: "ZZP Pensioen opbouwen | Informatie & Oplossingen | ZP Zaken",
    description:
      "Als zzp'er zelf je pensioen regelen? ZP Zaken helpt je met de beste pensioenoplossing. Persoonlijk gesprek op maat.",
    h1: "Pensioen voor zzp'ers: regel het nu, profiteer later",
    intro:
      "Als zelfstandige bouw je niet automatisch pensioen op. Er zijn wel fiscaal voordelige manieren om toch voor je oude dag te zorgen. " +
      "ZP Zaken bespreekt in een persoonlijk gesprek welk pensioenplan bij je situatie past.",
  },
  {
    path: "/zorgverzekering",
    title: "ZZP Zorgverzekering Collectief | ZP Zaken",
    description:
      "Profiteer van een collectieve zorgverzekering als zzp'er via ZP Zaken. Samen sterker, betere dekking voor een lagere premie.",
    h1: "Zorgverzekering voor zzp'ers: collectief voordeel",
    intro:
      "Als lid van het ZP Zaken collectief profiteer je van korting op je zorgverzekering: dezelfde dekking, een lagere premie. " +
      "In een gesprek rekenen we voor wat de collectieve korting in jouw situatie oplevert.",
  },
  {
    path: "/mentale-gezondheid",
    title: "Mentale Gezondheid voor ZZP'ers | Mirro Test | ZP Zaken",
    description:
      "Als zzp'er is mentale fitheid cruciaal. Doe de gratis mentale gezondheidstest via Mirro en ontdek hoe fit jij bent.",
    h1: "Mentale gezondheid als basis voor ondernemerschap",
    intro:
      "Ondernemen is geweldig, maar kan ook eenzaam en stressvol zijn. Investeren in je mentale gezondheid is daarom geen luxe. " +
      "Via de gratis test van Mirro krijg je inzicht in je mentale fitheid; daarna kun je met ons in gesprek over ondersteuning.",
  },
  {
    path: "/waarom-zp-zaken",
    title: "Waarom ZP Zaken? | Onafhankelijk Verzekerd Zonder Tussenkomst",
    description:
      "ZP Zaken werkt direct voor jou als zzp'er, zonder platform of tussenpersoon. Vergelijk wat je betaalt via een intermediair versus direct bij ZP Zaken.",
    h1: "Waarom zzp'ers voor ZP Zaken kiezen",
    intro:
      "ZP Zaken is de directe bron voor je verzekeringen: geen platform en geen extra schakel tussen jou en je polis. " +
      "Op deze pagina reken je zelf uit wat dat verschil in premie en voorwaarden betekent.",
  },
  {
    path: "/voor-wie",
    title: "Voor Wie is ZP Zaken? | Bouw, Zorg, ICT, Consultancy en meer",
    description:
      "ZP Zaken helpt zelfstandig professionals in bouw, zorg, consultancy, HR, finance, marketing en ICT. Persoonlijk verzekeringsbemiddeling op maat voor jouw beroep.",
    h1: "Voor wie is ZP Zaken bedoeld?",
    intro:
      "ZP Zaken werkt voor zelfstandig professionals in onder andere ICT, consultancy, HR, finance, marketing, coaching en management. " +
      "Per beroepsgroep leest u welke risico's spelen en welke dekking daarbij hoort.",
  },
  {
    path: "/zo-werken-wij",
    title: "Zo werken wij | ZP Zaken",
    description:
      "Persoonlijk gesprek zonder gedoe. We helpen je in drie simpele stappen aan de juiste verzekeringen: eerlijk en op jouw tempo.",
    h1: "Zo werken wij",
    intro:
      "Onze werkwijze bestaat uit drie stappen: een gratis kennismakingsgesprek, een voorstel op maat en het regelen van je polis. " +
      "Je bepaalt zelf het tempo en zit nergens aan vast tot je akkoord geeft.",
  },
  {
    path: "/kennisbank",
    title: "Kennisbank ZZP Verzekeringen | Artikelen & Nieuws | ZP Zaken",
    description:
      "Blijf op de hoogte van wet DBA, verzekeringen en regelgeving voor zzp'ers. Praktische artikelen door specialisten met 13 jaar ervaring.",
    h1: "Kennisbank voor zzp'ers",
    intro:
      "In de kennisbank van ZP Zaken vind je artikelen over de Wet DBA, aansprakelijkheid, belastingen, financiën en ondernemen als zelfstandige. " +
      "De artikelen zijn geordend in vier categorieën, zodat je snel bij het juiste onderwerp bent.",
  },
  {
    path: "/kennisbank/wet-en-regelgeving",
    title: "Wet en regelgeving voor ZZP'ers | Kennisbank | ZP Zaken",
    description:
      "Wet DBA, zelfstandigenregelingen en juridische zaken voor zzp'ers, uitgelegd door specialisten. Lees praktische artikelen in onze kennisbank.",
    h1: "Wet en regelgeving",
    intro:
      "Artikelen over de Wet DBA, arbeidsrelaties en andere juridische onderwerpen die spelen voor zelfstandig professionals. " +
      "Elk artikel legt uit wat de regel betekent voor je dagelijkse praktijk.",
  },
  {
    path: "/kennisbank/ondernemen",
    title: "Ondernemen als ZZP'er | Kennisbank | ZP Zaken",
    description:
      "Praktische tips voor groei, klantrelaties en risicomanagement als zelfstandige. Bekijk artikelen voor zzp'ers in onze kennisbank.",
    h1: "Ondernemen als zzp'er",
    intro:
      "Artikelen over groei, klantrelaties, contracten en risicomanagement voor zelfstandig professionals. " +
      "Praktisch geschreven, zodat je er direct mee aan de slag kunt.",
  },
  {
    path: "/kennisbank/belastingen",
    title: "Belastingen voor ZZP'ers | Kennisbank | ZP Zaken",
    description:
      "Belastingaangifte, BTW en fiscale aftrekposten voor zzp'ers, helder uitgelegd. Lees onze artikelen voor zelfstandigen.",
    h1: "Belastingen voor zzp'ers",
    intro:
      "Artikelen over de aangifte inkomstenbelasting, btw, aftrekposten en fiscale regelingen voor zelfstandigen. " +
      "Helder uitgelegd, zonder fiscaal jargon.",
  },
  {
    path: "/kennisbank/financien",
    title: "Financiën voor ZZP'ers | Kennisbank | ZP Zaken",
    description:
      "Financieel beheer, pensioen en sparen voor zzp'ers. Lees praktische artikelen voor je financiële toekomst als zelfstandige.",
    h1: "Financiën voor zzp'ers",
    intro:
      "Artikelen over cashflow, sparen, pensioen en financieel beheer voor zelfstandig professionals. " +
      "Zo houd je zicht op je financiële toekomst.",
  },
  {
    path: "/over-ons",
    title: "Over ZP Zaken | Direct en onafhankelijk sinds 2014",
    description:
      "ZP Zaken is opgericht in 2014 door Boy Kruiswijk. Meer dan 2.500 tevreden zzp'ers, AFM geregistreerd, Kifid aangesloten. Persoonlijk gesprek zonder callcenter.",
    h1: "Over ZP Zaken",
    intro:
      `ZP Zaken B.V. is in 2014 opgericht door Boy Kruiswijk en werkt vanuit ${SITE_CONFIG.address.addressLocality} voor zelfstandig professionals. ` +
      `Het kantoor staat geregistreerd bij de AFM onder ${SITE_CONFIG.registrations.afm} en is aangesloten bij Kifid onder ${SITE_CONFIG.registrations.kifid}. ` +
      "Op deze pagina stelt het team zich voor.",
  },
  {
    path: "/partners",
    title: "Trots dat we met onze partners samenwerken! | ZP Zaken",
    description:
      "Bij ZP Zaken zorgen we ervoor dat jij zorgeloos kunt ondernemen. Dit doen we in samenwerking met onze partners.",
    h1: "Onze partners",
    intro:
      "ZP Zaken werkt samen met verzekeraars en dienstverleners die passen bij zelfstandig professionals. " +
      "Op deze pagina zie je met welke partners we samenwerken en waarvoor.",
  },
  {
    path: "/historie",
    title: "12 Jaar ZP Zaken | ZP Zaken",
    description:
      "Van startup tot marktleider. Ontdek onze reis en waarom duizenden zzp'ers ons vertrouwen.",
    h1: "12 jaar ZP Zaken",
    intro:
      "ZP Zaken bestaat sinds 2014 en groeide van startup tot vaste partner voor duizenden zelfstandigen. " +
      "De tijdlijn op deze pagina laat de belangrijkste stappen uit die periode zien.",
  },
  {
    path: "/contact",
    title: "Contact | Vrijblijvend Gesprek Aanvragen | ZP Zaken",
    description: `Neem contact op met ZP Zaken. Bel ${SITE_CONFIG.phone}, mail ${SITE_CONFIG.email} of plan een vrijblijvend gesprek.`,
    h1: "Contact",
    intro:
      `Je bereikt ZP Zaken op ${SITE_CONFIG.phone} of via ${SITE_CONFIG.email}. ` +
      `Het kantoor staat aan ${SITE_CONFIG.address.streetAddress}, ${SITE_CONFIG.address.postalCode} ${SITE_CONFIG.address.addressLocality}. ` +
      "Een eerste gesprek is altijd gratis en vrijblijvend.",
  },
  {
    path: "/cookies",
    title: "Cookiebeleid | ZP Zaken",
    description:
      "Lees hoe ZP Zaken cookies gebruikt om jouw ervaring te verbeteren. Beheer je cookie-voorkeuren.",
    h1: "Cookiebeleid",
    intro:
      "Deze pagina legt uit welke cookies ZP Zaken gebruikt en waarvoor. " +
      "Je kunt je voorkeuren per categorie zelf aanpassen.",
  },
  {
    path: "/faq",
    title: "Veelgestelde Vragen over ZZP Verzekeringen | ZP Zaken",
    description:
      "Antwoorden op de meest gestelde vragen over BAV, AVB, AOV en ondernemen als zzp'er. Antwoorden van ZP Zaken.",
    h1: "Veelgestelde vragen",
    intro:
      "Antwoorden op vragen over de BAV en AVB, de AOV, het beheren van je polis, screening en over ZP Zaken zelf. " +
      "Staat je vraag er niet bij? Neem dan contact met ons op.",
  },
  {
    path: "/algemene-voorwaarden",
    title: "Algemene Voorwaarden | ZP Zaken",
    description:
      "Algemene Voorwaarden van ZP Zaken B.V. Van toepassing op alle diensten van ZP Zaken.",
    h1: "Algemene voorwaarden",
    intro:
      `De algemene voorwaarden van ${SITE_CONFIG.legalName} zijn van toepassing op al onze dienstverlening. ` +
      "Op deze pagina lees je de volledige tekst.",
  },
  {
    path: "/klachtenprocedure",
    title: "Klachtenprocedure | ZP Zaken",
    description:
      "Hoe ZP Zaken omgaat met klachten over de dienstverlening. AFM geregistreerd en aangesloten bij Kifid.",
    h1: "Klachtenprocedure",
    intro:
      `Klachten over onze dienstverlening kun je melden via ${SITE_CONFIG.email}. ` +
      `Komen we er samen niet uit, dan kun je terecht bij Kifid, waar ZP Zaken is aangesloten onder ${SITE_CONFIG.registrations.kifid}.`,
  },
  {
    path: "/documenten",
    title: "Documenten en downloads | ZP Zaken",
    description:
      "Bekijk en download polisvoorwaarden, verzekeringskaarten en brochures van ZP Zaken per branche.",
    h1: "Documenten en downloads",
    intro:
      "Hier vind je de polisvoorwaarden, verzekeringskaarten en brochures per branche. " +
      "Ook het dienstverleningsdocument, de gedragscode en de slotverklaring staan op deze pagina.",
  },
  {
    path: "/documenten/slotverklaring",
    title: "Slotverklaring | ZP Zaken",
    description:
      "Slotverklaring bij de aanvraag van een beroeps- en bedrijfsaansprakelijkheidsverzekering via ZP Zaken.",
    h1: "Slotverklaring",
    intro:
      "De slotverklaring hoort bij de aanvraag van een beroeps- en bedrijfsaansprakelijkheidsverzekering via ZP Zaken. " +
      "Je leest hier welke verklaringen je bij de aanvraag aflegt.",
  },
  {
    path: "/documenten/dienstverleningsdocument",
    title: "Dienstverleningsdocument | ZP Zaken",
    description:
      "Het dienstverleningsdocument van ZP Zaken: wie wij zijn, hoe wij werken, kosten, klachten en toezicht.",
    h1: "Dienstverleningsdocument",
    intro:
      "Het dienstverleningsdocument beschrijft wie ZP Zaken is, hoe we werken, wat onze dienstverlening kost en hoe klachten en toezicht geregeld zijn. " +
      `ZP Zaken staat onder toezicht van de AFM onder vergunningnummer ${SITE_CONFIG.registrations.afm}.`,
  },
  {
    path: "/documenten/gedragscode",
    title: "Gedragscode | ZP Zaken",
    description:
      "De gedragscode van ZP Zaken: integriteit, klantbelang, vakbekwaamheid, duidelijkheid en zorgvuldigheid.",
    h1: "Gedragscode",
    intro:
      "Onze gedragscode legt vast hoe we met integriteit, klantbelang, vakbekwaamheid, duidelijkheid en zorgvuldigheid werken. " +
      "De code geldt voor alle medewerkers van ZP Zaken.",
  },
  {
    path: "/collectieve-inkoop",
    title: "Collectieve Inkoop voor ZZP'ers | Samen Sterker | ZP Zaken",
    description:
      "Profiteer van collectieve inkoopkracht als zzp'er. ZP Zaken bundelt ondernemers voor betere deals op energie, software, telefonie en meer.",
    h1: "Collectieve inkoop voor zzp'ers",
    intro:
      "ZP Zaken bundelt zelfstandigen om samen betere voorwaarden te krijgen op zakelijke inkoop. " +
      "Op deze pagina zie je welke trajecten lopen en kun je zelf een categorie voorstellen.",
  },
  {
    path: "/social-media",
    title: "Social Media & Verzekeringen voor ZZP'ers | ZP Zaken",
    description:
      "Volg ons voor tips over aansprakelijkheid, beroeps- en bedrijfsaansprakelijkheidsverzekeringen voor zzp'ers. Zeker ondernemen begint hier.",
    h1: "ZP Zaken op social media",
    intro:
      "Via onze social kanalen delen we uitleg over aansprakelijkheid en ondernemen als zelfstandige. " +
      "Op deze pagina vind je de kanalen waarop je ons kunt volgen.",
  },
  {
    path: "/creditcontrol",
    title: "CreditControl: eerder betaald, volledige zekerheid | ZP Zaken",
    description:
      "ZP Zaken CreditControl: eerder betaald worden als ZZP'er met volledige zekerheid. Bescherming tegen faillissement, transparante factoring en 100% regie.",
    h1: "CreditControl: eerder betaald, volledige zekerheid",
    intro:
      "Met CreditControl bepaal je zelf wanneer je een factuur laat uitbetalen en loop je geen risico als een opdrachtgever omvalt. " +
      "Je houdt inzicht in de status van elke factuur en blijft zelf aan het roer.",
  },
  {
    path: "/screening",
    title: "Start je screening | ZP Zaken",
    description:
      "Laat zien dat je betrouwbaar bent met een screening. Vraag binnen enkele minuten je screening aan via ZP Zaken.",
    h1: "Start je screening",
    intro:
      "Steeds meer opdrachtgevers vragen om een screening voordat je aan de slag kunt. " +
      "Via ZP Zaken vraag je die in enkele minuten aan en volg je de status van je aanvraag.",
  },
  {
    path: "/offerte",
    title: "Vrijblijvende offerte BAV en AVB | ZP Zaken",
    description:
      "Vraag eenvoudig een vrijblijvende offerte aan voor je beroeps- en bedrijfsaansprakelijkheidsverzekering. Binnen 24 uur reactie.",
    h1: "Vrijblijvende offerte BAV en AVB",
    intro:
      "Vraag hier vrijblijvend een offerte aan voor je beroeps- en bedrijfsaansprakelijkheidsverzekering. " +
      "Je ontvangt binnen 24 uur een reactie van een adviseur.",
  },
  {
    path: "/zzp-verzekering-ict",
    title: "ZZP Verzekering ICT | BAV & AVB voor IT-freelancers | ZP Zaken",
    description:
      "Als ICT-freelancer aansprakelijk voor een softwarefout of datalek? ZP Zaken regelt jouw beroepsaansprakelijkheidsverzekering. Binnen 24 uur verzekerd.",
    h1: "ZZP Verzekering voor ICT-freelancers",
    intro:
      "Als ICT-freelancer schrijf je code, implementeer je systemen of geef je advies. Een fout in je werk kan grote financiele gevolgen hebben voor je opdrachtgever. " +
      "Beroepsaansprakelijkheidsverzekering (BAV) is in de ICT-sector bij veel opdrachtgevers verplicht en beschermt jou en je klant.",
  },
  {
    path: "/zzp-verzekering-zorg",
    title: "ZZP Verzekering Zorg | BAV & AVB voor zorgprofessionals | ZP Zaken",
    description:
      "ZZP'er in de zorg? ZP Zaken regelt jouw beroepsaansprakelijkheidsverzekering. Beschermd tegen aansprakelijkheid bij medische fouten. Binnen 24 uur.",
    h1: "ZZP Verzekering voor zorgprofessionals",
    intro:
      "Als zorgprofessional werk je met kwetsbare mensen. Een fout of misverstand kan leiden tot schadeclaims. " +
      "Beroepsaansprakelijkheidsverzekering geeft jou de vrijheid om je werk te doen zonder financieel risico.",
  },
  {
    path: "/zzp-verzekering-bouw",
    title: "ZZP Verzekering Bouw | BAV & AVB voor bouwprofessionals | ZP Zaken",
    description:
      "Als ZZP'er in de bouw aansprakelijk voor constructiefouten of schade? ZP Zaken regelt jouw verzekering. Snel, persoonlijk en binnen 24 uur geregeld.",
    h1: "ZZP Verzekering voor bouwprofessionals",
    intro:
      "Als zzp'er in de bouw draag je verantwoordelijkheid voor de kwaliteit van je werk. Een constructiefout of schade aan eigendom kan leiden tot forse schadeclaims. " +
      "ZP Zaken zorgt voor de juiste dekking met een BAV en AVB.",
  },
];

const bySeoPath = new Map(seoRoutes.map((r) => [r.path, r]));

/** SEO-gegevens van een route. Gooit bij een onbekend pad, zodat een typefout opvalt. */
export function seoRoute(path: string): SeoRoute {
  const found = bySeoPath.get(path);
  if (!found) throw new Error(`Geen SEO-registry entry voor route "${path}"`);
  return found;
}

/** Paden die nooit geprerenderd of geïndexeerd worden. */
export const PRERENDER_EXCLUDE_PREFIXES = [
  "/admin",
  "/portal",
  "/mijn-zp",
  "/verificatie",
  "/screenshot-helper",
  "/offerte/bedankt",
];
