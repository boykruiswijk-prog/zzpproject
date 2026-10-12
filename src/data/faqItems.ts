import { CYBER_DEKKING, CYBER_HULP, CYBER_POLISVOORWAARDEN, CYBER_LOOPTIJD } from "../../supabase/functions/_shared/cyber";
import { INLOOP_UITLOOP_FAQ } from "./bavVergelijking";
// Enige bron van waarheid voor de zichtbare FAQ-content op /faq.
// Ook gebruikt door de prerender-plugin, zodat FAQPage-schema en zichtbare
// tekst altijd identiek zijn. Alleen relatieve/geen imports (ook buiten Vite).

export const TIJDELIJK_GEEN_OPDRACHT_FAQ = {
  question: "Wat als ik tijdelijk geen opdracht heb?",
  answer: "Dan hoef je niet meteen je verzekering op te zeggen. Je kunt je BAV + AVB pauzeren via Mijn ZP (cyber niet), en via onze zusteronderneming Onefellow, arbeidsbemiddelaar voor zelfstandige professionals, helpen we je zoeken naar een nieuwe opdracht. Bekijk de actuele opdrachten op onefellow.nl/opdrachten of meld je aan via onefellow.nl/registreren. Wil je toch opzeggen, dan kan dat dagelijks; let op dat je daarna niet meer verzekerd bent voor nieuwe claims.",
};

