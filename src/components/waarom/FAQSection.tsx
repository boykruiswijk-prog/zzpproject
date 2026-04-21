import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "Wat is het verschil tussen een platformverzekering en een eigen polis bij ZP Zaken?",
    a: "Een platformverzekering is gekoppeld aan jouw opdracht bij dat platform. Zodra de opdracht eindigt, eindigt ook je dekking. Een eigen polis bij ZP Zaken staat op jouw naam, loopt door zolang jij dat wilt en is dagelijks opzegbaar. Jij hebt de controle.",
  },
  {
    q: "Kan ik naast mijn intermediairverzekering ook bij ZP Zaken verzekerd zijn?",
    a: "Dat hoeft niet — bij ZP Zaken heb je al betere dekking voor een lagere prijs. Je kunt je intermediair laten weten dat je al verzekerd bent via een eigen polis.",
  },
  {
    q: "Waarom biedt ZP Zaken ook bemiddeling via Onefellow?",
    a: "Omdat een goede zzp'er meer verdient dan alleen een goede opdracht. Onefellow bemiddelt gratis voor jou als zelfstandige — geen kosten, wel persoonlijk contact.",
  },
  {
    q: "Hoe kan ZP Zaken zoveel goedkoper zijn?",
    a: "Wij werken met een mantelovereenkomst voor 5.000+ zzp'ers. Door de premie te delen over een grote groep blijft de prijs structureel laag. Geen winstmarge voor een tussenpersoon bovenop.",
  },
  {
    q: "Wat als ik tussen opdrachten zit — ben ik dan verzekerd?",
    a: "Ja. Jouw polis bij ZP Zaken loopt gewoon door. Je bent dagelijks opzegbaar maar nooit automatisch gestopt. Dat is het fundamentele verschil met een intermediairverzekering.",
  },
];

export function FAQSection() {
  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2>Veelgestelde vragen</h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6 overflow-hidden">
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export const faqSchema = {
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};
