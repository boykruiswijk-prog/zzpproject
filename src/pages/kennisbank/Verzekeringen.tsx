import { seoRoute } from "@/config/seoRoutes";
import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

const SEO = seoRoute("/kennisbank/verzekeringen");

export default function KennisbankVerzekeringen() {
  return (
    <KennisbankCategoryPage
      slug="verzekeringen"
      title="Verzekeringen voor zzp'ers"
      intro="Uitleg over aansprakelijkheid, AOV, cyberrisico's, zorgverzekering en wat verzekeringen voor zzp'ers kosten. Zo weet je welke dekking bij jouw werk past."
      categoryTags={["Verzekeringen"]}
      metaTitle={SEO.title}
      metaDescription={SEO.description}
    />
  );
}
