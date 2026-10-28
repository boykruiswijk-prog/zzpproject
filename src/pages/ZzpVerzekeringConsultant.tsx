import { Briefcase, Clock, ShieldCheck } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Heb ik als zzp-consultant een BAV nodig?", answer: "Een BAV is niet wettelijk verplicht. Wel vragen veel opdrachtgevers erom in hun contract. Kijk in je overeenkomst wat er staat." },
  { question: "Wat kost een BAV voor een consultant?", answer: `De BAV en AVB samen in één polis kosten ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting. Op de BAV + AVB betaal je geen eigen risico.` },
  { question: "Hoeveel dekking krijg ik als consultant?", answer: "Je bent verzekerd voor € 5.000.000 BAV en € 2.500.000 AVB per aanspraak. Wat precies gedekt is, lees je in de polisvoorwaarden." },
  { question: "Wat gebeurt er als mijn advies verkeerd uitpakt?", answer: "Stelt je opdrachtgever je aansprakelijk voor schade door je advies, dan meld je dat bij ons. Of de schade gedekt is, staat in de polisvoorwaarden. Die zijn leidend." },
  { question: "Kan ik mijn polis opzeggen als ik stop als consultant?", answer: "Ja. De BAV + AVB heeft geen jaarcontract en is dagelijks opzegbaar. Betaal je per jaar, dan krijg je bij opzeggen een creditnota voor de dagen die je al betaald hebt. Betaal je per maand, dan stopt je verzekering op de opzegdatum, zonder creditnota. Na opzeggen ben je niet meer verzekerd voor claims, ook niet over eerder werk." },
  { question: "Hoe snel heb ik een polisbewijs voor mijn opdrachtgever?", answer: "Je vraagt online aan en kiest zelf je ingangsdatum, vroegst morgen. Binnen 24 uur is het geregeld en staat je certificaat in je mailbox. Dat stuur je door naar je opdrachtgever of bemiddelaar." },
  { question: "Waarom ook een AVB als consultant?", answer: "De BAV dekt financiële schade door een fout in je advies of rapport. De AVB dekt schade aan personen of spullen van anderen, bijvoorbeeld als je bij je opdrachtgever op locatie werkt. Veel opdrachtgevers vragen om allebei. Lees meer over het verschil tussen BAV en AVB." },
];

export default function ZzpVerzekeringConsultant() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-consultant"
      serviceName="Beroepsaansprakelijkheidsverzekering consultant"
      badge="Voor consultants"
      title={<>Beroepsaansprakelijkheidsverzekering voor <span className="text-accent">consultants</span></>}
      subtitle={`Als zzp-consultant regel je je beroepsaansprakelijkheidsverzekering (BAV) bij ZP Zaken online, samen met een bedrijfsaansprakelijkheidsverzekering (AVB) in één polis. Je bent verzekerd voor € 5.000.000 BAV en € 2.500.000 AVB per aanspraak, zonder eigen risico, binnen 24 uur geregeld. Vanaf ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting.`}
      sector="management-consultancy"
      benefits={[
        { icon: Briefcase, title: "Vaak gevraagd door opdrachtgevers", description: `Veel opdrachtgevers vragen om een BAV. Bij ons heb je ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak in één polis via Hiscox.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Op de BAV + AVB betaal je geen eigen risico. Geen jaarcontract en dagelijks opzegbaar." },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Je vraagt online aan. Binnen 24 uur is alles geregeld en staat je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Verkeerd advies of een fout in je rapport", text: "Als consultant zit het risico in je advies. Een rekenfout in een rapport of een advies dat verkeerd uitpakt kan leiden tot een claim van je opdrachtgever. Wat precies gedekt is, staat in de polisvoorwaarden.", bullets: ["Beroepsaansprakelijkheid (BAV) voor fouten in je advieswerk", "Bedrijfsaansprakelijkheid (AVB) voor schade aan personen of aan spullen van anderen", "Certificaat dat je binnen 24 uur naar je opdrachtgever stuurt"] },
        { title: "Persoonlijk contact", text: "Vragen over de polis en je opdracht? We beantwoorden je vragen over de aanvraag en voorwaarden. De polisvoorwaarden zijn altijd leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
    />
  );
}
