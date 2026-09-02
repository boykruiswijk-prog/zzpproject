import { seoRoute } from "@/config/seoRoutes";
import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

const SEO = seoRoute("/kennisbank/financien");

export default function KennisbankFinancien() {
  return (
    <KennisbankCategoryPage
      slug="financien"
      title="Financiën"
      intro="Financieel beheer, pensioen opbouwen, sparen, beleggen en je financiële toekomst als zelfstandige."
      categoryTags={[]}
      metaTitle={SEO.title}
      metaDescription={SEO.description}
    />
  );
}
