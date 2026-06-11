// Static Google reviews data. Later replace with Google Places API response
// without changing the consumer components.

export interface GoogleReview {
  rating: number;
  text: string;
}

export interface GoogleReviewsData {
  businessName: string;
  placeId: string;
  reviewsUrl: string;
  averageRating: number;
  reviewCount: number;
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
  businessName: "ZP Zaken | Specialist in BAV",
  placeId: "ChIJ5wXTzBPnxUcR5NGNhaq2lJA",
  reviewsUrl:
    "https://search.google.com/local/reviews?placeid=ChIJ5wXTzBPnxUcR5NGNhaq2lJA",
  averageRating: 5.0,
  reviewCount: 4,
  address: {
    streetAddress: "Tupolevlaan 41",
    postalCode: "1119 NW",
    addressLocality: "Schiphol-Rijk",
    addressCountry: "NL",
  },
  geo: { latitude: 52.2796022, longitude: 4.7514364 },
  reviews: [
    {
      rating: 5,
      text: "I searched for a business insurance policy (BAV) for my company on Google. I found ZP Zaken! They had a good price for the BAV/AVB, a clear website, and very friendly service over the phone. Best regards from a satisfied customer.",
    },
    {
      rating: 5,
      text: "Friendly people instead of robots to communicate with, to the point and fast. It was a pleasure doing business with them.",
    },
    {
      rating: 5,
      text: "Quickly arranged!",
    },
  ],
};
