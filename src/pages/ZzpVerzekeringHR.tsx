import { Clock, ShieldCheck, Users } from "lucide-react";
import {
  BeroepVerzekeringPagina,
  BAV_DEKKING,
  AVB_DEKKING,
  PRIJS_MAAND,
  PRIJS_JAAR,
} from "@/components/diensten/BeroepVerzekeringPagina";

const faqs = [
  { question: "Heb ik als HR-professional een BAV nodig?", answer: "Wettelijk niet. Maar veel opdrachtgevers vragen erom. En een fout in een werk rond ontslag kan duur uitpakken." },
  { question: "Kan ik als recruiter deze polis afsluiten?", answer: "Vaak wel. Werk je in werving en selectie, dan beoordeelt ZP Zaken bij je aanvraag of je werk onder de polis valt. Vragen? Neem contact op." },
  { question: "Wat als een kandidaat die ik selecteerde niet past?", answer: "Stelt je opdrachtgever je aansprakelijk, meld het dan bij ons. Of het gedekt is, staat in de polisvoorwaarden. Die zijn leidend." },
  { question: "Wat kost een BAV voor HR-professionals?", answer: `Vanaf ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting, voor BAV en AVB samen, zonder eigen risico.` },
  { question: "Ben ik als loopbaanbegeleider ook verzekerd?", answer: "Ja, ook als loopbaanbegeleider kun je deze polis afsluiten. Werk je als therapeut of psycholoog? Neem dan contact op." },
];

export default function ZzpVerzekeringHR() {
  return (
    <BeroepVerzekeringPagina
      waarLetJeOp
      path="/zzp-verzekering-hr"
      serviceName="Beroepsaansprakelijkheidsverzekering HR-professional"
      badge="Voor HR-professionals"
      title={<>ZZP verzekering voor <span className="text-accent">HR-professionals</span></>}
      subtitle="Als HR-professional, recruiter of loopbaanbegeleider werk je met mensen en contracten. Een fout in een werk rond ontslag of selectie kan je opdrachtgever geld kosten. Een BAV en AVB in één polis verzekeren je voor aansprakelijkheid, volgens de polisvoorwaarden."
      sector="hr"
      benefits={[
        { icon: Users, title: "Voor HR, P&O en recruitment", description: `Voor HR-professionals, P&O'ers, recruiters en loopbaanbegeleiders. Verzekerd voor ${BAV_DEKKING} BAV en ${AVB_DEKKING} AVB per aanspraak.` },
        { icon: ShieldCheck, title: "Geen eigen risico", description: "Bij een schade betaal je geen eigen risico. Je polis is dagelijks opzegbaar." },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Online aanvragen, binnen 24 uur geregeld en je certificaat in je mailbox." },
      ]}
      explainers={[
        { title: "Werk rond ontslag, contracten en selectie", text: "Je adviseert over ontslag, contracten of een nieuwe medewerker. Gaat er iets mis door een fout in je advies of selectie, dan kan je opdrachtgever schade hebben. Een BAV verzekert je als je daarvoor aansprakelijk wordt gesteld, volgens de polisvoorwaarden.", bullets: ["BAV en AVB in één polis via Hiscox", "Ook voor recruiters en loopbaanbegeleiders", "Certificaat voor je opdrachtgever"] },
        { title: "Persoonlijk contact", text: "We beantwoorden je vragen over de aanvraag en voorwaarden. De polisvoorwaarden zijn leidend." },
      ]}
      faqs={faqs}
      leesMeer={["bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt", "wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
    />
  );
}
