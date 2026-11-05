import { Clock, ShieldCheck, CalendarCheck } from "lucide-react";
import { BeroepVerzekeringPagina, PRIJS_MAAND, PRIJS_JAAR } from "@/components/diensten/BeroepVerzekeringPagina";
import { LandingVerzekeringBlokken, BAV_MILJOEN, AVB_MILJOEN } from "@/components/diensten/LandingVerzekeringBlokken";
import { LocalizedLink } from "@/components/LocalizedLink";
import { seoRoute } from "@/config/seoRoutes";
import { STARTER } from "@/lib/starterTarief";
import { getPakket } from "@/data/bavPakketten";

const dekkingen = getPakket("maandelijks").dekkingen;
const bedrag = (waarde: number) => `€ ${waarde.toLocaleString("nl-NL")}`;

const faqs = [
  { question: "Wat is een BAV verzekering?", answer: "BAV staat voor beroepsaansprakelijkheidsverzekering. Die is bedoeld voor claims van je opdrachtgever over financiële schade door een fout in je werk, zoals een rekenfout, een fout in software of een onjuist rapport. Bij ZP Zaken zit de BAV samen met de AVB in één polis: BAV € 5.000.000 en AVB € 2.500.000 per aanspraak, zonder eigen risico. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Hoeveel verzekerd bedrag heb ik nodig met mijn BAV?", answer: "Minimaal het bedrag per aanspraak dat je opdrachtgever in het contract eist. Bij ZP Zaken is dat € 5.000.000 per aanspraak voor de BAV en € 2.500.000 per aanspraak voor de AVB. Hoe je de eis in je contract leest, lees je in het artikel Hoeveel dekking heb je nodig met je BAV?" },
  { question: "Wat heb ik nodig om de BAV aan te vragen?", answer: "Je KVK-nummer, bedrijfsnaam, sector, een korte omschrijving van je werkzaamheden, het aantal medewerkers, je voornaam en achternaam, adres, IBAN en naam van de rekeninghouder, de ingangsdatum die je zelf kiest (vroegst morgen) en je e-mailadres en telefoonnummer. Je kiest je pakket en geeft akkoord op de incassomachtiging en de slotverklaring. Vraag je als starter aan, dan kan een KVK-uittreksel nodig zijn. Bij een aanvraag via een derde vul je ook diens naam in. Kies je cyber erbij, dan beantwoord je ook de cybervragen en geef je akkoord op de cybervoorwaarden. Aanvragen duurt ongeveer 3 minuten en binnen 24 uur is het geregeld, met het certificaat in je mailbox voor je opdrachtgever." },
  { question: "Wat is een beroepsaansprakelijkheidsverzekering voor zzp'ers?", answer: `Een BAV is voor claims van opdrachtgevers over financiële schade door een fout in je werk, zoals een verkeerd advies of een fout in een opgeleverd product. Je eigen schade valt er niet onder. Bij ZP Zaken zit BAV ${bedrag(dekkingen.bav.perGebeurtenis)} per aanspraak samen met AVB ${bedrag(dekkingen.avb.perGebeurtenis)} per aanspraak in één polis. Wat precies gedekt is, staat in de polisvoorwaarden.` },
  { question: "Is een beroepsaansprakelijkheidsverzekering verplicht?", answer: "Voor de meeste zzp'ers is een BAV niet wettelijk verplicht; voor enkele beroepen wel. Veel opdrachtgevers en bureaus vragen er in hun contract om, vaak met een polisbewijs. Bij ZP Zaken staat je certificaat binnen 24 uur in je mailbox. Lees ook het artikel 'Is een BAV verplicht voor zzp'ers?' onderaan deze pagina." },
  { question: "Wat kost een aansprakelijkheidsverzekering voor een zzp'er?", answer: `Bij ZP Zaken kost de BAV + AVB in één polis ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting, zonder eigen risico. Ben je net gestart, met een KVK-inschrijving jonger dan 12 maanden? Dan betaal je de eerste ${STARTER.duurMaanden} maanden € ${STARTER.maandprijs} per maand of € ${STARTER.jaarprijs} per jaar, daarna ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, onder voorbehoud van controle van je KVK-inschrijvingsdatum.` },
  { question: "Welke aansprakelijkheidsverzekering heb ik nodig als zzp'er?", answer: "De meeste zzp'ers met een kantoorberoep hebben zowel een BAV als een AVB nodig. De BAV gaat over financiële schade door een fout in je werk, de AVB over schade aan personen of spullen van anderen. Veel opdrachtgevers vragen om allebei. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Is een bedrijfsaansprakelijkheidsverzekering bij de BAV inbegrepen?", answer: `Ja. Bij ZP Zaken zitten de BAV (${bedrag(dekkingen.bav.perGebeurtenis)} per aanspraak) en de AVB (${bedrag(dekkingen.avb.perGebeurtenis)} per aanspraak) samen in één polis via Hiscox. Je hebt één premie en één certificaat voor je opdrachtgever.` },
  { question: "Wat dekt een BAV?", answer: "Een BAV dekt schade die je opdrachtgever lijdt door een fout in je werk als zzp'er. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat is het verschil tussen BAV en AVB?", answer: "De BAV gaat over financiële schade door fouten in je werk, zoals een verkeerde berekening. De AVB gaat over schade aan personen of aan spullen van anderen. Bij ZP Zaken zitten ze samen in één polis. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat kost een BAV voor zzp'ers?", answer: `Vanaf ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting, voor BAV en AVB samen. Je betaalt geen eigen risico.` },
  { question: "Is een BAV verplicht?", answer: "Voor de meeste zzp'ers niet. Voor advocaten, notarissen, accountants en financieel adviseurs is een BAV wel verplicht, door de wet of door de beroepsorganisatie. Architecten hebben geen wettelijke plicht, maar hun beroepsvereniging kan het eisen. Opdrachtgevers eisen een BAV ook vaak in hun contract. Lees meer in Is een beroepsaansprakelijkheidsverzekering verplicht voor zzp'ers?", links: { "Is een beroepsaansprakelijkheidsverzekering verplicht voor zzp'ers?": "/kennisbank/is-bav-verplicht-zzp" } },
  { question: "Hoe snel heb ik een certificaat?", answer: "Binnen 24 uur geregeld. Je krijgt het certificaat per mail voor je opdrachtgever." },
  { question: "Kan ik dagelijks opzeggen en is er uitloopdekking?", answer: "Dagelijks opzeggen kan. Uitloopdekking is er niet. De BAV + AVB heeft geen jaarcontract en is dagelijks opzegbaar. Betaal je per jaar, dan krijg je bij opzeggen een creditnota voor de dagen die je al betaald hebt. Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota." },
];

