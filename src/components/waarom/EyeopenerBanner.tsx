import { motion } from "framer-motion";

const facts = [
  { value: "€2.500", label: "eigen risico bij beroepsfout via een platform of collectief" },
  { value: "€0", label: "eigen risico bij ZP Zaken", highlight: true },
  { value: "Stopt", label: "jouw dekking bij einde opdracht via een platform" },
  { value: "Altijd", label: "jouw dekking via ZP Zaken, opdracht of niet", highlight: true },
];

export function EyeopenerBanner() {
  return (
    <section className="bg-foreground py-8">
      <div className="container-wide">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {facts.map((fact, i) => (
            <motion.div
              key={fact.value + i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <p className={`text-2xl md:text-3xl font-bold ${fact.highlight ? "text-accent" : "text-white"}`}>
                {fact.value}
              </p>
              <p className="text-xs md:text-sm text-white/60 mt-1">{fact.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
