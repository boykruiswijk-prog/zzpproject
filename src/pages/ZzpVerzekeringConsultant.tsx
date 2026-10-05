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
  { question: "Wat kost een BAV voor een consultant?", answer: `De BAV en AVB samen kosten vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar. Je betaalt geen eigen risico.` },
  { question: "Hoeveel dekking krijg ik als adviseur?", answer: `Je bent verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per gebeurtenis. Wil je weten wat precies gedekt is? Lees de polisvoorwaarden op de pagina documenten.` },
  { question: "Wat gebeurt er als mijn advies verkeerd uitpakt?", answer: "Stelt je opdrachtgever je aansprakelijk voor schade door je advies, dan meld je dat bij ons. Of de schade gedekt is, staat in de polisvoorwaarden. Die zijn leidend." },
  { question: "Kan ik mijn polis opzeggen als ik stop met adviseren?", answer: "Ja. Je polis is dagelijks opzegbaar. Je zit nergens aan vast." },
];

export default function ZzpVerzekeringConsultant() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-consultant"
      serviceName="Beroepsaansprakelijkheidsverzekering consultant"
      badge="Voor consultants"
      title={<>ZZP verzekering voor <span className="text-accent">consultants</span></>}
      subtitle="Als consultant geef je advies over strategie, organisatie of verandering. Je opdrachtgever neemt besluiten op basis van jouw werk. Gaat er iets mis door een fout in je advies of rapport, dan kan dat veel geld kosten. Een beroepsaansprakelijkheidsverzekering (BAV) beschermt jou dan."
      sector="management-consultancy"
      benefits={[
        { icon: Briefcase, title: "Vaak gevraagd door opdrachtgevers", description: `Veel opdrachtgevers vragen om een BAV. Bij ons heb je ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per gebeurtenis in één polis via Hiscox.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Bij een schademelding betaal je geen eigen risico. En je polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Je sluit online af. Binnen 24 uur is alles geregeld en staat je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Verkeerd advies, gemiste deadline of een fout in je rapport", text: "Als adviseur zit het risico in je advies. Een rekenfout in een rapport, een gemiste deadline of een advies dat verkeerd uitpakt kan leiden tot een claim van je opdrachtgever.", bullets: ["Beroepsaansprakelijkheid (BAV) voor fouten in je advieswerk", "Bedrijfsaansprakelijkheid (AVB) voor schade aan personen of spullen", "Certificaat dat je direct naar je opdrachtgever stuurt"] },
        { title: "Persoonlijk advies", text: "Twijfel je of de polis past bij je opdracht? Je adviseur kijkt met je mee naar je contract. De polisvoorwaarden zijn altijd leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "zzp-verzekering-kosten-2026", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp", "wat-kosten-verzekeringen-voor-zzp-ers"]}
    />
  );
}
