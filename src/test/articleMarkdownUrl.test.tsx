// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import { articleMarkdownUrl } from "@/lib/articleMarkdownUrl";

describe("artikel-markdown URL-beveiliging", () => {
  it.each([
    "tel:0204573077", "tel:+31204573077", "mailto:info@zpzaken.nl",
    "http://example.com", "https://example.com", "/verzekeringen", "#vragen",
  ])("behoudt de link %s", (url) => {
    const { container } = render(<ReactMarkdown urlTransform={articleMarkdownUrl}>{`[Contact](${url})`}</ReactMarkdown>);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(url);
  });

  it.each(["javascript:alert", "data:text/html,test", "vbscript:test"])("blokkeert %s", (url) => {
    expect(articleMarkdownUrl(url, "href")).toBe("");
  });

  it("staat tel alleen toe voor links, niet voor afbeeldingen", () => {
    expect(articleMarkdownUrl("tel:0204573077", "src")).toBe("");
  });
});