export const faqItems = [
  {
    category: "Verzekeringen",
    questions: [
      { question: "Wat kost cyberdekking en kan ik die los afsluiten?", answer: "Cyber kan alleen samen met de BAV + AVB: €82,50 per maand (€55 BAV + AVB en €27,50 cyber) of €850 per jaar (€600 + €250). Voor starters: €72,50 per maand of €745 per jaar de eerste 12 maanden, daarna €82,50 per maand of €850 per jaar, inclusief kosten en assurantiebelasting. Voor een KVK-inschrijving jonger dan 12 maanden, onder voorbehoud van controle. Cyber krijgt nooit startkorting." },
      { question: "Wat dekt cyber?", answer: `${CYBER_DEKKING} ${CYBER_HULP} ${CYBER_POLISVOORWAARDEN}` },
      { question: "Kan ik cyber dagelijks opzeggen of pauzeren?", answer: CYBER_LOOPTIJD },
      { question: "Wat is een AOV en waarom heb ik die nodig als zzp'er?", answer: "Een Arbeidsongeschiktheidsverzekering (AOV) beschermt je inkomen als je door ziekte of een ongeval niet meer kunt werken. Als zzp'er heb je geen werkgever die je doorbetaalt bij ziekte, dus een AOV zorgt ervoor dat je financieel niet in de problemen komt. De verzekering keert maandelijks een bedrag uit zolang je arbeidsongeschikt bent." },
      { question: "Wat is het verschil tussen een BAV en een AVB?", answer: "Een Beroepsaansprakelijkheidsverzekering (BAV) dekt schade die ontstaat door fouten in je werk, zoals verkeerd advies of een fout in een ontwerp. Een Aansprakelijkheidsverzekering Bedrijven (AVB) dekt schade aan personen of spullen die je per ongeluk veroorzaakt tijdens je werk, zoals een laptop die je laat vallen bij een klant. Veel zzp'ers hebben beide verzekeringen nodig." },
      { question: "Kan ik mijn verzekeringen combineren voor korting?", answer: "Ja, bij ZP Zaken bieden we een combinatiepolis aan waarbij je je BAV en AVB kunt bundelen. Je krijgt korting en houdt overzicht met één polis en één premie. Je bespaart gemiddeld 15-20% ten opzichte van losse verzekeringen." },
      { question: "Hoe snel kan ik een verzekering afsluiten?", answer: "Je BAV + AVB is binnen 24 uur geregeld, certificaat in je mailbox. Werk je in de zorg of bouw? Binnen 24 uur hoor je van ons." },
      { question: "Wat kost een AOV gemiddeld per maand?", answer: "De premie van een AOV hangt af van je beroep, leeftijd, gewenste uitkering en wachttijd. Gemiddeld betalen zzp'ers tussen de €150 en €400 per maand. Bij ZP Zaken zoeken we de beste prijs-kwaliteitverhouding door verschillende verzekeraars te vergelijken." },
    ]
  },
  {
    category: "Over ZP Zaken",
    questions: [
      { question: "Is ZP Zaken onafhankelijk?", answer: "Ja, ZP Zaken is volledig onafhankelijk. Wij zijn niet gebonden aan één verzekeraar en kunnen daarom informeren welke verzekering bij je past. We vergelijken producten van verschillende aanbieders om de beste oplossing voor jou te vinden." },
      { question: "Wat kost een gesprek bij ZP Zaken?", answer: "Een eerste persoonlijk gesprek bij ZP Zaken is altijd gratis en vrijblijvend. We bespreken je situatie, wensen en mogelijkheden zonder dat je ergens aan vastzit. Pas als je besluit een verzekering af te sluiten, ontvangen wij een vergoeding van de verzekeraar." },
      { question: "Hoe kan ik contact opnemen met ZP Zaken?", answer: "Je kunt ons bereiken via telefoon (020 - 457 3077), e-mail (info@zpzaken.nl) of via het contactformulier op onze website. We reageren binnen 24 uur op alle berichten. Je kunt ook langskomen op ons kantoor in Schiphol-Rijk voor een persoonlijk gesprek." },
      { question: "Is ZP Zaken aangesloten bij een klachteninstantie?", answer: "Ja, ZP Zaken is aangesloten bij het Kifid (Klachteninstituut Financiële Dienstverlening). Mocht je onverhoopt een klacht hebben die we niet samen kunnen oplossen, dan kun je deze voorleggen aan het Kifid. We staan ook geregistreerd bij de AFM onder vergunningsnummer 12050636." },
    ]
  },
  {
    category: "Mijn verzekering beheren",
    questions: [
      { question: "Hoe kan ik mijn verzekering opzeggen?", answer: "Voor de BAV + AVB: geen jaarcontract en dagelijks opzegbaar. Zeg je op, dan krijg je een creditnota voor de dagen die je al betaald hebt. Start de opzeg-wizard op /mijn-zp/opzeggen en geef de reden en gewenste opzegdatum op. Wij verwerken je opzegging binnen 24 uur en sturen je een bevestiging per mail." },
      { question: "Hoe pauzeer ik mijn verzekering?", answer: "Heb je tijdelijk geen opdracht of ga je tijdelijk in loondienst? Dan kun je je BAV + AVB eenvoudig pauzeren via de pauzeer-wizard op /mijn-zp/pauzeren. Wij verwerken je pauzering binnen 24 uur. Cyber is niet pauzeerbaar." },
      TIJDELIJK_GEEN_OPDRACHT_FAQ,
      ...INLOOP_UITLOOP_FAQ,
      { question: "Hoe vraag ik mijn verzekeringscertificaat op?", answer: "Heb je een bewijs van verzekering nodig voor een opdrachtgever? Vraag je verzekeringscertificaat op via de wizard op /mijn-zp/polis. Wij sturen het binnen 24 uur per mail. Je ontvangt een verzekeringscertificaat: het bewijs dat je verzekerd bent onder de collectieve polis van ZP Zaken bij Hiscox. Dit is het document dat je aan je opdrachtgever kunt geven." },
      { question: "Hoe ontvang ik kopieën van mijn documenten?", answer: "Heb je je verzekeringscertificaat of een ander document nodig? De polisvoorwaarden download je direct op /voorwaarden. Vraag je documenten op via de wizard op /mijn-zp/documenten. Je ontvangt ze binnen 24 uur per mail." },
      { question: "Wat gebeurt er als ik mijn verzekering pauzeer?", answer: "Tijdens de pauze ben je niet verzekerd voor nieuwe werkzaamheden. Heb je vragen over een claim voor eerder werk? Neem contact met ons op en raadpleeg de polisvoorwaarden." },
      { question: "Kan ik mijn KvK-nummer wijzigen?", answer: "Nee. Je BAV en AVB zijn afgegeven op je onderneming met het KvK-nummer uit je aanvraag. Het risico en de polis horen bij dat KvK-nummer. Krijg je een nieuw KvK-nummer, bijvoorbeeld omdat je van eenmanszaak naar bv gaat of een nieuwe onderneming start? Dan vraag je een nieuwe verzekering aan voor je nieuwe onderneming. Je huidige verzekering is dagelijks opzegbaar: we stoppen je oude polis per de dag voordat de nieuwe ingaat, zodat je doorlopend verzekerd bent en niet dubbel betaalt. Je adres, e-mailadres of telefoonnummer wijzigen kan wel gewoon door contact met ons op te nemen." },
      { question: "Ik ga van eenmanszaak naar bv. Wat moet ik doen?", answer: "Een bv krijgt een eigen KvK-nummer en is daarmee een nieuwe onderneming. Vraag voor je bv een nieuwe BAV en AVB aan en geef de startdatum van je bv op. Wij zorgen dat je oude polis stopt op de dag voordat de nieuwe ingaat. Zo zit er geen gat in je dekking en betaal je niet dubbel." },
    ]
  },
  {
    category: "Onze verzekering",
    questions: [
      { question: "Bieden jullie een passende oplossing voor een BV?", answer: "Ja, ook voor een besloten vennootschap (BV) hebben wij passende beroeps- en bedrijfsaansprakelijkheidsverzekeringen. Neem contact op via 020 - 457 3077 voor een persoonlijk gesprek." },
      { question: "Heb ik een beroeps- en een bedrijfsaansprakelijkheidsverzekering nodig?", answer: "Een BAV dekt schade door fouten in je werk (verkeerd advies, fout ontwerp). Een AVB dekt schade aan personen of spullen. Veel opdrachtgevers vragen om beide verzekeringen. Onze combinatiepolis bundelt ze met korting." },
      { question: "Kan ik mijn beroep altijd verzekeren bij ZP Zaken?", answer: "Wij verzekeren een groot deel van de zakelijke dienstverlening: ICT, consultancy, HR & finance, PR & marketing, coaching en management. Voor andere beroepen overleggen we graag of dekking mogelijk is." },
      { question: "Moet ik doorgeven dat ik nieuwe opdrachten heb?", answer: "Nee. Zolang je werkzaamheden binnen je verzekerde beroep vallen, ben je automatisch gedekt voor nieuwe opdrachten. Verandert de aard van je werk substantieel, geef dit dan even door." },
      { question: "Kunnen mijn andere opdrachten ook onder deze polis?", answer: "Ja, alle zakelijke werkzaamheden binnen het verzekerde beroep vallen onder dezelfde polis, ongeacht hoeveel opdrachtgevers je hebt." },
      { question: "Hoe lang zit ik aan deze verzekering vast?", answer: "Voor de BAV + AVB: geen jaarcontract en dagelijks opzegbaar. Zeg je op, dan krijg je een creditnota voor de dagen die je al betaald hebt. Geen minimale looptijd en geen opzegtermijn." },
      { question: "Wat moet ik doen als mijn bedrijf aansprakelijk wordt gesteld?", answer: "Neem direct contact op met ons via 020 - 457 3077 of info@zpzaken.nl. Wij melden de schade bij de verzekeraar en begeleiden je door het proces." },
      { question: "Wanneer begint en eindigt de verzekering?", answer: "De verzekering begint op de door jou gekozen ingangsdatum (maximaal 6 maanden vooruit) en loopt door totdat je opzegt. Dagelijks opzegbaar." },
      { question: "Mijn bedrijfsgegevens veranderen, hoe geef ik dat door?", answer: "Geef een nieuw adres, een nieuwe bedrijfsnaam of nieuwe contactgegevens door via info@zpzaken.nl met je polisnummer. Wij werken je gegevens binnen 24 uur bij. Verandert je KvK-nummer, bijvoorbeeld omdat je van eenmanszaak naar bv gaat? Dan is een nieuwe aanvraag nodig, omdat de polis bij het KvK-nummer hoort." },
      { question: "Hoeveel personen zijn er verzekerd met de BAV & AVB verzekering van ZP Zaken?", answer: "Standaard ben je als zzp'er met maximaal 3 medewerkers verzekerd binnen onze polis. Heb je meer medewerkers? Neem contact op voor een passend voorstel." },
    ]
  },
  {
    category: "Screening & Administratie",
    questions: [
      { question: "Wat is een VOG en heb ik die nodig?", answer: "Een Verklaring Omtrent het Gedrag (VOG) is een officieel document waaruit blijkt dat je geen strafbare feiten hebt gepleegd die relevant zijn voor je werk. Steeds meer opdrachtgevers vragen om een VOG, vooral in de zorg, onderwijs en financiële sector. Via ZP Zaken kun je eenvoudig een screening aanvragen." },
      { question: "Hoe lang duurt een screening?", answer: "Een standaard screening duurt gemiddeld 3-5 werkdagen. Bij spoed kunnen we dit vaak versnellen. De doorlooptijd hangt af van het type screening en de snelheid waarmee referenties reageren. Je ontvangt direct bericht zodra de screening is afgerond." },
      { question: "Biedt ZP Zaken ook hulp bij administratie?", answer: "Ja, via onze partners bieden we ondersteuning bij je financiële administratie. Dit varieert van facturatie en boekhouding tot BTW-aangiftes en jaarrekeningen. Zo heb je je administratie op orde." },
    ]
  },
];

