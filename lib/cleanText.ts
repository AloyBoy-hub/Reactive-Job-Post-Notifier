import { load } from "cheerio";

export const cleanHtmlToText = (html: string, maxCharacters = 14000): string => {
  const $ = load(html);

  $("script, style, noscript, nav, footer, header, svg, iframe, form").remove();

  const bodyText = $("body").text() || $.root().text();
  const normalized = bodyText.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return normalized.slice(0, maxCharacters);
};