export default function BavZzp() {
  return (
    <BeroepVerzekeringPagina
      path="/bav-zzp"
      serviceName="BAV en AVB voor zzp'ers"
      badge="BAV + AVB"
      title={<>BAV verzekering voor zzp'ers: <span className="text-accent">beroepsaansprakelijkheidsverzekering en AVB in één polis</span></>}
      subtitle={seoRoute("/bav-zzp").intro}
      sector=""
      benefits={[
        { icon: ShieldCheck, title: "Eén polis via Hiscox", description: `${BAV_MILJOEN} BAV en ${AVB_MILJOEN} AVB per aanspraak, zonder eigen risico.` },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Online aanvragen, certificaat per mail voor je opdrachtgever." },
        { icon: CalendarCheck, title: "Geen jaarcontract", description: "Dagelijks opzegbaar en een ingangsdatum die je zelf kiest." },
      ]}
      explainers={[
        { title: "Persoonlijke service", text: "Vragen over de aanvraag of de polisvoorwaarden? We beantwoorden ze graag. Bel ons op 020 - 457 3077." },
      ]}
      faqs={faqs}
      leesMeer={["is-bav-verplicht-zzp", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
      extra={<><LandingVerzekeringBlokken voorWieExtra={<p className="mt-5 text-sm text-muted-foreground">Wil je weten waar je op let bij het kiezen van een BAV? Lees <LocalizedLink to="/kennisbank/beste-bav-zzp-2026" className="text-accent underline underline-offset-4">Beste BAV voor zzp'ers in 2026: waar let je op?</LocalizedLink>.</p>} /><div className="container-wide py-6"><p className="text-sm text-muted-foreground">Aanvragen duurt ongeveer 3 minuten. Je kiest zelf je ingangsdatum (vroegst morgen) en ziet je prijs voordat je iets bevestigt. Liever eerst even bellen? <a href="tel:0204573077" className="text-accent underline underline-offset-4">020 - 457 3077</a>.</p></div></>}
    />
  );
}
