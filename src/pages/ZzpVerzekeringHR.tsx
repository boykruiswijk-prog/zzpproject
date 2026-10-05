import { Clock, ShieldCheck, Users } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Heb ik als HR-adviseur een BAV nodig?", answer: "Wettelijk niet. Maar veel opdrachtgevers vragen erom. En een fout in een ontslagadvies kan duur uitpakken." },
  { question: "Kan ik als recruiter deze polis afsluiten?", answer: "Vaak wel. Werk je in werving en selectie, dan kijken we bij je aanvraag even mee of je werk onder de polis valt. Twijfel je? Neem contact op." },
  { question: "Wat als een kandidaat die ik selecteerde niet past?", answer: "Stelt je opdrachtgever je aansprakelijk, meld het dan bij ons. Of het gedekt is, staat in de polisvoorwaarden. Die zijn leidend." },
  { question: "Wat kost een BAV voor HR-adviseurs?", answer: `Vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar voor BAV en AVB samen, zonder eigen risico.` },
  { question: "Ben ik als loopbaanadviseur ook verzekerd?", answer: "Ja, ook als loopbaanadviseur kun je deze polis afsluiten. Werk je als therapeut of psycholoog? Neem dan contact op." },
];

export default function ZzpVerzekeringHR() {
  return (
    <BeroepVerzekeringPagina
      path="/zzp-verzekering-hr"
      serviceName="Beroepsaansprakelijkheidsverzekering HR-adviseur"
      badge="Voor HR-professionals"
      title={<>ZZP verzekering voor <span className="text-accent">HR-adviseurs</span></>}
      subtitle="Als HR-adviseur, recruiter of loopbaanadviseur werk je met mensen en contracten. Een fout in een ontslagadvies of selectie kan je opdrachtgever geld kosten. Een BAV en AVB in één polis beschermen je."
      sector="management-consultancy"
      benefits={[
        { icon: Users, title: "Voor HR, P&O en recruitment", description: `Voor HR-adviseurs, P&O'ers, recruiters en loopbaanadviseurs. Verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per gebeurtenis.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Bij een schade betaal je geen eigen risico. Je polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Online afsluiten, binnen 24 uur geregeld en je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Advies bij ontslag, contracten en selectie", text: "Je adviseert over ontslag, contracten of een nieuwe medewerker. Gaat er iets mis door een fout in je advies of selectie, dan kan je opdrachtgever schade hebben. Een BAV beschermt je als je daarvoor aansprakelijk wordt gesteld.", bullets: ["BAV en AVB in één polis via Hiscox", "Ook voor recruiters en loopbaanadviseurs", "Certificaat voor je opdrachtgever"] },
        { title: "Persoonlijk advies", text: "Je adviseur kijkt met je mee naar je opdracht en contract. De polisvoorwaarden zijn leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "zzp-verzekering-kosten-2026", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp", "wat-kosten-verzekeringen-voor-zzp-ers"]}
    />
  );
}
