import { Clock, ShieldCheck, Users } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Vraagt een opdrachtgever om een BAV voor interim managers?", answer: "Vaak wel. Veel opdrachtgevers en bureaus vragen om een bewijs van verzekering. Met ons certificaat laat je dat direct zien." },
  { question: "Ben ik als scrum master buiten ICT ook verzekerd?", answer: "Vaak wel. Werk je als scrum master of agile coach buiten de ICT, dan kijken we bij je aanvraag even mee welke dekking past. Twijfel je? Neem contact op." },
  { question: "Wat kost de verzekering voor een interim manager?", answer: `Vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar voor BAV en AVB samen. Zonder eigen risico.` },
  { question: "Wat als een project door mijn planning te laat is?", answer: "Stelt je opdrachtgever je aansprakelijk, meld het dan bij ons. Of de schade gedekt is, lees je in de polisvoorwaarden. Die zijn leidend." },
  { question: "Kan ik de polis stoppen tussen twee opdrachten?", answer: "Ja. De polis is dagelijks opzegbaar. Let wel op: zonder polis ben je niet verzekerd." },
];

export default function ZzpVerzekeringInterimManager() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-interim-manager"
      serviceName="Verzekering interim manager"
      badge="Voor interim managers"
      title={<>ZZP verzekering voor <span className="text-accent">interim managers</span></>}
      subtitle="Als interim manager of projectmanager neem je besluiten en maak je planningen. Je opdrachtgever vertrouwt daarop. Loopt een project vast door een fout van jou, dan kan je opdrachtgever je aansprakelijk stellen. Een BAV en AVB in één polis beschermen je."
      sector="management-consultancy"
      benefits={[
        { icon: Users, title: "Voor interim en projectmanagement", description: `Ook voor projectmanagers, programmamanagers en scrum masters buiten ICT. Je bent verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per gebeurtenis.` },
        { icon: ShieldCheck, title: "Geen eigen risico, dagelijks opzegbaar", description: "Je betaalt geen eigen risico. Stopt je opdracht? Dan zeg je de polis op wanneer je wilt." },
        { icon: Clock, title: "Snel geregeld", description: "Sluit online af. Binnen 24 uur is het geregeld en heb je je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Besluiten en planning waarop je opdrachtgever bouwt", text: "Als interim manager stuur je mensen, budgetten en planningen aan. Je opdrachtgever rekent op jouw keuzes. Een fout in een planning of besluit kan schade geven. Daarvoor is een BAV.", bullets: ["BAV en AVB in één polis via Hiscox", "Ook voor programma- en projectmanagers", "Certificaat voor je opdrachtgever of bemiddelingsbureau"] },
        { title: "Persoonlijk advies bij je opdracht", text: "Elke opdracht is anders. Je adviseur kijkt met je mee naar wat je opdrachtgever vraagt. De polisvoorwaarden zijn leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
    />
  );
}
