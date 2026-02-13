import { Shield, Star, MapPin, FileText } from "lucide-react";
import { motion } from "framer-motion";

interface TrustBarProps {
  variant?: "light" | "dark";
  className?: string;
}

export function TrustBar({ variant = "light", className = "" }: TrustBarProps) {
  const isDark = variant === "dark";

  const items = [
    { icon: Shield, label: "AFM vergunning 12050636" },
    { icon: Star, label: "4.9/5 Google Reviews" },
    { icon: Shield, label: "Kifid aangesloten" },
    { icon: MapPin, label: "Tupolevlaan 41, Schiphol-Rijk" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs ${
        isDark ? "text-primary-foreground/70" : "text-muted-foreground"
      } ${className}`}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <item.icon className={`h-3.5 w-3.5 ${isDark ? "text-accent" : "text-accent"}`} />
          {item.label}
        </span>
      ))}
    </motion.div>
  );
}
