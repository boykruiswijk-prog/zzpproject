import { Clock, ShieldCheck, CalendarCheck } from "lucide-react";
import { BeroepVerzekeringPagina, PRIJS_MAAND, PRIJS_JAAR } from "@/components/diensten/BeroepVerzekeringPagina";
import { LandingVerzekeringBlokken, BAV_MILJOEN, AVB_MILJOEN } from "@/components/diensten/LandingVerzekeringBlokken";

const faqs = [
  { question: "Wat dekt een beroepsaansprakelijkheidsverzekering?", answer: "Een beroepsaansprakelijkheidsverzekering (BAV) dekt schade die je opdrachtgever lijdt door een fout in je werk, bijvoorbeeld een rekenfout of een gemiste deadline. Wat precies gedekt is, staat in de polisvoorwaarden." },
  { question: "Wat kost een beroepsaansprakelijkheidsverzekering voor zzp'ers?", answer: `Bij ZP Zaken kost de BAV samen met de AVB vanaf ${PRIJS_MAAND} per maand of ${PRIJS_JAAR} per jaar, inclusief kosten en assurantiebelasting. Je betaalt geen eigen risico.` },
  { question: "Is een beroepsaansprakelijkheidsverzekering verplicht?", answer: "Nee, een BAV is niet wettelijk verplicht. Opdrachtgevers eisen het wel vaak in hun contract." },
  { question: "Hoe snel heb ik een certificaat?", answer: "Je vraagt online aan. Binnen 24 uur is het geregeld en krijg je het certificaat per mail, zodat je het naar je opdrachtgever kunt sturen." },
  { question: "Kan ik dagelijks opzeggen?", answer: "Ja. Er is geen jaarcontract. Je polis is dagelijks opzegbaar." },
  { question: "Is er uitloopdekking?", answer: "Nee, deze polis heeft geen uitloopdekking. Na het einde van je polis vallen nieuwe aanspraken niet meer onder deze verzekering." },
];

export default function Beroepsaansprakelijkheidsverzekering() {
  return (
    <BeroepVerzekeringPagina
      path="/beroepsaansprakelijkheidsverzekering"
      serviceName="Beroepsaansprakelijkheidsverzekering voor zzp'ers"
      badge="Voor zzp'ers"
      title={<>Beroepsaansprakelijkheidsverzekering voor <span className="text-accent">zzp'ers</span></>}
      subtitle={`Een beroepsaansprakelijkheidsverzekering beschermt je als een opdrachtgever je aansprakelijk stelt voor schade door een fout in je werk. Bij ZP Zaken kost die vanaf ${PRIJS_MAAND.replace("€", "€ ")} per maand of ${PRIJS_JAAR.replace("€", "€ ")} per jaar, inclusief kosten en assurantiebelasting.`}
      sector=""
      benefits={[
        { icon: ShieldCheck, title: "BAV en AVB in één polis", description: `${BAV_MILJOEN} BAV en ${AVB_MILJOEN} AVB per aanspraak via Hiscox, zonder eigen risico.` },
        { icon: Clock, title: "Binnen 24 uur geregeld", description: "Je vraagt online aan. Binnen 24 uur staat je certificaat in je mailbox." },
        { icon: CalendarCheck, title: "Dagelijks opzegbaar", description: "Geen jaarcontract. Je kiest zelf de ingangsdatum en zegt dagelijks op." },
      ]}
      explainers={[
        { title: "Persoonlijke service", text: "Twijfel je of de polis past bij je opdracht? We beantwoorden je vragen over de aanvraag en de polisvoorwaarden. Bel ons op 020 - 457 3077." },
      ]}
      faqs={faqs}
      leesMeer={["wat-kosten-verzekeringen-voor-zzp-ers", "welke-verzekeringen-zzp", "bedrijfsaansprakelijkheidsverzekering-zzp"]}
      extra={<LandingVerzekeringBlokken />}
    />
  );
}
