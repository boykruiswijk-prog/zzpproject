import { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, type SupportedLanguage } from '@/i18n/config';

export function useLanguage() {
  const { lang } = useParams<{ lang?: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const currentLang = (lang && supportedLanguages.includes(lang as SupportedLanguage)) 
    ? lang as SupportedLanguage 
    : 'nl';

  useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [currentLang, i18n]);

  const switchLanguage = (newLang: SupportedLanguage) => {
    const pathWithoutLang = location.pathname.replace(/^\/(nl|en|de|fr)/, '') || '/';
    const newPath = newLang === 'nl' ? pathWithoutLang : `/${newLang}${pathWithoutLang}`;
    navigate(newPath);
  };

  const localizedPath = (path: string) => {
    if (currentLang === 'nl') return path;
    return `/${currentLang}${path}`;
  };

  return { currentLang, switchLanguage, localizedPath };
}
