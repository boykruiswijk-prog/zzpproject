import { Clock, HeartHandshake, ShieldCheck } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Heb ik als coach een beroepsaansprakelijkheidsverzekering nodig?", answer: "Het is niet verplicht. Wel vragen opdrachtgevers er vaak om, vooral bij coaching via een bedrijf." },
  { question: "Ben ik als trainer ook verzekerd?", answer: "Ja. Ook als trainer kun je deze polis afsluiten. De AVB is voor schade aan personen of spullen, bijvoorbeeld tijdens een training." },
  { question: "Ik ben therapeut of psycholoog. Kan ik deze polis afsluiten?", answer: "Neem eerst contact op. Dat werk valt onder zorg en daarvoor gelden andere regels." },
  { question: "Wat kost een BAV voor een coach?", answer: `Vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar voor BAV en AVB samen, zonder eigen risico.` },
  { question: "Wat is precies gedekt?", answer: "Wat gedekt is, staat in de polisvoorwaarden. Die zijn leidend. Je vindt ze op de pagina documenten." },
];

export default function ZzpVerzekeringCoach() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-coach"
      serviceName="Beroepsaansprakelijkheidsverzekering coach"
      badge="Voor coaches en trainers"
      title={<>ZZP verzekering voor <span className="text-accent">coaches en trainers</span></>}
      subtitle="Als coach of trainer help je mensen en teams verder. Je klant vertrouwt op jouw begeleiding. Stelt iemand je aansprakelijk voor schade door je werk, dan helpt een BAV en AVB in één polis."
      sector="coaches"
      benefits={[
        { icon: HeartHandshake, title: "Voor coaches en trainers", description: `Voor loopbaancoaches, business coaches, teamcoaches en trainers. ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Je betaalt geen eigen risico. Je polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Online aanvragen, binnen 24 uur geregeld en je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Begeleiding waarop je klant vertrouwt", text: "Je geeft advies en begeleiding. Je geeft trainingen op locatie. Gaat er iets mis, dan kan een klant je aansprakelijk stellen. Een BAV is voor fouten in je werk, een AVB voor schade aan personen of spullen.", bullets: ["BAV en AVB in één polis via Hiscox", "Voor coaching en training", "Certificaat voor je opdrachtgever"] },
        { title: "Therapeut of psycholoog?", text: "Werk je als therapeut of psycholoog? Dan valt je werk onder zorg. Neem contact met ons op, dan kijken we samen wat past." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
    />
  );
}
