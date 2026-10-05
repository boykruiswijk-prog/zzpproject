import { seoRoute } from "@/config/seoRoutes";
import { LocalizedLink } from "@/components/LocalizedLink";
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
    >
      <p className="mb-8 rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
        Prijzen en dekking naast elkaar zien?{" "}
        <LocalizedLink to="/bav-zzp-vergelijken" className="font-semibold text-accent underline underline-offset-2">BAV zzp vergelijken 2026</LocalizedLink>{" "}
        zet de vanaf-prijs, het verzekerd bedrag en het eigen risico van negen aanbieders op een rij.
      </p>
    </KennisbankCategoryPage>
  );
}
