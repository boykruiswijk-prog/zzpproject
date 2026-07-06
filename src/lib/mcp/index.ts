import { defineMcp } from "@lovable.dev/mcp-js";
import listPublishedArticles from "./tools/list-published-articles";
import getArticle from "./tools/get-article";
import listServices from "./tools/list-services";

export default defineMcp({
  name: "zpzaken-mcp",
  title: "ZP Zaken",
  version: "0.1.0",
  instructions:
    "Public tools for the ZP Zaken website. Use `list_services` to see what ZP Zaken offers (BAV, AVB, AOV, Wet DBA, credit control). Use `list_published_articles` and `get_article` to browse the Kennisbank knowledge base of published articles for Dutch zzp'ers.",
  tools: [listPublishedArticles, getArticle, listServices],
});
