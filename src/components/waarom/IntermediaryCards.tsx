import { motion } from "framer-motion";

const fade = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const cards = [
  {
    name: "Circle8",
    subtitle: "Voorheen in samenwerking met ZP Zaken",
    quote: {
      text: "Omdat ZP Zaken zich al ruim zeven jaar richt op de ondersteunende producten en diensten voor zelfstandige professionals, zien wij in hen de ideale partner.",
      author: "Pascal van der Hart, Director Operations Circle8",
    },
    rows: [
      ["Model", "Verzekering per gewerkt uur via servicepakket"],
      ["Afhankelijkheid", "Dekking eindigt bij einde opdracht"],
      ["Eigen risico BAV", "n.v.t. (via bundel)"],
      ["Bemiddeling", "Actief, via eigen platform, tegen vergoeding"],
    ],
  },
  {
    name: "HeadFirst Group",
    subtitle: "Verzekering via Alicia Benefits",
    rows: [
      ["Model", "Verzekering per gewerkt uur, collectief via Alicia"],
      ["Afhankelijkheid", "Dekking eindigt bij einde opdracht"],
      ["Eigen risico AVB", "€500 per schade"],
      ["Eigen risico BAV", "€2.500 per beroepsfout"],
      ["Bemiddeling", "Actief, via Select-platform, tegen vergoeding"],
    ],
  },
  {
    name: "Magnit",
    subtitle: "Verzekering via Alicia Benefits",
    rows: [
      ["Model", "Verzekering per gewerkt uur, automatisch geïncasseerd"],
      ["Afhankelijkheid", "Dekking eindigt bij einde opdracht"],
      ["Eigen risico AVB", "€500 per schade"],
      ["Eigen risico BAV", "€2.500 per beroepsfout"],
      ["Bemiddeling", "Actief, MSP-model, tegen vergoeding"],
    ],
  },
];

export function IntermediaryCards() {
  return (
    <section className="section-padding bg-secondary">
      <div className="container-wide">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12">
          <h2 className="mb-4">Zo werken de drie grootste intermediairs in Nederland</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-bold text-foreground">{card.name}</h3>
                <p className="text-sm text-muted-foreground">{card.subtitle}</p>
              </div>

              {card.quote && (
                <div className="px-6 py-4 bg-muted/50 border-b border-border">
                  <p className="text-sm italic text-muted-foreground leading-relaxed">"{card.quote.text}"</p>
                  <p className="text-xs text-muted-foreground mt-2">— {card.quote.author}</p>
                </div>
              )}

              <div className="p-6 space-y-3">
                {card.rows.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade}>
          <div className="bg-accent text-accent-foreground rounded-xl p-5 text-center max-w-4xl mx-auto">
            <p className="font-semibold text-sm md:text-base">
              Wat ze gemeen hebben: jouw verzekering is gekoppeld aan hun opdracht. Jouw bemiddeling kost geld. Jij bent hun product.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
