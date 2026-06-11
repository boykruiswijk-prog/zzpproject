import { Helmet } from "react-helmet-async";
import { Star, Quote, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { googleReviewsData } from "@/data/googleReviews";
import { SITE_CONFIG } from "@/config/site";

function Stars({ count = 5, className = "h-4 w-4" }: { count?: number; className?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} van 5 sterren`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className={`${className} fill-yellow-400 text-yellow-400`} />
      ))}
    </div>
  );
}

function GoogleG({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.2 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.1-5c-2 1.4-4.5 2.2-7.2 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6.1 5C40.9 36.6 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

interface Props {
  className?: string;
}

export function GoogleReviewsSection({ className = "" }: Props) {
  const { averageRating, reviewCount, reviews, reviewsUrl } = googleReviewsData;

  const schema = {
    "@context": "https://schema.org",
    "@type": "InsuranceAgency",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    telephone: SITE_CONFIG.phone,
    address: {
      "@type": "PostalAddress",
      ...googleReviewsData.address,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: averageRating.toFixed(1),
      reviewCount: String(reviewCount),
      bestRating: "5",
      worstRating: "1",
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
      },
      reviewBody: r.text,
    })),
  };

  return (
    <section className={`section-padding bg-background ${className}`}>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>

      <div className="container-wide">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Wat klanten zeggen
          </p>
          <div className="flex items-center justify-center gap-3 mb-3">
            <h2 className="!mb-0">{averageRating.toFixed(1).replace(".", ",")} sterren op Google</h2>
            <Stars count={5} className="h-6 w-6" />
          </div>
          <p className="text-muted-foreground">
            Op basis van {reviewCount} reviews.{" "}
            <a
              href={reviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent"
            >
              Bekijk alle reviews op Google.
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reviews.map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-card border border-border/60 rounded-2xl p-6 shadow-card flex flex-col"
            >
              <Stars count={review.rating} />
              <div className="relative mt-4 flex-1">
                <Quote className="absolute -left-1 -top-1 h-5 w-5 text-accent/30" aria-hidden="true" />
                <p className="italic text-sm leading-relaxed text-foreground/90 pl-5">
                  {review.text}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
                <GoogleG className="h-4 w-4" />
                <span>via Google</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <a href={reviewsUrl} target="_blank" rel="noopener noreferrer">
              Lees alle reviews op Google
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
