import { ShieldCheck, Clock, CalendarCheck } from "lucide-react";
import { BeroepVerzekeringPagina, PRIJS_MAAND, PRIJS_JAAR } from "@/components/diensten/BeroepVerzekeringPagina";
import { LandingVerzekeringBlokken, BAV_MILJOEN, AVB_MILJOEN } from "@/components/diensten/LandingVerzekeringBlokken";

const maand = PRIJS_MAAND.replace("€", "€ ");
const jaar = PRIJS_JAAR.replace("€", "€ ");

/** Zichtbare FAQ; het FAQPage-schema komt uit precies deze lijst. */
export const AVB_FAQS = [
  { question: "Wat is een bedrijfsaansprakelijkheidsverzekering (AVB)?", answer: "Een bedrijfsaansprakelijkheidsverzekering (AVB) gaat over schade aan personen of spullen van anderen die ontstaat tijdens je werk, bijvoorbeeld als je bij een opdrachtgever een laptop laat vallen of iemand struikelt over je kabel. Wat precies gedekt is en wat niet, staat in de polisvoorwaarden." },
  { question: "Kan ik bij ZP Zaken alleen een AVB afsluiten?", answer: "Nee. ZP Zaken biedt de AVB niet los aan. De AVB zit altijd samen met de beroepsaansprakelijkheidsverzekering (BAV) in één combinatiepolis, verzekerd bij Hiscox. Zoek je alleen een losse AVB, dan past ons aanbod daar niet bij." },
  { question: "Wat is het verschil tussen een AVB en een BAV?", answer: "De AVB gaat over schade aan personen of spullen. De BAV gaat over financiële schade bij je opdrachtgever door een fout in je werk, zoals een fout in een advies, ontwerp of stuk code. In onze polis heb je beide." },
  { question: "Wat kost de AVB bij ZP Zaken?", answer: `De AVB zit in de combinatiepolis BAV + AVB. Die kost ${maand} per maand of ${jaar} per jaar, inclusief kosten en assurantiebelasting. Je betaalt geen eigen risico.` },
  { question: "Voor welke bedragen ben ik verzekerd?", answer: `De AVB is verzekerd tot ${AVB_MILJOEN} per aanspraak en de BAV tot ${BAV_MILJOEN} per aanspraak. De volledige voorwaarden staan in de polisvoorwaarden.` },
  { question: "Kan ik dagelijks opzeggen?", answer: "Ja. De BAV + AVB heeft geen jaarcontract en is dagelijks opzegbaar. Betaal je per jaar, dan krijg je bij opzeggen een creditnota voor de dagen die je al betaald hebt. Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota." },
];

export default function Bedrijfsaansprakelijkheidsverzekering() {
  return (
    <BeroepVerzekeringPagina
      path="/bedrijfsaansprakelijkheidsverzekering"
      serviceName="Bedrijfsaansprakelijkheidsverzekering (AVB) voor zzp'ers, als onderdeel van de BAV + AVB"
      badge="Voor zzp'ers"
      title={<>Bedrijfsaansprakelijkheidsverzekering voor <span className="text-accent">zzp'ers</span></>}
      subtitle={`Een bedrijfsaansprakelijkheidsverzekering (AVB) is er voor schade aan personen of spullen van anderen tijdens je werk. Bij ZP Zaken krijg je de AVB niet los, maar altijd samen met de beroepsaansprakelijkheidsverzekering (BAV) in één polis, voor ${maand} per maand of ${jaar} per jaar, inclusief kosten en assurantiebelasting.`}
      sector=""
      benefits={[
        { icon: ShieldCheck, title: "AVB en BAV in één polis", description: `${AVB_MILJOEN} AVB en ${BAV_MILJOEN} BAV per aanspraak via Hiscox, zonder eigen risico. Een losse AVB bieden we niet aan.` },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Je vraagt online aan. Binnen 24 uur staat je certificaat in je mailbox." },
        { icon: CalendarCheck, title: "Dagelijks opzegbaar", description: "Geen jaarcontract. Je kiest zelf de ingangsdatum en zegt dagelijks op." },
      ]}
      explainers={[
        { title: "Waarom de AVB bij ons in een combinatie zit", text: "Veel opdrachtgevers vragen om bewijs van zowel een AVB als een BAV. Daarom zitten ze bij ons in één polis met één certificaat. Wil je alleen een AVB, dan is ons aanbod niet de juiste keuze. Vragen over de polis? Bel ons op 020 - 457 3077." },
      ]}
      faqs={AVB_FAQS}
      leesMeer={["bedrijfsaansprakelijkheidsverzekering-zzp", "verschil-bav-avb-zzp", "wat-kosten-verzekeringen-voor-zzp-ers"]}
      extra={<LandingVerzekeringBlokken />}
    />
  );
}
