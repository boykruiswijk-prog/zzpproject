import { motion } from "framer-motion";

const fade = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const cards = [
  {
    name: "Bemiddelaar A",
    subtitle: "Verzekering via verzekeraar A",
    rows: [
      ["Model", "Verzekering per gewerkt uur, collectief via verzekeraar A"],
      ["Afhankelijkheid", "Dekking eindigt bij einde opdracht"],
      ["Eigen risico AVB", "€500 per schade"],
      ["Eigen risico BAV", "€2.500 per beroepsfout"],
      ["Bemiddeling", "Actief, via hun platform, tegen vergoeding"],
    ],
  },
  {
    name: "Bemiddelaar B",
    subtitle: "Verzekering via verzekeraar A",
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
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fade} className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="mb-4">Hoe werken platforms en intermediairs?</h2>
          <p className="text-muted-foreground">
            De meeste grote platforms in Nederland koppelen verzekeringen aan hun opdrachten. Dat lijkt handig, maar heeft consequenties die zzp'ers zich vaak niet realiseren.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
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
              Wat ze gemeen hebben: jouw verzekering is gekoppeld aan hun opdracht. Stopt de opdracht? Dan stopt je dekking. ZP Zaken werkt anders :  jij beheert je eigen polis, los van wie je opdrachtgever is.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
