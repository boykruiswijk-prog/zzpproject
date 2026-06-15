import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

export default function KennisbankOndernemen() {
  return (
    <KennisbankCategoryPage
      slug="ondernemen"
      title="Ondernemen"
      intro="Praktische tips en kennis voor groei, klantrelaties, professionalisering en risicomanagement als zelfstandige."
      categoryTags={["Nieuws", "Verzekeringen"]}
      metaTitle="Ondernemen als ZZP'er | Kennisbank | ZP Zaken"
      metaDescription="Praktische tips voor groei, klantrelaties en risicomanagement als zelfstandige. Bekijk artikelen voor zzp'ers in onze kennisbank."
    />
  );
}
