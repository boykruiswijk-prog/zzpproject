// Single source of truth for Google reviews shown on the public website.
// All review-displaying components MUST import from here. Do not duplicate
// review text or rating values elsewhere.

export interface GoogleReview {
  name: string;
  rating: number;
  text: string;
  sourceUrl: string;
}

export interface GoogleReviewsData {
  placeId: string;
  averageRating: number;
  totalReviews: number;
  googleReviewsUrl: string;
  address: {
    streetAddress: string;
    postalCode: string;
    addressLocality: string;
    addressCountry: string;
  };
  geo: { latitude: number; longitude: number };
  reviews: GoogleReview[];
}

export const googleReviewsData: GoogleReviewsData = {
  placeId: "ChIJ5wXTzBPnxUcR5NGNhaq2lJA",
  averageRating: 5.0,
  totalReviews: 4,
  googleReviewsUrl:
    "https://search.google.com/local/reviews?placeid=ChIJ5wXTzBPnxUcR5NGNhaq2lJA",
  address: {
    streetAddress: "Tupolevlaan 41",
    postalCode: "1119 NW",
    addressLocality: "Schiphol-Rijk",
    addressCountry: "NL",
  },
  geo: { latitude: 52.2796022, longitude: 4.7514364 },
  reviews: [
    {
      name: "Maikel Buijze",
      rating: 5,
      text: "Via Google zocht ik naar een BAV voor mijn onderneming. Uitgekomen bij ZP Zaken! Goeie prijs voor de BAV/AVB, duidelijke website en erg vriendelijk geholpen via de telefoon. Groetjes van een tevreden klant:)",
      sourceUrl: "https://g.co/kgs/9LscLL9",
    },
    {
      name: "Max Leuftink",
      rating: 5,
      text: "Na online wat zoekwerk te hebben verricht uiteindelijk uitgekomen bij ZP Zaken voor een BAV. Snel, duidelijk en vriendelijk contact en tevreden met de gemaakte afspraken!",
      sourceUrl: "https://g.co/kgs/9LscLL9",
    },
    {
      name: "Elke Wijnands",
      rating: 5,
      text: "Uitstekende service bij ZP Zaken! Hun communicatie is helder en efficiënt, en ze zijn altijd bereid om te helpen. Een absolute aanrader voor elke zelfstandige professional.",
      sourceUrl: "https://g.co/kgs/csJFuFT",
    },
  ],
} as const;
