import { MessageCircle, FileSearch, CheckCircle } from "lucide-react";
import { AnimatedSection } from "@/components/ui/animated-section";

interface StepsProcessProps {
  variant?: "light" | "dark";
}

const steps = [
  { number: "1", icon: MessageCircle, title: "Gratis kennismaking", desc: "15 min. vrijblijvend gesprek" },
  { number: "2", icon: FileSearch, title: "Persoonlijk advies", desc: "Helder overzicht op maat" },
  { number: "3", icon: CheckCircle, title: "Binnen 24 uur geregeld", desc: "Certificaat in je mailbox" },
];

export function StepsProcess({ variant = "light" }: StepsProcessProps) {
  const isDark = variant === "dark";

  return (
    <AnimatedSection delay={0.2}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
        {steps.map((step, i) => (
          <div key={step.number} className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                isDark
                  ? "bg-accent text-accent-foreground"
                  : "bg-accent/10 text-accent"
              }`}>
                {step.number}
              </div>
              <div>
                <p className={`font-medium text-sm ${isDark ? "text-primary-foreground" : "text-foreground"}`}>
                  {step.title}
                </p>
                <p className={`text-xs ${isDark ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {step.desc}
                </p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`hidden sm:block w-8 h-px ${isDark ? "bg-primary-foreground/20" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
    </AnimatedSection>
  );
}
