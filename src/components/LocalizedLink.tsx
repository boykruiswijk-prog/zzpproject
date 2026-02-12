import { Link, type LinkProps } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { forwardRef } from "react";

/**
 * A wrapper around react-router's Link that automatically prepends
 * the current language prefix to the `to` path.
 * 
 * External links (starting with http) and hash-only links are passed through unchanged.
 */
export const LocalizedLink = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, ...props }, ref) => {
    const { localizedPath } = useLanguage();

    const resolvedTo = typeof to === "string"
      ? (to.startsWith("http") || to.startsWith("#") ? to : localizedPath(to))
      : to;

    return <Link ref={ref} to={resolvedTo} {...props} />;
  }
);

LocalizedLink.displayName = "LocalizedLink";
