import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";
import { supportedLanguages, languageNames, languageFlags, type SupportedLanguage } from "@/i18n/config";
import { useLanguage } from "@/hooks/useLanguage";

export function LanguageSwitcher() {
  const { currentLang, switchLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md">
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{languageFlags[currentLang]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => switchLanguage(lang as SupportedLanguage)}
            className={currentLang === lang ? "bg-accent/10 text-accent" : ""}
          >
            <span className="mr-2">{languageFlags[lang]}</span>
            {languageNames[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
